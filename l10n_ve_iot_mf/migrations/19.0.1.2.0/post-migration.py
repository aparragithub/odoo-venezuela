import logging

_logger = logging.getLogger(__name__)


def migrate(cr, version):
    """Limpia la vista duplicada de `fiscal_code` en account.tax.

    `l10n_ve_iot_mf` y `l10n_ve_pos_mf` insertaban ambos el campo `fiscal_code`
    en la misma posición del formulario de impuestos (account.view_tax_form),
    causando que el campo apareciera dos veces en la UI cuando ambos módulos
    estaban instalados (l10n_ve_pos_mf ya migrado a Web Serial, Fase 3). Se
    eliminó `views/account_tax.xml` de `l10n_ve_iot_mf` (se conserva la de
    `l10n_ve_pos_mf`, que tiene un label más descriptivo:
    "Código Fiscal (Máquina Fiscal)").

    Migrado desde el mismo fix aplicado en odoo-venezuela-17
    (l10n_ve_iot_mf/migrations/17.0.0.3.0/post-migration.py, ver
    MIGRATION_PROTOCOL.md sección "Hallazgo #4").

    NOTA: ir_model_data NO tiene FK en cascada hacia ir_ui_view (es una
    tabla genérica de mapeo XML ID -> cualquier modelo), por lo que hay
    que eliminar explícitamente ambas filas.
    """
    cr.execute(
        """
        SELECT v.id
        FROM ir_ui_view v
        JOIN ir_model_data d ON d.model = 'ir.ui.view' AND d.res_id = v.id
        WHERE d.module = 'l10n_ve_iot_mf' AND d.name = 'view_account_tax_form'
        """
    )
    row = cr.fetchone()
    if row:
        view_id = row[0]
        cr.execute(
            """
            DELETE FROM ir_model_data
            WHERE model = 'ir.ui.view' AND res_id = %s
              AND module = 'l10n_ve_iot_mf' AND name = 'view_account_tax_form'
            """,
            (view_id,),
        )
        cr.execute("DELETE FROM ir_ui_view WHERE id = %s", (view_id,))
        _logger.info(
            "l10n_ve_iot_mf: eliminada vista duplicada view_account_tax_form (id=%s) - "
            "fiscal_code ya lo provee l10n_ve_pos_mf",
            view_id,
        )
