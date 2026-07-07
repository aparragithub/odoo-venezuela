import logging

_logger = logging.getLogger(__name__)


def migrate(cr, version):
    """Corte IoT -> Web Serial en impresión fiscal desde Facturación.

    - Puebla res_company.mf_flag_21 desde el dispositivo fiscal IoT existente
      (si lo hay), para que la impresión Web Serial conserve el formato
      numérico (Flag 21) que ya usaba el cliente.

    Migrado desde odoo-venezuela-17 l10n_ve_iot_mf/migrations/17.0.0.3.0/post-migration.py
    (rama feature/pos-mf-web-serial-api). El bloque de limpieza de la vista
    duplicada `fiscal_code` (Hallazgo v17) NO se incluye aquí: en esta versión
    l10n_ve_pos_mf todavía no tiene su propia vista de `fiscal_code` (pendiente
    Fase 3 de la migración, ver MIGRATION_README.md). Revisar y portar ese
    bloque cuando l10n_ve_pos_mf sea migrado.
    """
    # 1. Asegurar default en compañías sin valor
    cr.execute("UPDATE res_company SET mf_flag_21 = '00' WHERE mf_flag_21 IS NULL")

    # 2. Si existe un dispositivo fiscal IoT con flag_21 configurado, heredarlo
    cr.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables WHERE table_name = 'iot_device'
        )
        """
    )
    if cr.fetchone()[0]:
        cr.execute(
            """
            SELECT flag_21
            FROM iot_device
            WHERE type = 'fiscal_data_module' AND flag_21 IS NOT NULL
            ORDER BY id DESC
            LIMIT 1
            """
        )
        row = cr.fetchone()
        if row and row[0]:
            cr.execute("UPDATE res_company SET mf_flag_21 = %s", (row[0],))
            _logger.info(
                "l10n_ve_iot_mf: mf_flag_21 heredado desde iot.device legacy (%s)", row[0]
            )
