# Migración Web Serial (Máquina Fiscal) — odoo-venezuela-17 → odoo-venezuela-19

Este documento mapea la migración de la implementación **Web Serial API** para
impresoras fiscales The Factory HKA (TFHKA), originalmente desarrollada en:

- **Origen**: `odoo-venezuela` (Odoo 17), rama `feature/pos-mf-web-serial-api`
- **Destino**: `odoo-venezuela` (Odoo 19), rama `MANUEL_19_MF`
- **Protocolo de referencia**: `src/odoo-venezuela-17/module-specs/migration-protocol/MIGRATION_PROTOCOL.md`
- **Specs funcionales de referencia**: `src/odoo-venezuela-17/module-specs/openspec/specs/{l10n_ve_mf_base,l10n_ve_iot_mf,l10n_ve_pos_mf}/spec.md`

> Este README documenta el mapeo de módulos/versiones para esta migración
> específica. No sustituye el protocolo de migración de clientes (que aplica a
> instancias productivas en v17), sino que documenta el trabajo de portar la
> **implementación de código** a la base v19.

## Dependencia previa (resuelta 2026-07-07/08)

`l10n_ve_pos_mf` depende de `l10n_ve_pos`, que estaba en migración propia hacia
APIs de Odoo 19 (ver `l10n_ve_pos/openspec/changes/l10n-ve-pos-migration-plan/`,
slices A-E). Al momento de portar la Fase 3, la base tenía completos Slice A,
Slice B, Slice C1 (Session Accounting Accumulators), Slice C2.1/C2.2 (move
creation parcial) y un hotfix de Slice D (frontend foreign-currency) — suficiente
para desbloquear `l10n_ve_pos_mf` con las adaptaciones descritas más abajo.
Pendiente en la base: Slice C2.3 (cash statement lines), que no bloqueaba la
funcionalidad fiscal en sí.

## Estado por módulo

| Módulo | Origen (v17) | Destino (v19) | Estado | Decisión IoT legacy |
|--------|-------------|----------------|--------|---------------------|
| `l10n_ve_mf_base` | v17.0.1.0.0 | v1.0 (nuevo) | ✅ Completo | N/A (módulo nuevo, sin legacy) |
| `l10n_ve_iot_mf` | v17.0.0.3.0 | v19.0.1.2.0 | ✅ Completo | Reemplazo total: JS IoT Box (`static/src/js/iot_fiscal_machine.js`, `iot_longpolling.js`) eliminado |
| `l10n_ve_pos_mf` | v17.0.2.0.1 | v19.0.3.0.0 | ✅ Completo | Reemplazo total: JS IoT Box (9 archivos) eliminado |

## Fase 1 — `l10n_ve_mf_base` (nuevo módulo, sin dependencias)

Módulo compartido de driver Web Serial puro (sin modelos Python). Copiado
directamente desde v17 sin adaptaciones — los 4 archivos JS son
`@odoo-module` puro sin dependencias de versión Odoo, solo usan
`navigator.serial` (Web API estándar del navegador).

| Archivo | Origen | Cambios |
|---------|--------|---------|
| `static/src/core/SerialConnection.js` | v17 idéntico | Ninguno |
| `static/src/core/FiscalProtocol.js` | v17 idéntico | Ninguno |
| `static/src/core/StatusParser.js` | v17 idéntico | Ninguno |
| `static/src/drivers/TfhkaDriver.js` | v17 idéntico (actualizado 2026-07-07, ver "Actualizaciones posteriores") | Ninguno |
| `__manifest__.py` | Adaptado | `version: "1.0"` (convención v19), resto igual |

### Actualizaciones posteriores (sync con v17, 2026-07-07)

Tras la migración inicial, v17 recibió nuevas mejoras en `TfhkaDriver.js` que se
re-sincronizaron a v19 mediante copia directa del archivo (confirmado por `diff`
que el resto del archivo seguía idéntico, sin drift adicional):

