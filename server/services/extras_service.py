# server/services/extras_service.py
from __future__ import annotations

import time
from typing import Dict

from server.config import CONFIG
from server.db import Database
from server.services.extras_token import create_extras_token


class ExtrasService:
    """
    Servicio responsable del modo EXTRAS (operador avanzado).
    - Usa CONFIG.extra_key (hardcodeada)
    - Emite token firmado con rid embebido
    """

    def __init__(self, db: Database):
        self.db = db

    # -------------------------
    # Elevate extras
    # -------------------------
    def elevate(self, registro_turno_id: int, extras_key: str) -> Dict[str, str]:
        """
        Valida clave extras y genera token.

        Raises:
          ValueError("RID_NOT_FOUND")
          ValueError("EXTRAS_KEY_INVALID")
        """
        # 1) validar registro_turno existe
        row = self.db.query_one(
            "SELECT id FROM registro_turno WHERE id = ?;",
            (registro_turno_id,),
        )
        if not row:
            raise ValueError("RID_NOT_FOUND")

        # 2) validar clave extras
        if extras_key != CONFIG.extra_key:
            raise ValueError("EXTRAS_KEY_INVALID")

        # 3) emitir token
        # formato: v1.<rid>.<iat>.<nonce>.<sig>
        issued_at = int(time.time())
        token = create_extras_token(
            registro_turno_id=registro_turno_id,
            secret=CONFIG.extra_key,
            issued_at=issued_at,
        )

        return {
            "token": token,
        }
