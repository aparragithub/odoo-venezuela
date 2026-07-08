/** @odoo-module **/

import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { patch } from "@web/core/utils/patch";

/**
 * Extiende la serialización de pos.order para incluir los campos fiscales
 * (fiscal_machine, mf_invoice_number, mf_reportz).
 *
 * Nota Odoo 19: los campos declarados en el contrato de carga
 * (`pos.order._load_pos_data_fields`, ver l10n_ve_pos_mf/models/pos_order.py)
 * ya se asignan automáticamente como propiedades del registro reactivo al
 * cargar la orden — no se requiere un `init_from_JSON` manual (ese hook fue
 * eliminado en Odoo 19, reemplazado por el sistema de related_models).
 *
 * Lo que SÍ requiere override explícito es `serializeForORM`, ya que
 * `set_data_from_fiscal_machine` (PosStore.js) asigna estos valores
 * directamente sobre la instancia en memoria después de imprimir, y deben
 * viajar de vuelta al backend en el próximo sync.
 */
patch(PosOrder.prototype, {
  serializeForORM(opts = {}) {
    const data = super.serializeForORM(opts);
    data.fiscal_machine = this.fiscal_machine || false;
    data.mf_invoice_number = this.mf_invoice_number || false;
    data.mf_reportz = this.mf_reportz || false;
    return data;
  },
  assertEditable() {
    // No bloquear edición basada en el estado de impresión fiscal Web Serial
    // (equivalente al no-op de v17 `assert_editable`).
    return;
  },
});
