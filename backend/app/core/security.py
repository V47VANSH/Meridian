"""Password hashing and JWT issuing/verification.

Passwords use PBKDF2-SHA256 (pure Python, no native build step) so the
submitted code installs and runs identically on every machine.
"""

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings

def hash_password(password: str) -> str:
    """Return a `pbkdf2_sha256$rounds$salt$hash` encoded digest.

    The iteration count is embedded in the digest, so raising it later does not
    invalidate passwords already hashed at the old cost.
    """
    rounds = settings.PASSWORD_HASH_ROUNDS
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), rounds
    ).hex()
    return f"pbkdf2_sha256${rounds}${salt}${digest}"


def verify_password(password: str, encoded: str) -> bool:
    """Constant-time verification of a password against an encoded digest."""
    try:
        algorithm, rounds, salt, digest = encoded.split("$")
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    computed = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), int(rounds)
    ).hex()
    return hmac.compare_digest(computed, digest)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(*, user_id: str, tenant_id: str | None, role: str) -> str:
    """Short-lived bearer token carrying the identity, role and tenant claims.

    `tenant_id` is the claim every tenant-scoped query is filtered by, so it is
    read from the token rather than from any client-supplied field.
    """
    expires_at = _now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "role": role,
        "type": "access",
        "jti": uuid.uuid4().hex,
        "iat": int(_now().timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(*, user_id: str) -> tuple[str, datetime]:
    """Return the raw refresh token and its expiry.

    Only the SHA-256 hash of this value is persisted, so a database leak does
    not hand an attacker usable tokens.
    """
    expires_at = _now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "jti": uuid.uuid4().hex,
        "iat": int(_now().timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expires_at


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises `jwt.PyJWTError` when invalid."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def hash_token(token: str) -> str:
    """One-way hash used to store refresh tokens at rest."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_qr_token() -> str:
    """Random, non-sequential, non-guessable guest-pass token.

    Sequential IDs would let anyone enumerate valid passes, so this is a
    192-bit URL-safe random value instead.
    """
    return secrets.token_urlsafe(24)


def sign_payload(payload: str, secret: str) -> str:
    """HMAC-SHA256 signature, used for payment webhook verification."""
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_signature(payload: str, signature: str, secret: str) -> bool:
    """Constant-time comparison of a received signature against the expected one."""
    return hmac.compare_digest(sign_payload(payload, secret), signature)
