# server/services/admin_service.py
from __future__ import annotations

import binascii
import hashlib
from typing import Dict

from server.config import CONFIG
from server.services.admin_token import create_admin_token


def _verify_pbkdf2_password(plain: str, stored: str) -> bool:
    """
    stored format:
      pbkdf2_sha256$<iters>$<salt_hex>$<hash_hex>
    """
    try:
        parts = (stored or "").split("$")
        if len(parts) != 4:
            return False

        algo, iters_s, salt_hex, hash_hex = parts
        if algo != "pbkdf2_sha256":
            return False

        iters = int(iters_s)
        salt = binascii.unhexlify(salt_hex.encode("ascii"))
        expected = binascii.unhexlify(hash_hex.encode("ascii"))

        dk = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), salt, iters)
        return hashlib.compare_digest(dk, expected)
    except Exception:
        return False


class AdminService:
    """
    Autenticación ADMIN (panel).
    - Fuente de verdad: CONFIG.admin_key / admin_username / admin_password_hash
    - Emite token admin (firmado con CONFIG.admin_key)
    """

    def elevate(self, admin_key: str, admin_username: str, admin_password: str) -> Dict[str, str]:
        """
        Raises:
          ValueError("ADMIN_KEY_INVALID")
          ValueError("ADMIN_USERNAME_INVALID")
          ValueError("ADMIN_PASSWORD_INVALID")
        """
        if (admin_key or "").strip() != CONFIG.admin_key:
            raise ValueError("ADMIN_KEY_INVALID")

        if (admin_username or "").strip() != CONFIG.admin_username:
            raise ValueError("ADMIN_USERNAME_INVALID")

        if not _verify_pbkdf2_password(admin_password or "", CONFIG.admin_password_hash):
            raise ValueError("ADMIN_PASSWORD_INVALID")

        token = create_admin_token(secret=CONFIG.admin_key)
        return {"token": token}
