# server/http/app_handler.py
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

from server.config import CONFIG
from server.db import Database
from server.services.catalogos_service import CatalogoService
from server.services.sesion_service import SesionService
from server.services.pedidos_service import PedidosService
from server.services.anomalias_service import AnomaliasService
from server.services.export_service import ExportService
from server.services.extras_service import ExtrasService

from server.http.mixins import HandlerHelpersMixin, ExtrasAuthMixin, AdminAuthMixin
from server.http.api_get import ApiGetMixin
from server.http.api_post import ApiPostMixin
from server.utils.http_utils import send_json, err


class AppHandler(
    BaseHTTPRequestHandler,
    HandlerHelpersMixin,
    ExtrasAuthMixin,
    AdminAuthMixin,
    ApiGetMixin,
    ApiPostMixin,
):
    # Servicios compartidos (como lo tenías)
    db = Database(CONFIG.db_path)
    catalogos = CatalogoService(db)
    sesion = SesionService(db)
    pedidos = PedidosService(db)
    anomalias = AnomaliasService(db)
    export = ExportService(db)
    extras = ExtrasService(db)

    def log_message(self, format, *args):
        return

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            return self.handle_api_get(parsed)
        return self.serve_static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            return self.handle_api_post(parsed)
        return send_json(self, 404, err("NOT_FOUND", "Recurso no encontrado."))
