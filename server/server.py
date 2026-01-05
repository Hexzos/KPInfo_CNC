# server/server.py
from http.server import HTTPServer
from pathlib import Path

from server.config import CONFIG
from server.http.app_handler import AppHandler
from server.http.seed import seed_catalogos


def load_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def main():
    schema = load_text(CONFIG.schema_path)
    AppHandler.db.init_schema(schema)
    seed_catalogos(AppHandler.db)

    server = HTTPServer((CONFIG.host, CONFIG.port), AppHandler)

    print(f"Servidor iniciado en http://{CONFIG.host}:{CONFIG.port}")
    print("Login: POST /api/registro-turno/iniciar (operador/admin)")
    print("Extras: POST /api/extras/elevate (alias compat: POST /api/admin/elevate)")
    print("Admin: GET /api/admin/status")
    print("Admin: POST /api/admin/purge/*  (requiere X-Admin-Key + X-Extras-Token)")
    print("Admin: POST /api/admin/extras-key/rotate (requiere X-Admin-Key)")
    print(
        "Pedidos: GET /api/pedidos | GET /api/pedidos/<id> | POST /api/pedidos/<id>/actualizar | "
        "POST /api/pedidos/<id>/archivar | POST /api/pedidos/<id>/restaurar"
    )
    print(
        "Anomalías: GET /api/anomalias | GET /api/anomalias/<id> | POST /api/anomalias/<id>/actualizar | "
        "POST /api/anomalias/<id>/archivar | POST /api/anomalias/<id>/restaurar"
    )
    print("Export: GET /api/export/pedidos.csv?desde=YYYY-MM-DD&hasta=YYYY-MM-DD")
    print("Export: GET /api/export/anomalias.csv?desde=YYYY-MM-DD&hasta=YYYY-MM-DD")

    server.serve_forever()


if __name__ == "__main__":
    main()
