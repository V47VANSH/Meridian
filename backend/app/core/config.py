"""Application configuration.

Every value is overridable through an environment variable so the same image can
run locally (SQLite), in CI (SQLite), and in production (Supabase Postgres)
without a code change. Secrets never have a usable production default.
"""

import os


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


class Settings:
    """Runtime settings resolved from the process environment."""

    PROJECT_NAME: str = "Apartment Complex Management System API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # --- Database -------------------------------------------------------
    # SQLite by default so the submitted ZIP runs with zero external setup.
    # Set DATABASE_URL to a postgresql+psycopg:// URL for a real deployment.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./acms.db")

    # --- Auth -----------------------------------------------------------
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-only-secret-change-me")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = _env_int("ACCESS_TOKEN_EXPIRE_MINUTES", 15)
    REFRESH_TOKEN_EXPIRE_DAYS: int = _env_int("REFRESH_TOKEN_EXPIRE_DAYS", 7)
    # PBKDF2 iterations. Deliberately expensive in production; the test suite
    # lowers it so a run that hashes hundreds of passwords stays fast.
    PASSWORD_HASH_ROUNDS: int = _env_int("PASSWORD_HASH_ROUNDS", 260_000)

    # --- Redis ----------------------------------------------------------
    # Backs the booking slot lock and the rate limiter. When unset, both fall
    # back to in-process equivalents, which are correct for a single instance
    # and insufficient for several (see app/core/redis_client.py).
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    REDIS_TIMEOUT_SECONDS: float = float(os.getenv("REDIS_TIMEOUT_SECONDS", "2.0"))
    # How long a booking slot lock may be held before Redis expires it. Bounds
    # how long a crashed worker can strand a slot; the critical section is one
    # SELECT plus one INSERT, so this is generous.
    SLOT_LOCK_TTL_MS: int = _env_int("SLOT_LOCK_TTL_MS", 5000)
    # How long to wait for a contended slot lock before giving up and letting
    # the database's unique index arbitrate. Short, because the critical
    # section is short — a long wait would turn contention into a timeout.
    SLOT_LOCK_WAIT_MS: int = _env_int("SLOT_LOCK_WAIT_MS", 3000)

    # --- Rate limiting ---------------------------------------------------
    RATE_LIMIT_ENABLED: bool = _env_bool("RATE_LIMIT_ENABLED", True)
    RATE_LIMIT_WINDOW_SECONDS: int = _env_int("RATE_LIMIT_WINDOW_SECONDS", 60)
    # Tighter on the endpoints worth abusing: /auth/* is where credential
    # stuffing happens, and /sos fans out to every guard over push and SMS.
    RATE_LIMIT_DEFAULT: int = _env_int("RATE_LIMIT_DEFAULT", 240)
    RATE_LIMIT_AUTH: int = _env_int("RATE_LIMIT_AUTH", 20)
    RATE_LIMIT_SOS: int = _env_int("RATE_LIMIT_SOS", 10)
    # Only enable behind a proxy that overwrites X-Forwarded-For. A client can
    # set that header themselves, so trusting it unconditionally would let
    # anyone reset their own rate-limit counter at will.
    TRUST_PROXY_HEADERS: bool = _env_bool("TRUST_PROXY_HEADERS", False)

    # --- ML service -----------------------------------------------------
    ML_SERVICE_URL: str = os.getenv("ML_SERVICE_URL", "")
    ML_SHARED_SECRET: str = os.getenv("ML_SHARED_SECRET", "")
    ML_TIMEOUT_SECONDS: float = float(os.getenv("ML_TIMEOUT_SECONDS", "2.0"))
    ML_CONFIDENCE_THRESHOLD: float = float(os.getenv("ML_CONFIDENCE_THRESHOLD", "0.55"))
    # Risk at or above this triggers the early payment reminder described in
    # docs/02-backend-architecture.md section 5.6. 0.5 reads as "more likely
    # than not to pay late"; a flat with no track record scores below it.
    PAYMENT_RISK_REMINDER_THRESHOLD: float = float(
        os.getenv("PAYMENT_RISK_REMINDER_THRESHOLD", "0.5")
    )

    # --- Payments -------------------------------------------------------
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_dummy")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "dummy_secret")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "dummy_webhook_secret")

    # --- Gemini AI Assistant --------------------------------------------
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # --- Misc -----------------------------------------------------------
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
        if o.strip()
    ]
    SEED_ON_STARTUP: bool = _env_bool("SEED_ON_STARTUP", True)


settings = Settings()
