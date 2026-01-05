# server/http/security.py
import binascii
import hashlib
import hmac


def verify_pbkdf2_password(plain: str, stored: str) -> bool:
    """
    stored format:
      pbkdf2_sha256$<iters>$<salt_hex>$<hash_hex>
    """
    try:
        parts = stored.split("$")
        if len(parts) != 4:
            return False
        algo, iters_s, salt_hex, hash_hex = parts
        if algo != "pbkdf2_sha256":
            return False
        iters = int(iters_s)
        salt = binascii.unhexlify(salt_hex.encode("ascii"))
        expected = binascii.unhexlify(hash_hex.encode("ascii"))

        dk = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), salt, iters)
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False
