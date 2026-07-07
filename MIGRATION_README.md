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

## Dependencia previa

`l10n_ve_pos_mf` depende de `l10n_ve_pos`, que está en migración propia hacia
APIs de Odoo 19 (ver `l10n_ve_pos/openspec/changes/l10n-ve-pos-migration-plan/`,
slices A-E). La migración de `l10n_ve_pos_mf` (Fase 3 de este trabajo) está
**bloqueada** hasta que esa migración base complete los Slices C (Session
Accounting), D (Frontend) y E (Verificación).

## Estado por módulo

| Módulo | Origen (v17) | Destino (v19) | Estado | Decisión IoT legacy |
|--------|-------------|----------------|--------|---------------------|
| `l10n_ve_mf_base` | v17.0.1.0.0 | v1.0 (nuevo) | ✅ Completo | N/A (módulo nuevo, sin legacy) |
| `l10n_ve_iot_mf` | v17.0.0.3.0 | v19.0.1.1.0 | ✅ Completo | Reemplazo total: JS IoT Box (`static/src/js/iot_fiscal_machine.js`, `iot_longpolling.js`) eliminado |
| `l10n_ve_pos_mf` | v17.0.2.0.1 | — | ⏸ Bloqueado (espera migración base `l10n_ve_pos`) | Pendiente: reemplazo total planificado |

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
| `static/src/drivers/TfhkaDriver.js` | v17 idéntico | Ninguno |
| `__manifest__.py` | Adaptado | `version: "1.0"` (convención v19), resto igual |

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

## Fase 3 — `l10n_ve_pos_mf` (POS) — BLOQUEADA

Pendiente de que la migración base de `l10n_ve_pos` (Slices C/D/E, ver
`l10n_ve_pos/openspec/changes/l10n-ve-pos-migration-plan/apply-progress.md`)
esté completa. Plan de trabajo cuando se desbloquee:

- Añadir `l10n_ve_mf_base` a `depends` (evaluar si `pos_iot` se retira).
- Copiar JS Web Serial desde v17: `static/src/utils/{LocalOrderBuffer,LocalOrderHistory}.js`,
  `static/src/overrides/{PosStore,DebugWidget,TicketScreen,pos_app}.js`,
  `static/src/components/{FiscalDebugger,FiscalReports,InfoPopup}/*`.
- Adaptar `patch(PosStore.prototype)` añadiendo `setup(...args) { super.setup(...args); ... }`
  (v19 requiere este hook para inicializar servicios; confirmado en `PosState.js` actual de v19).
- Eliminar JS IoT legacy: `PosState.js`, `FiscalMachinePopup.js`, `Navbar.js`,
  `DebugWidget.js`, `OrderState.js`, `ClosePosPopup.js`, `ReprintInvoiceButton.js`,
  `iotLongpolling.js`, `PosState.js` (reemplazo total, según decisión de este trabajo).
  Confirmar en ese momento si `l10n_ve_iot_mf`'s `fiscal_code` view debe migrar a `l10n_ve_pos_mf`.
- Revisar/crear campos en `pos.config` (`serial_machine`, `flag_21`, `has_cashbox`,
  `enable_auto_sync`) y reemplazar vista legacy `pos_config_view_form_inherit`.

**Spec de referencia**: `src/odoo-venezuela-17/module-specs/openspec/specs/l10n_ve_pos_mf/spec.md`

## Validación

Ambiente de desarrollo: instancia `odoo19` en `instances.json` (raíz de
`docker-odoo-pos`), apuntando a `src/enterprise-19.0`, `src/odoo-venezuela-19`,
`src/integra-addons-19`. Contenedor `odoo-odoo19` (puerto 8119), bases de datos
disponibles: `bd19`, `bin_19_prod`, `coverage_19` (contenedor `db-pg16_19`).

### Resultado de validación ejecutada

| Módulo | Resultado |
|--------|-----------|
| `l10n_ve_mf_base` | ✅ **Instalado correctamente** en `bd19` (`odoo -i l10n_ve_mf_base`). Sin dependencias problemáticas — confirma que los 4 JS drivers y el manifest son válidos. |
| `l10n_ve_iot_mf` | ⚠️ **Instalación bloqueada por issue preexistente del ambiente**, no relacionado a esta migración (ver abajo). Validación estructural (parseo de manifest, escaneo de módulos, permisos `button_install`) exitosa. |

### Issue preexistente que bloquea instalación completa (fuera de alcance de esta migración)

Al instalar `l10n_ve_iot_mf` (cadena `l10n_ve_invoice` → `l10n_ve_accountant`),
Odoo falla con:

```
odoo.exceptions.UserError: Está intentando instalar el módulo "l10n_ve_accountant"
que depende del módulo "account_invoice_pricelist".
Este último módulo no está disponible en su sistema.
```

**Causa raíz**: `l10n_ve_accountant/__manifest__.py` y `l10n_ve_price_list/__manifest__.py`
declaran depender de `account_invoice_pricelist`, pero el módulo real presente en
`integra-addons-19` se llama `binaural_invoice_pricelist` (confirmado en
`src/integra-addons-19/binaural_invoice_pricelist/__manifest__.py`). Es un
desajuste de nombre preexistente, anterior a este trabajo — afecta a **cualquier**
instalación fresca de `l10n_ve_invoice`/`l10n_ve_accountant`/`l10n_ve_tax_payer`/
`l10n_ve_stock_account`/`l10n_ve_pos`, no solo a los módulos de esta migración.
Confirmado con `git log` que el manifest de `l10n_ve_accountant` no fue tocado
por este trabajo.

**No se corrigió aquí** para no interferir con el trabajo en curso de otro
programador sobre `l10n_ve_accountant`/`l10n_ve_pos` en esta misma rama. Reportar
al equipo para decidir si se renombra la dependencia o se crea un módulo puente.

**Impacto en esta migración**: no permite verificar instalación end-to-end de
`l10n_ve_iot_mf` en las bases de datos actuales (`bd19`, `bin_19_prod`,
`coverage_19` — las 3 tienen el mismo gap). En cuanto se resuelva, repetir:
```bash
docker exec odoo-odoo19 odoo --stop-after-init --http-port=8169 -d bd19 -i l10n_ve_mf_base -i l10n_ve_iot_mf
```

### Checklist técnico (pendiente de completar cuando se resuelva el gap de dependencias)

- [x] `l10n_ve_mf_base` instala sin errores
- [ ] `l10n_ve_iot_mf` instala sin errores (bloqueado, ver arriba)
- [ ] `Registry loaded` sin `CRITICAL` en el log
- [ ] `mf_flag_21` visible en Ajustes → Facturación
- [ ] Botones Web Serial visibles en header de facturas validadas (Chrome/Edge)
- [ ] Fiscalizador accesible desde Developer Tools (`?debug=1`)
- [ ] Wizard "Reportes Máquina Fiscal" accesible desde Detalle de Ventas
- [ ] Systray muestra icono de conexión (gris = desconectado sin hardware)

Ver checklist funcional completo (requiere hardware TFHKA conectado) en la
sección 6.3 del `MIGRATION_PROTOCOL.md` referenciado arriba.
