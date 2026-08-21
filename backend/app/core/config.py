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

    # --- Booking concurrency -------------------------------------------
    # Redis is used for the slot lock in production (see doc 02 section 7).
    # When unset, the service falls back to an in-process lock plus the DB
    # unique constraint, which is sufficient for a single-instance deploy.
    REDIS_URL: str = os.getenv("REDIS_URL", "")

    # --- ML service -----------------------------------------------------
    ML_SERVICE_URL: str = os.getenv("ML_SERVICE_URL", "")
    ML_SHARED_SECRET: str = os.getenv("ML_SHARED_SECRET", "")
    ML_TIMEOUT_SECONDS: float = float(os.getenv("ML_TIMEOUT_SECONDS", "2.0"))
    ML_CONFIDENCE_THRESHOLD: float = float(os.getenv("ML_CONFIDENCE_THRESHOLD", "0.55"))

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
