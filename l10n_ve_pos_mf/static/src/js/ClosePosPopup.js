/** @odoo-module **/

import { ClosePosPopup } from "@point_of_sale/app/components/popups/closing_popup/closing_popup";
import { patch } from "@web/core/utils/patch";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";

/**
 * Integra el cierre de sesión con la máquina fiscal Web Serial:
 * - Antes de permitir el cierre, valida que no existan pedidos de la
 *   sesión sin número de factura fiscal (mf_invoice_number).
 * - Si todos están facturados, imprime el Reporte Z y sincroniza el
 *   contador (mf_reportz) con Odoo antes de continuar con el flujo nativo
 *   de cierre (`confirm()`, que maneja la conciliación de caja).
 *
 * Migración v17 -> Odoo 19:
 * - `@point_of_sale/app/navbar/closing_popup/closing_popup` ->
 *   `@point_of_sale/app/components/popups/closing_popup/closing_popup`
 * - v17 reemplazaba el botón nativo de cierre por uno propio
 *   (`closeSessionAndPrintZ`) que llamaba a `this.closeSession()`
 *   directamente, saltándose la conciliación de caja nativa. En Odoo 19,
 *   `confirm()` YA es el manejador nativo del botón de cierre y maneja la
 *   diferencia de caja correctamente — en vez de reemplazarlo, lo
 *   envolvemos: primero validamos lo fiscal, luego delegamos en
 *   `super.confirm()` para el flujo nativo de caja + `closeSession()`.
 * - `this.pos.pos_session` -> `this.pos.session`.
 * - Servicio `popup` (eliminado) -> servicio `dialog` (ya inicializado por
 *   el `setup()` nativo de `ClosePosPopup`, no hace falta re-declararlo).
 */
