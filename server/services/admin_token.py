# server/services/admin_token.py
from __future__ import annotations

import hmac
import hashlib
import secrets
import time


TOKEN_VERSION = "v1"
NONCE_LEN = 8  # bytes (hex => 16 chars)
MAX_AGE_SECONDS = 2 * 60 * 60  # 2 horas (admin)


def _sign(payload: str, secret: str) -> str:
    return hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_admin_token(*, secret: str, issued_at: int | None = None) -> str:
    """
    Token admin firmado.
      v1.<iat>.<nonce>.<sig>
    """
    if issued_at is None:
        issued_at = int(time.time())

    nonce = secrets.token_hex(NONCE_LEN)
    payload = f"{TOKEN_VERSION}.{issued_at}.{nonce}"
    sig = _sign(payload, secret)
    return f"{payload}.{sig}"


def validate_admin_token(token: str, secret: str) -> bool:
    """
    Valida formato, versión, firma y expiración.
    """
    try:
        parts = token.split(".")
        if len(parts) != 4:
            return False

        version, iat_s, nonce, sig = parts
        if version != TOKEN_VERSION:
            return False

        issued_at = int(iat_s)

        now = int(time.time())
        if issued_at > now + 30:
            return False

        if now - issued_at > MAX_AGE_SECONDS:
            return False

        payload = f"{version}.{issued_at}.{nonce}"
        expected = _sign(payload, secret)
        return hmac.compare_digest(expected, sig)

    except Exception:
        return False