| Cambio | Detalle |
|--------|---------|
| `static MAX_LINE_LEN = 40` | Nueva constante: máximo de caracteres por línea de la TFHKA |
| `_wordWrap(text, maxLen)` | Nuevo método: parte texto en líneas respetando límites de palabra |
| Word-wrap de razón social | En `printInvoice`, `printCreditNote`, `printDebitNote`: el nombre del cliente ahora se envía como `iS*` (primera línea) + líneas `iNN` informativas para el resto, en vez de truncar a 127 caracteres |
| Truncado dinámico de descripción de producto | Calcula el espacio disponible según overhead de precio/cantidad/código antes de truncar (reemplaza `.substring(0,127)` fijo) |
| `_appendHeaderInfo(commands, orderData, startIndex)` | Ahora acepta `startIndex` para que las líneas de header continúen después de las líneas de word-wrap del nombre (antes empezaba siempre en 0) |

Commits de origen en v17: `88ba740b`, `8dedafb6`.

**Spec de referencia** (comportamiento sin cambios entre versiones):
`src/odoo-venezuela-17/module-specs/openspec/specs/l10n_ve_mf_base/spec.md`

## Fase 2 — `l10n_ve_iot_mf` (Facturación/Contabilidad)

| Cambio | Detalle |
|--------|---------|
| **Manifest** | Añadido `l10n_ve_mf_base` a `depends`. Reemplazado asset `static/src/js/*.js` (legacy IoT) por `static/src/backend/*.js` (Web Serial). Añadidos `views/account_tax.xml` (ya existía en disco, faltaba declarar) y `wizards/mf_reports_wizard_views.xml` a `data`. Versión `19.0.1.0.1` → `19.0.1.1.0`. |
| **JS eliminado** (reemplazo total) | `static/src/js/iot_fiscal_machine.js`, `static/src/js/iot_longpolling.js` |
| **JS añadido** (copiado sin cambios desde v17, imports 100% compatibles con Odoo 19) | `static/src/backend/mf_webserial_service.js`, `mf_webserial_button.js`, `mf_fiscalizador_dialog.js`, `mf_debug_menu_item.js`, `mf_systray.js`, `mf_reports_webserial_button.js` |
| **Wizard nuevo** | `wizards/mf_reports_wizard.py` + `mf_reports_wizard_views.xml` (Reporte X/Z, resumen y reimpresión por rango de fecha). Menú bajo `l10n_ve_accountant.account_report_detail_sale_menu` (verificado que existe en v19). |
| **`models/res_company.py`** | Añadido campo `mf_flag_21` (Selection 00/01/02/30). `invoice_print_type` ya existía en v19. |
| **`models/res_config_settings.py`** | Añadido campo relacionado `mf_flag_21`. |
| **`views/res_config_setting_views.xml`** | Añadida sección de configuración para Flag 21. |
| **`views/account_move.xml`** | Widget `iot-mf-button` (IoT Box) → `mf-webserial-button` (Web Serial). Se preservó la estructura v19 (`button_draft` anchor, `list` en vez de `tree`). |
| **`models/account_move.py`** | Migrada lógica completa de v17: helpers `_find_iot_mf_by_serial`, `_mf_persist_vals`, `log_mf_print_failure`, `_get_mf_flag21`; eliminado requisito duro de `iot_mf` asignado (ahora opcional, coherente con impresión directa por navegador); aplicación de descuento de línea antes de enviar a la impresora; lookup de pagos multi-método vía `pos.order` en notas de crédito; guard `mf_invoice_number` en notas de débito (faltaba en v19). **Se preservó** el patrón v19 `invoice_date_display` (no se revirtió a `invoice_date`/`fields.Date.context_today` de v17 — es un campo propio de `l10n_ve_invoice` v19). |
| **Migración de datos** | `migrations/19.0.1.1.0/post-migration.py`: hereda `mf_flag_21` desde `iot.device` legacy. **No incluye** el bloque de limpieza de vista duplicada `fiscal_code` del script v17 (ver Pendientes). |

**Spec de referencia**: `src/odoo-venezuela-17/module-specs/openspec/specs/l10n_ve_iot_mf/spec.md`

