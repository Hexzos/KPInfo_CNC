# server/http/mixins.py
import mimetypes
from pathlib import Path
from typing import Optional

from server.config import CONFIG
from server.services.extras_token import validate_extras_token
from server.utils.http_utils import send_json, err


class HandlerHelpersMixin:
    def _parse_pos_int(self, value: str) -> int:
        try:
            n = int(value)
            if n <= 0:
                raise ValueError()
            return n
        except Exception:
            raise ValueError("ID_INVALID")

    def _send_csv(self, content: bytes, filename: str):
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def serve_static(self, path: str):
        if path in ("", "/"):
            path = "/index.html"

        safe_path = (CONFIG.web_root / path.lstrip("/")).resolve()

        if not str(safe_path).startswith(str(CONFIG.web_root.resolve())):
            return send_json(self, 403, err("FORBIDDEN", "Acceso denegado."))

        if not safe_path.exists() or safe_path.is_dir():
            return send_json(self, 404, err("NOT_FOUND", "Archivo no encontrado."))

        ctype, _ = mimetypes.guess_type(str(safe_path))
        ctype = ctype or "application/octet-stream"
        body = safe_path.read_bytes()

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class ExtrasAuthMixin:
    """
    Extras se valida vía token firmado (X-Extras-Token / compat X-Admin-Token).
    """
    def _get_extras_token(self) -> str:
        token = (self.headers.get("X-Extras-Token") or "").strip()
        if token:
            return token
        return (self.headers.get("X-Admin-Token") or "").strip()

    def _get_extras_rid_if_any(self) -> Optional[int]:
        token = self._get_extras_token()
        if not token:
            return None
        if not validate_extras_token(token, CONFIG.extra_key):
            return None
        try:
            parts = token.split(".")  # v1.<rid>.<iat>.<nonce>.<sig>
            rid = int(parts[1])
            return rid if rid > 0 else None
        except Exception:
            return None

    def _require_extras(self) -> int:
        token = self._get_extras_token()
        if not token:
            raise PermissionError("EXTRAS_REQUIRED")

        if not validate_extras_token(token, CONFIG.extra_key):
            raise PermissionError("EXTRAS_INVALID")

        try:
            rid = int(token.split(".")[1])
            if rid <= 0:
                raise ValueError()
            return rid
        except Exception:
            raise PermissionError("EXTRAS_INVALID")

    def _handle_extras_guard(self) -> Optional[int]:
        try:
            return self._require_extras()
        except PermissionError as pe:
            code = str(pe)
            if code == "EXTRAS_REQUIRED":
                send_json(self, 401, err("EXTRAS_REQUIRED", "Se requiere modo extras."))
                return None
            send_json(self, 403, err("EXTRAS_INVALID", "Token de extras inválido."))
            return None

    def _extras_audit(self, registro_turno_id: int, accion: str, entidad: str, entidad_id: Optional[int], detalle: str):
        try:
            self.db.execute(
                """
                INSERT INTO log_admin (registro_turno_id, accion, entidad, entidad_id, detalle)
                VALUES (?, ?, ?, ?, ?);
                """,
                (registro_turno_id, accion, entidad, entidad_id, detalle),
            )
        except Exception:
            pass


class AdminAuthMixin:
    """
    Admin panel se valida con header X-Admin-Key (derivado del login admin).
    Cambios mínimos: no guardamos sesión server-side, solo comparamos contra CONFIG.admin_key.
    """
    def _get_admin_key(self) -> str:
        return (self.headers.get("X-Admin-Key") or "").strip()

    def _require_admin(self) -> None:
        k = self._get_admin_key()
        if not k:
            raise PermissionError("ADMIN_REQUIRED")
        if k != CONFIG.admin_key:
            raise PermissionError("ADMIN_INVALID")

    def _handle_admin_guard(self) -> bool:
        try:
            self._require_admin()
            return True
        except PermissionError as pe:
            code = str(pe)
            if code == "ADMIN_REQUIRED":
                send_json(self, 401, err("ADMIN_REQUIRED", "Se requiere acceso administrador."))
                return False
            send_json(self, 403, err("ADMIN_INVALID", "Credencial administrador inválida."))
            return False
