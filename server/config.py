# server/config.py
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=False)  # <-- CAMBIO MÍNIMO: permitir rotar claves en runtime
class Config:
    host: str = "127.0.0.1"
    port: int = 8000
    db_path: Path = BASE_DIR / "data" / "cnc.sqlite3"
    schema_path: Path = BASE_DIR / "server" / "schema.sql"
    web_root: Path = BASE_DIR / "web"

    # ==========================================================
    # EXTRAS (legacy funcional)
    # ==========================================================
    extra_key: str = "operadorCNC.1234"

    # ==========================================================
    # ADMIN REAL (panel)
    # Requiere: admin_key + usuario + contraseña
    # ==========================================================
    admin_key: str = "AdminPanel.2026"
    admin_username: str = "admin"

    # Hash PBKDF2 (sha256) formato:
    # pbkdf2_sha256$<iters>$<salt_hex>$<hash_hex>
    # Password por defecto para este hash: adminCNC.1234
    admin_password_hash: str = (
        "pbkdf2_sha256$200000$01010101010101010101010101010101$"
        "7227409565b7b96510ec33e91ee8fed9ce1aaa25edd0fc9ae79f0b70df189e6e"
    )


CONFIG = Config()