patch(ClosePosPopup.prototype, {
  setup() {
    super.setup(...arguments);
    this.state.isPrintingReport = false;
  },

  getFiscalPrinter() {
    return this.pos.getFiscalPrinter?.() || window.fiscalPrinter || null;
  },

  async generate_report_x() {
    if (this.state.isPrintingReport) {
      return;
    }

    const fiscalPrinter = this.getFiscalPrinter();
    if (!fiscalPrinter || !fiscalPrinter.isConnected) {
      this.dialog.add(AlertDialog, {
        title: _t("Maquina Fiscal no conectada"),
        body: _t("Por favor, conecta la maquina fiscal antes de imprimir el reporte X."),
      });
      return;
    }

    this.state.isPrintingReport = true;
    try {
      const result = await fiscalPrinter.printReportX();
      if (!result.success) {
        this.dialog.add(AlertDialog, {
          title: _t("Error al imprimir Reporte X"),
          body: _t(result.error || "Error desconocido"),
        });
      }
    } catch (error) {
      this.dialog.add(AlertDialog, {
        title: _t("Error al imprimir Reporte X"),
        body: _t(error.message || "Error interno"),
      });
    } finally {
      this.state.isPrintingReport = false;
    }
  },

  /**
   * Imprime el Reporte Z y sincroniza el contador con Odoo.
   * No cierra la sesión — solo se encarga de la parte fiscal.
   * @returns {Promise<boolean>} true si el reporte se imprimió y sincronizó correctamente
   */
  async _printFiscalReportZ() {
    const fiscalPrinter = this.getFiscalPrinter();
    if (!fiscalPrinter || !fiscalPrinter.isConnected) {
      this.dialog.add(AlertDialog, {
        title: _t("Maquina Fiscal no conectada"),
        body: _t("Por favor, conecta la maquina fiscal antes de imprimir el reporte Z."),
      });
      return false;
    }

    this.state.isPrintingReport = true;
    try {
      const zResult = await fiscalPrinter.printReportZ();
      if (!zResult.success) {
        this.dialog.add(AlertDialog, {
          title: _t("Error al imprimir Reporte Z"),
          body: _t(zResult.error || "Error desconocido"),
        });
        return false;
      }

      const s1Result = await fiscalPrinter._readS1Data();
      const dailyClosureCounter = s1Result.data?.dailyClosureCounter;
      if (!s1Result.success || !s1Result.data?.registeredMachineNumber || !Number.isInteger(dailyClosureCounter)) {
        this.dialog.add(AlertDialog, {
          title: _t("Reporte Z impreso con advertencia"),
          body: _t(
            "El Reporte Z se imprimio, pero no se pudo leer el estado S1 para sincronizar Odoo. Verifica el libro de ventas manualmente."
          ),
        });
        return false;
      }

      const value = {
        valid: true,
        data: {
          _registeredMachineNumber: s1Result.data.registeredMachineNumber,
          _dailyClosureCounter: dailyClosureCounter,
        },
      };

      await this.pos.data.call("account.move", "report_z", [[], this.pos.config.serial_machine, value]);
      await this.pos.data.call("pos.session", "set_report_z", [[this.pos.session.id], value]);

      return true;
    } catch (error) {
      this.dialog.add(AlertDialog, {
        title: _t("Error al imprimir Reporte Z"),
        body: _t(error.message || "Error interno"),
      });
      return false;
    } finally {
      this.state.isPrintingReport = false;
    }
  },

  /**
   * Busca en la sesión actual pedidos que no tengan número de factura de
   * la máquina fiscal (mf_invoice_number). Se excluyen los pedidos
   * cancelados.
   * @returns {Promise<Array<{id: number, name: string}>>}
   */
  async _getUnfiscalizedOrders() {
    return await this.pos.data.searchRead(
      "pos.order",
      [
        ["session_id", "=", this.pos.session.id],
        ["mf_invoice_number", "=", false],
        ["state", "!=", "cancel"],
      ],
      ["name"],
      { order: "id asc" }
    );
  },

  /**
   * Envuelve el `confirm()` nativo (botón de cierre de sesión): antes de
   * dejar que el core concilie caja y cierre la sesión, valida que todos
   * los pedidos ya tengan número fiscal e imprime el Reporte Z.
   */
  async confirm() {
    if (this.state.isPrintingReport) {
      return;
    }

    // Si ya se generó el Reporte Z en esta sesión, no volver a pedirlo
    // (evita doble Z si el cajero reintenta el cierre tras un error nativo
    // de conciliación de caja).
    if (this.pos.session.report_z) {
      return super.confirm();
    }

    const unfiscalizedOrders = await this._getUnfiscalizedOrders();
    if (unfiscalizedOrders.length > 0) {
      const MAX_SHOWN = 10;
      const shownNames = unfiscalizedOrders.slice(0, MAX_SHOWN).map((o) => o.name);
      let body = _t(
        "Existen %s pedido(s) sin facturar en esta sesion. Debes facturarlos antes de cerrar:\n\n%s",
        unfiscalizedOrders.length,
        shownNames.join("\n")
      );
      if (unfiscalizedOrders.length > MAX_SHOWN) {
        body += _t("\n\n... y %s mas", unfiscalizedOrders.length - MAX_SHOWN);
      }
      this.dialog.add(AlertDialog, {
        title: _t("No se puede cerrar la sesion"),
        body,
      });

      // Tras aceptar el aviso, cerramos el popup de cierre y llevamos al
      // cajero directo a la lista de pedidos, filtrada para mostrar solo
      // los pendientes por facturar, de manera que pueda ubicarlos e
      // imprimirlos sin tener que buscarlos manualmente.
      this.props.close();
      this.pos.showScreen("TicketScreen", { stateOverride: { filter: "UNFISCALIZED" } });
      return;
    }

    const zPrinted = await this._printFiscalReportZ();
    if (!zPrinted) {
      return;
    }

    // Flujo nativo de conciliacion de caja + closeSession().
    return super.confirm();
  },
});