### Pendientes / seguimiento (`l10n_ve_iot_mf`)

- **`wizards/accounting_reports.py`** (reporte de libro de ventas, distinto del nuevo `mf_reports_wizard`): v17 añade el campo `all_documents` que combina documentos de forma libre y máquina fiscal en el mismo reporte (usa `mf_invoice_number`/`mf_reportz`/`mf_serial`). **No migrado en esta fase** — es una mejora de reportería tangencial a la conectividad Web Serial en sí. Revisar `l10n_ve_iot_mf/wizards/accounting_reports.py` en v17 vs v19 para portarlo en una fase posterior si se requiere.
- **Traducciones `es_VE.po`**: no se migraron las cadenas nuevas de v17 (wizard, helpers). Pendiente para una pasada de i18n.
- **Limpieza vista `fiscal_code` duplicada**: el script de post-migración v17 incluye un bloque para eliminar `l10n_ve_iot_mf.view_account_tax_form` cuando `l10n_ve_pos_mf` también define `fiscal_code`. En v19, `l10n_ve_pos_mf` **todavía no** tiene esa vista (pendiente Fase 3) — revisar y portar ese bloque cuando se migre `l10n_ve_pos_mf`.

## Fase 3 — `l10n_ve_pos_mf` (POS) — ✅ Completa (2026-07-08)

Migrado completo a Web Serial API. Incluye tanto la base de la Fase 3 original
como la nueva funcionalidad agregada en v17 después de la migración inicial
(pedidos pendientes, filtro "Pendientes por facturar", cierre unificado con
Reporte Z — commits v17 `85f99a43`, `20e99de5`, `d20552ae`, `aa33cab4`).

**Spec de referencia**: `src/odoo-venezuela-17/module-specs/openspec/specs/l10n_ve_pos_mf/spec.md`

### Cambios por archivo

| Archivo | Cambio |
|---------|--------|
| `__manifest__.py` | `depends`: `l10n_ve_mf_base` en vez de `pos_iot`/`l10n_ve_iot_mf`. `assets`: arquitectura completa Web Serial (`utils/`, `overrides/`, `components/`). Añadido `views/account_tax.xml` a `data`. Versión `19.0.3.0.0`. |
| `models/pos_config.py` | Reemplazado por campos directos (`serial_machine`, `flag_21`, `traditional_line`, `has_cashbox`, `enable_auto_sync`, `auto_sync_interval`) en vez de `related` vía `iface_fiscal_data_module` (IoT). |
| `models/pos_session.py` | `serial_machine` relación directa a `config_id` (no vía `iot.device`). Reemplazados los `_loader_params_*` (patrón Odoo 17, ya no funcional tras Slice A) por `_load_pos_data_fields` (añade `report_z`). |
| `models/pos_order.py` | Reemplazados `_order_fields`/`_export_for_ui` (**eliminados de core en Odoo 19** — este código estaba roto) por `_load_pos_data_fields`. Nuevos métodos `write_mf_invoice_data` (propaga datos fiscales a `account.move` al imprimir pedidos pendientes) y `validate_order_dry_run` (savepoint/rollback SQL). `get_order_by_uid` enriquecido con `payment_lines`. |
| `models/account_move.py` | `report_z` con fallback standalone (`_report_z_base`) si `l10n_ve_iot_mf` no está instalado. |
| `models/account_tax.py` (nuevo) | Campo `fiscal_code` + `_load_pos_data_fields` (patrón Odoo 19, mismo estilo que `l10n_ve_pos/models/account_tax.py`). |
| `models/pos_payment_method.py` | Añadido `_load_pos_data_fields` para `code_fiscal_printer` (antes solo declarado, nunca cargado al frontend en Odoo 19). |
| `models/res_config_settings.py` | Reemplazado `iface_fiscal_data_module` (IoT) por `pos_access_button_mf`/`message_in_head` directos. |
| `views/*.xml` | Todas migradas a campos directos (sin `iface_fiscal_data_module`). `account_tax.xml` nuevo (campo `fiscal_code` con label descriptivo — ver nota de vista duplicada abajo). |

