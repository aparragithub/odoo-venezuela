/** @odoo-module */

import { Component } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { useService } from "@web/core/utils/hooks";
import { AlertDialog, ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";
import { InfoPopup } from "../InfoPopup/InfoPopup";

/**
 * Componente para generar Reportes X y Z desde la UI del POS
 * Se integra en el ClosePosPopup o en el Navbar
 *
 * Migrado del servicio `popup` (v17, eliminado en Odoo 19) al servicio
 * `dialog` con AlertDialog/ConfirmationDialog de `@web/core/confirmation_dialog`.
 */
export class FiscalReports extends Component {
    static template = "l10n_ve_pos_mf.FiscalReports";

    setup() {
        this.pos = usePos();
        this.dialog = useService("dialog");
    }

    /**
     * Obtiene la instancia del driver de la máquina fiscal
     * @returns {TfhkaDriver|null}
     */
    getFiscalPrinter() {
        return window.fiscalPrinter || null;
    }

    /**
     * Genera un Reporte X (consulta sin cerrar día)
     */
    async printReportX() {
        const fiscalPrinter = this.getFiscalPrinter();

        if (!fiscalPrinter || !fiscalPrinter.isConnected) {
            this.dialog.add(AlertDialog, {
                title: _t("Máquina Fiscal no conectada"),
                body: _t("Por favor, conecta la máquina fiscal antes de imprimir el reporte X"),
            });
            return;
        }

        try {
            const result = await fiscalPrinter.printReportX();

            if (!result.success) {
                this.dialog.add(AlertDialog, {
                    title: _t("Error al imprimir Reporte X"),
                    body: _t(result.error || "Error desconocido"),
                });
            }
        } catch (error) {
            console.error("FiscalReports:: Error al imprimir Reporte X", error);
            this.dialog.add(AlertDialog, {
                title: _t("Error al imprimir Reporte X"),
                body: _t(error.message || "Error interno"),
            });
        }
    }

    /**
     * Genera un Reporte Z (cierre diario)
     * Requiere confirmación del usuario ya que es irreversible
     */
    async printReportZ() {
        const fiscalPrinter = this.getFiscalPrinter();

        if (!fiscalPrinter || !fiscalPrinter.isConnected) {
            this.dialog.add(AlertDialog, {
                title: _t("Máquina Fiscal no conectada"),
                body: _t("Por favor, conecta la máquina fiscal antes de imprimir el reporte Z"),
            });
            return;
        }

        // Confirmación (el Reporte Z es irreversible)
        this.dialog.add(ConfirmationDialog, {
            title: _t("Confirmar Reporte Z"),
            body: _t(
                "El Reporte Z cerrará el día fiscal actual. Esta acción es IRREVERSIBLE. ¿Deseas continuar?"
            ),
            confirm: () => this._doPrintReportZ(fiscalPrinter),
            cancel: () => {},
        });
    }

    async _doPrintReportZ(fiscalPrinter) {
        try {
            const result = await fiscalPrinter.printReportZ();

            if (!result.success) {
                this.dialog.add(AlertDialog, {
                    title: _t("Error al imprimir Reporte Z"),
                    body: _t(result.error || "Error desconocido"),
                });
            } else {
                this.dialog.add(InfoPopup, {
                    title: _t("Reporte Z impreso"),
                    body: _t("El cierre diario se ha realizado exitosamente"),
                    confirmText: _t("OK"),
                });
            }
        } catch (error) {
            console.error("FiscalReports:: Error al imprimir Reporte Z", error);
            this.dialog.add(AlertDialog, {
                title: _t("Error al imprimir Reporte Z"),
                body: _t(error.message || "Error interno"),
            });
        }
    }
}
