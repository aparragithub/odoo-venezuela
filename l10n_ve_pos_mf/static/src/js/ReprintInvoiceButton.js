/** @odoo-module **/

import { Component } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { useService } from "@web/core/utils/hooks";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";
import { InfoPopup } from "../components/InfoPopup/InfoPopup";

/**
 * Botón de reimpresión de documento fiscal en la pantalla de Ticket (POS).
 *
 * Reimprime la factura/NC/ND fiscal ya emitida directamente vía Web Serial
 * API (TfhkaDriver.reprintDocument), sin depender del IoT Box legacy.
 *
 * Caso de uso principal: el cliente perdió su ticket físico y solicita una
 * copia; el cajero busca el pedido ya facturado y reimprime desde aquí.
 */
export class ReprintInvoiceButton extends Component {
    static template = "binaural_pos_mf.ReprintInvoiceButton";

    setup() {
        super.setup();
        this.pos = usePos();
        this.dialog = useService("dialog");
    }

    /**
     * Obtiene la instancia del driver de la máquina fiscal (Web Serial),
     * expuesta globalmente por pos_app.js al conectar la impresora.
     * @returns {TfhkaDriver|null}
     */
    getFiscalPrinter() {
        return window.fiscalPrinter || null;
    }

    async _onClick() {
        const order = this.props.order;

        // Solo se puede reimprimir un documento que YA tiene número fiscal
        // asignado (fue impreso exitosamente en algún momento). Si el pedido
        // nunca se imprimió fiscalmente, no hay nada que reimprimir.
        if (!order || !order.mf_invoice_number) {
            this.dialog.add(AlertDialog, {
                title: _t("Nada que reimprimir"),
                body: _t("Este pedido no tiene un número de factura fiscal asociado."),
            });
            return;
        }

        const driver = this.getFiscalPrinter();
        if (!driver || !driver.isConnected) {
            this.dialog.add(AlertDialog, {
                title: _t("Máquina Fiscal no conectada"),
                body: _t("Conecta la máquina fiscal antes de reimprimir el documento."),
            });
            return;
        }

        // v17: order.get_total_with_tax() >= 0 -> Odoo 19: order.totalDue (getter)
        const total = order.totalDue ?? (typeof order.get_total_with_tax === "function" ? order.get_total_with_tax() : 0);
        const type = total >= 0 ? "out_invoice" : "out_refund";

        try {
            const result = await driver.reprintDocument({
                type,
                number: order.mf_invoice_number,
            });

            if (result.success) {
                this.dialog.add(InfoPopup, {
                    title: _t("Documento reimpreso"),
                    body: _t("El documento fiscal se reimprimió correctamente."),
                });
            } else {
                this.dialog.add(AlertDialog, {
                    title: _t("Error al reimprimir"),
                    body: result.error || _t("Error desconocido al reimprimir el documento fiscal."),
                });
            }
        } catch (error) {
            console.error("ReprintInvoiceButton:: Error al reimprimir", error);
            this.dialog.add(AlertDialog, {
                title: _t("Error al reimprimir"),
                body: error?.message || _t("Error interno al comunicar con la máquina fiscal."),
            });
        }
    }
}