### JS — arquitectura Web Serial completa

| Directorio | Archivos | Detalle |
|------------|----------|---------|
| `static/src/utils/` (nuevo) | `LocalOrderBuffer.js`, `LocalOrderHistory.js` | Copiados sin cambios (sin dependencias de core POS). `LocalOrderHistory.js` sí requirió fix: `order.paymentlines`→`payment_ids`, `payment_method`→`payment_method_id`. |
| `static/src/overrides/` (nuevo) | `PosStore.js`, `DebugWidget.js`, `TicketScreen.js`, `pos_app.js` | Ver tabla de mapeo de API abajo. `pos_app.js` no requirió cambios de API (solo jQuery/DOM + driver). |
| `static/src/components/` (nuevo) | `FiscalDebugger/`, `FiscalReports/`, `InfoPopup/`, `PrintPendingOrderButton/` | Migrados de `AbstractAwaitablePopup`/servicio `popup` (**eliminados en Odoo 19**) al patrón `Dialog` + servicio `dialog` (mismo patrón que `l10n_ve_iot_mf/static/src/backend/mf_fiscalizador_dialog.js`, ya validado). |
| `static/src/js/` | `ClosePosPopup.js`, `OrderState.js`, `ReprintInvoiceButton.js` | Reescritos (ver detalle Cierre de sesión abajo). |
| `static/src/js/` (**eliminado**, reemplazo total) | `PosState.js`, `FiscalMachinePopup.js`, `Navbar.js`, `DebugWidget.js`, `iotLongpolling.js` | JS IoT Box legacy. |

### Tabla de mapeo de API v17 → Odoo 19 aplicada

Aplicada en `PosStore.js`, `ClosePosPopup.js`, `ReprintInvoiceButton.js`,
`DebugWidget.js`, `OrderState.js`, `LocalOrderHistory.js`. Fuente: tabla
canónica ya documentada por el equipo de `l10n_ve_pos` en
`openspec/changes/l10n-ve-pos-migration-plan/apply-progress.md` (sección
"Odoo 19 API changes reference"), extendida con hallazgos propios:

| v17 | Odoo 19 | Verificado en |
|-----|---------|---------------|
| `order.get_total_with_tax()` | `order.totalDue` (getter) | `pos_order_accounting.js:166` |
| `order.get_partner()` | `order.getPartner()` | `pos_order.js:600` |
| `order.is_paid_with_cash()` | `order.isPaidWithCash()` | `pos_order.js:567` |
| `order.uid` | `order.uuid` | `pos_order.js` (campo related_models) |
| `order.orderlines` / `.paymentlines` | `order.lines` / `order.payment_ids` (colecciones directas) | `pos_order.js` |
| `order.orderlines.remove(line)` | `order.removeOrderline(line)` | `pos_order.js:419` |
| `line.get_discount()` / `get_product()` | `line.getDiscount()` / `getProduct()` | `pos_order_line.js:467,504` |
| `line.product` / `line.quantity` | `line.product_id` / `line.qty` | `pos_order_line.js` |
| `line.payment_method` | `line.payment_method_id` | Campo Many2one directo |
| `line.customerNote` | `line.customer_note` / `getCustomerNote()` | `pos_order_line.js:414,418` |
| `this.get_cashier()` | `this.getCashier()` | `pos_store.js:1334` |
| `push_single_order(order, opts)` | `pushSingleOrder(order)` (firma sin `opts`) | `pos_store.js:1641` |
| Refund tracking: dict global `toRefundLines` | Relación directa `line.refunded_orderline_id` (Many2one a la línea original) | `pos_order.js:419-423`, `pos_store.js:584-597` |
| Import `@point_of_sale/app/store/pos_store` | `@point_of_sale/app/services/pos_store` | — |
| Import `@point_of_sale/app/store/pos_hook` | `@point_of_sale/app/hooks/pos_hook` | — |
| Import `@point_of_sale/app/debug/debug_widget` | `@point_of_sale/app/utils/debug/debug_widget` | — |
| Import `@point_of_sale/app/navbar/closing_popup/closing_popup` | `@point_of_sale/app/components/popups/closing_popup/closing_popup` | — |
| Import `@point_of_sale/app/errors/popups/error_popup` (`ErrorPopup`) | `@web/core/confirmation_dialog/confirmation_dialog` (`AlertDialog`) | Servicio `dialog`, no `popup` |
| Import `@point_of_sale/app/utils/confirm_popup/confirm_popup` (`ConfirmPopup`) | `@web/core/confirmation_dialog/confirmation_dialog` (`ConfirmationDialog`) | Callbacks `confirm`/`cancel`, no `{confirmed}` awaited |
| `AbstractAwaitablePopup` (base de popups custom) | `Component` + `Dialog` (composición) | Patrón ya usado en `mf_fiscalizador_dialog.js` |

