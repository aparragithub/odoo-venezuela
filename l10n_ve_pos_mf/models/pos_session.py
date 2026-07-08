from odoo import models, fields, api, _


class PosSession(models.Model):
    _inherit = "pos.session"

    serial_machine = fields.Char(related="config_id.serial_machine")
    report_z = fields.Char()

    def set_report_z(self, values):
        self.write({"report_z": int(values["data"]["_dailyClosureCounter"]) + 1})

    @api.model
    def _load_pos_data_fields(self, config):
        """Odoo 19 loader contract: pos.session tiene whitelist explícita en
        core (point_of_sale/models/pos_session.py). Añadimos ``report_z``
        para que el frontend pueda leer el último reporte Z conocido.
        ``serial_machine`` es un related a config_id, ya expuesto ahí.
        """
        res = super()._load_pos_data_fields(config)
        if "report_z" not in res:
            res.append("report_z")
        return res
