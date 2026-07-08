/** @odoo-module */

import { Component, xml } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";

/**
 * Popup informativo genérico (éxito/aviso) para el flujo Web Serial.
 *
 * Migrado desde el patrón v17 `AbstractAwaitablePopup` (eliminado en Odoo 19)
 * al patrón `Dialog` de `@web/core/dialog/dialog`. Uso:
 *   this.dialog.add(InfoPopup, { title: _t("..."), body: _t("...") });
 */
export class InfoPopup extends Component {
    static components = { Dialog };
    static props = {
        title: { type: String, optional: true },
        body: { type: String, optional: true },
        confirmText: { type: String, optional: true },
        close: Function,
    };
    static defaultProps = {
        title: _t("Información"),
        body: "",
        confirmText: _t("Aceptar"),
    };
    static template = xml`
        <Dialog title="props.title" size="'md'">
            <main>
                <t t-esc="props.body"/>
            </main>
            <t t-set-slot="footer">
                <button class="btn btn-primary" t-on-click="() => props.close()">
                    <t t-esc="props.confirmText"/>
                </button>
            </t>
        </Dialog>
    `;
}