### Cierre de sesión: envoltura de `confirm()` en vez de reemplazo de botón

Diferencia arquitectónica clave respecto a v17: en v17, `ClosePosPopup`
reemplazaba el botón nativo "Close Session" por uno propio que llamaba
`this.closeSession()` **directamente**, saltándose la conciliación de caja
nativa. En Odoo 19, el botón nativo ya invoca `confirm()`, que SÍ maneja la
diferencia de caja correctamente (diálogo de autorización, etc.) antes de
llamar a `closeSession()` internamente.

En vez de replicar el bypass de v17 (que hubiera sido una regresión), se
**envolvió** `confirm()`:
1. Verifica pedidos sin `mf_invoice_number` en la sesión → si hay, bloquea y
   redirige a `TicketScreen` con el filtro "Pendientes por facturar".
2. Si todos facturados y el Reporte Z de la sesión aún no se generó
   (`pos.session.report_z`), lo imprime y sincroniza.
3. Delega en `super.confirm()` para la conciliación de caja nativa +
   `closeSession()`.

### Filtro "Pendientes por facturar" en TicketScreen

Odoo 19 gatea el fetch/paginación backend de `TicketScreen` con comparaciones
explícitas `this.state.filter === "SYNCED"` en varios métodos del core
(`onFilterSelected`, `onSearch`, `onNextPage`, `onPrevPage`,
`onClickPageNbr`, `getFilteredOrderList`) — no existe un hook genérico "es un
filtro de tipo backend-fetch". Se replicaron esos overrides agregando la
condición `this.state.filter === "UNFISCALIZED"` en cada uno, en vez de
intentar generalizar el core.

### Vista duplicada `fiscal_code` en `account.tax` (resuelto)

`l10n_ve_iot_mf` (Fase 2) y `l10n_ve_pos_mf` (Fase 3) declaraban ambos una
vista sobre `account.view_tax_form` insertando el campo `fiscal_code` en el
mismo `xpath`. Siguiendo el mismo fix ya aplicado en v17
(`l10n_ve_iot_mf/migrations/17.0.0.3.0/post-migration.py`, ver
`MIGRATION_PROTOCOL.md` "Hallazgo #4"):
- Se **eliminó** `l10n_ve_iot_mf/views/account_tax.xml` (label genérico).
- Se **mantuvo** `l10n_ve_pos_mf/views/account_tax.xml` (label descriptivo:
  "Código Fiscal (Máquina Fiscal)").
- Se agregó `l10n_ve_iot_mf/migrations/19.0.1.2.0/post-migration.py` para
  limpiar la vista huérfana en instalaciones existentes (bump de versión
  `19.0.1.1.0` → `19.0.1.2.0`).

### Pendientes / seguimiento (`l10n_ve_pos_mf`)

- **Traducciones `es_VE.po`**: no se migraron cadenas nuevas.
- **QUnit tests** (`static/src/tests/tfhka_driver_tests.js`, `MockSerialConnection.js`):
  sintaxis válida y sin dependencias de API renombrada (prueban el driver puro,
  no interactúan con `pos.order`), pero no se ejecutaron vía test-runner en
  esta sesión — pendiente correrlos con `--test-tags` cuando se valide con
  hardware.
