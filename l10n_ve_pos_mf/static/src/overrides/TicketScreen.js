/** @odoo-module **/

import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { ReprintInvoiceButton } from "../js/ReprintInvoiceButton";
import { PrintPendingOrderButton } from "../components/PrintPendingOrderButton/PrintPendingOrderButton";

patch(TicketScreen, {
    components: {
        ...TicketScreen.components,
        ReprintInvoiceButton,
        PrintPendingOrderButton,
    },
});

/**
 * Filtro adicional "Pendientes por facturar": agrega la opción UNFISCALIZED
 * a los filtros de estado de TicketScreen, reutilizando el mismo mecanismo
 * de fetch backend (`_fetchSyncedOrders`) que usa el filtro nativo "SYNCED"
 * (Pagado), pero con la condición extra `mf_invoice_number = false`.
 *
 * Odoo 19 gatea el fetch/paginación backend con comparaciones explícitas
 * `this.state.filter === "SYNCED"` en varios métodos del core
 * (`onFilterSelected`, `onSearch`, `onNextPage`, `onPrevPage`,
 * `onClickPageNbr`, `getFilteredOrderList`). Como no hay un hook genérico
 * "es un filtro tipo backend-fetch", replicamos esos overrides agregando
 * "UNFISCALIZED" a la condición en cada uno.
 */
const BACKEND_FETCH_FILTERS = ["SYNCED", "UNFISCALIZED"];

patch(TicketScreen.prototype, {
    _getFilterOptions() {
        const options = super._getFilterOptions();
        options.set("UNFISCALIZED", { text: _t("Pendientes por facturar") });
        return options;
    },

    async onFilterSelected(selectedFilter) {
        await super.onFilterSelected(...arguments);
        if (this.state.filter === "UNFISCALIZED") {
            await this._fetchSyncedOrders();
        }
    },

    async onSearch(search) {
        await super.onSearch(...arguments);
        if (this.state.filter === "UNFISCALIZED") {
            this.state.page = 1;
            await this._fetchSyncedOrders();
        }
    },

    async onNextPage() {
        if (this.state.filter !== "UNFISCALIZED") {
            return super.onNextPage(...arguments);
        }
        if (this.state.page < this.getNbrPages()) {
            this.state.page += 1;
            await this._fetchSyncedOrders();
        }
    },

    async onPrevPage() {
        if (this.state.filter !== "UNFISCALIZED") {
            return super.onPrevPage(...arguments);
        }
        if (this.state.page > 1) {
            this.state.page -= 1;
            await this._fetchSyncedOrders();
        }
    },

    async onClickPageNbr() {
        // El popup de "numero por pagina" del core ya llama _fetchSyncedOrders
        // solo si filter == "SYNCED"; para UNFISCALIZED replicamos el fetch
        // despues de que el core actualice this.state.nbrByPage/page.
        await super.onClickPageNbr(...arguments);
        if (this.state.filter === "UNFISCALIZED") {
            await this._fetchSyncedOrders();
        }
    },

    getFilteredOrderList() {
        if (this.state.filter !== "UNFISCALIZED") {
            return super.getFilteredOrderList();
        }
        // Misma lógica que el core usa para "SYNCED": los pedidos ya
        // fueron cargados en this.pos.models["pos.order"] por
        // _fetchSyncedOrders (via _computeSyncedOrdersDomain extendido).
        const orderModel = this.pos.models["pos.order"];
        let orders = orderModel.filter(
            (o) => o.finalized && o.uiState.displayed && !o.mf_invoice_number
        );

        if (this.state.search.searchTerm) {
            const repr = this._getSearchFields()[this.state.search.fieldName].repr;
            orders = orders.filter((o) => repr(o).toLowerCase().includes(
                this.state.search.searchTerm.toLowerCase()
            ));
        }

        orders = orders.sort((a, b) => (b.date_order - a.date_order));

        return orders.slice(
            (this.state.page - 1) * this.state.nbrByPage,
            this.state.page * this.state.nbrByPage
        );
    },

    _computeSyncedOrdersDomain() {
        const domain = super._computeSyncedOrdersDomain();
        if (this.state.filter === "UNFISCALIZED") {
            domain.push(["mf_invoice_number", "=", false]);
        }
        return domain;
    },

    /**
     * Callback invocado por PrintPendingOrderButton tras imprimir con exito.
     * Refresca la lista de "Pendientes por facturar" para que el pedido
     * impreso deje de aparecer en el proximo render.
     * @param {number} orderId - id (pos.order) del pedido impreso
     */
    async onOrderFiscalized(orderId) {
        if (this.state.filter === "UNFISCALIZED") {
            await this._fetchSyncedOrders();
        }
    },
});
