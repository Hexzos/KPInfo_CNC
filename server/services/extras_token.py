# server/services/extras_token.py
from __future__ import annotations

import hmac
import hashlib
import secrets
import time


TOKEN_VERSION = "v1"
NONCE_LEN = 8  # bytes (hex = 16 chars)
MAX_AGE_SECONDS = 12 * 60 * 60  # 12 horas


# -------------------------------------------------
# Token helpers
# -------------------------------------------------
def _sign(payload: str, secret: str) -> str:
    """
    Firma HMAC-SHA256, retorna hex string.
    """
    return hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


# -------------------------------------------------
# Public API
# -------------------------------------------------
def create_extras_token(
    *,
    registro_turno_id: int,
    secret: str,
    issued_at: int | None = None,
) -> str:
    """
    Crea token extras firmado.

    payload base (sin firma):
      v1.<rid>.<iat>.<nonce>
    """
    if issued_at is None:
        issued_at = int(time.time())

    nonce = secrets.token_hex(NONCE_LEN)
    payload = f"{TOKEN_VERSION}.{registro_turno_id}.{issued_at}.{nonce}"
    sig = _sign(payload, secret)

    return f"{payload}.{sig}"


def validate_extras_token(token: str, secret: str) -> bool:
    """
    Valida:
    - formato
    - versión
    - firma
    - expiración
    """
    try:
        parts = token.split(".")
        if len(parts) != 5:
            return False

        version, rid_s, iat_s, nonce, sig = parts

        if version != TOKEN_VERSION:
            return False

        rid = int(rid_s)
        if rid <= 0:
            return False

        issued_at = int(iat_s)

        # expiración
        now = int(time.time())
        if issued_at > now + 30:
            # token emitido "en el futuro"
            return False

        if now - issued_at > MAX_AGE_SECONDS:
            return False

        # validar firma
        payload = f"{version}.{rid}.{issued_at}.{nonce}"
        expected_sig = _sign(payload, secret)

        return hmac.compare_digest(expected_sig, sig)

    except Exception:
        return False