- **Validación funcional con hardware TFHKA real**: pendiente (requiere
  Chrome/Edge + impresora conectada), ver checklist funcional en
  `MIGRATION_PROTOCOL.md` sección 6.3.
- **Slice C2.3** (cash statement lines) de la base `l10n_ve_pos`: aún pendiente
  en el otro programador; no bloqueaba la funcionalidad fiscal, pero conviene
  revalidar `l10n_ve_pos_mf` cuando se complete por si afecta el flujo de
  cierre de sesión (conciliación de caja).

## Validación

Ambiente de desarrollo: instancia `odoo19` en `instances.json` (raíz de
`docker-odoo-pos`), apuntando a `src/enterprise-19.0`, `src/odoo-venezuela-19`,
`src/integra-addons-19`. Contenedor `odoo-odoo19` (puerto 8119), bases de datos
disponibles: `bd19`, `bin_19_prod`, `coverage_19` (contenedor `db-pg16_19`).

### Resultado de validación ejecutada

| Módulo | Resultado |
|--------|-----------|
| `l10n_ve_mf_base` | ✅ **Instalado correctamente** en `bd19`. Sin dependencias problemáticas. |
| `l10n_ve_iot_mf` | ✅ **Instalado correctamente** en `bd19`. Cadena completa de dependencias instalada satisfactoriamente (141 módulos). |
| `l10n_ve_pos` | ✅ **Instalado correctamente** en `bd19` (152 módulos) — confirma que el merge con los avances de la base POS (Slice C1/C2.1/C2.2) es estable. |
| `l10n_ve_pos_mf` | ✅ **Instalado correctamente** en `bd19` (153 módulos). Bundle JS de `point_of_sale._assets_pos` compiló sin errores (4.5MB, contiene `MAX_LINE_LEN`, `getFiscalPrinter`). Bundle QWeb compiló sin errores (contiene `PrintPendingOrderButton`, `FiscalDebuggerPopup`, overrides de `TicketScreen`/`ClosePosPopup`). |

> **Nota**: La instalación requirió asegurar que `src/third-party-addons` esté en la rama
> `19.0` (contiene `account_invoice_pricelist` + `account_invoice_pricelist_sale`).
> Por defecto estaba en `main`, que no tiene estos módulos. Ver `instances.json` —
> la instancia `odoo19` no lista `third-party-addons` en sus `addons`, pero el
> contenedor lo monta de todas formas (vía configuración global de docker-odoo-pos).

### Checklist técnico

- [x] `l10n_ve_mf_base` instala sin errores
- [x] `l10n_ve_iot_mf` instala sin errores
- [x] `l10n_ve_pos` instala sin errores (post-merge con avances de la base)
- [x] `l10n_ve_pos_mf` instala sin errores
- [x] `Registry loaded` sin `CRITICAL` en el log (153 módulos)
- [x] Bundle JS de `web.assets_backend` y `point_of_sale._assets_pos` compilan sin excepción
- [x] Bundle QWeb de `point_of_sale._assets_pos` compila sin excepción
- [ ] `mf_flag_21` visible en Ajustes → Facturación (validar vía UI)
- [ ] Botones Web Serial visibles en header de facturas validadas — requiere Chrome/Edge
- [ ] Fiscalizador accesible desde Developer Tools (`?debug=1`) — Facturación y POS
- [ ] Wizard "Reportes Máquina Fiscal" accesible desde Detalle de Ventas
- [ ] Systray muestra icono de conexión (gris = desconectado sin hardware)
- [ ] POS: conectar impresora, imprimir factura/NC, Reporte X/Z, pedidos pendientes
- [ ] Cierre de sesión POS: validación de pedidos sin facturar + Reporte Z + conciliación de caja nativa

Ver checklist funcional completo (requiere hardware TFHKA conectado) en la
sección 6.3 del `MIGRATION_PROTOCOL.md` referenciado arriba.
