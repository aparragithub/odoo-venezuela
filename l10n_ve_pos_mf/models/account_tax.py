# -*- coding: utf-8 -*-
from odoo import api, models, fields


class AccountTaxInherit(models.Model):
    _inherit = "account.tax"

    fiscal_code = fields.Integer(
        string="Código Fiscal (MF)",
        default=0,
        help="Código para la máquina fiscal TFHKA: 0=Exento, 1=IVA General, 2=IVA Reducido, 3=IVA Adicional"
    )

    @api.model
    def _load_pos_data_fields(self, config):
        """Odoo 19 loader contract: incluir ``fiscal_code`` para que el driver
        Web Serial (TfhkaDriver) pueda mapear cada línea de la orden al
        código fiscal correspondiente en la impresora TFHKA.
        """
        res = super()._load_pos_data_fields(config)
        if "fiscal_code" not in res:
            res.append("fiscal_code")
        return res
