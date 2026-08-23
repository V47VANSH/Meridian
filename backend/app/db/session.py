"""SQLAlchemy engine, session factory and declarative base."""

import logging
from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)

_connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    # FastAPI serves requests from a threadpool; SQLite needs this relaxed.
    _connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)

if settings.DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
        """SQLite ignores FK constraints unless they are switched on per connection."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Declarative base shared by every ORM model."""


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create any missing tables, when this deployment owns the schema that way.

    SQLite runs (local development and the test suite) build the schema from
    model metadata, so the project is a single call away from working. Postgres
    is migrated with `alembic upgrade head` instead — see
    docs/03-database-architecture.md section 6. Running create_all against a
    migrated database would produce tables Alembic never stamped a revision for,
    and the next upgrade would fail on tables that already exist.
    """
    from app import models  # noqa: F401  (registers the mappers)

    if not settings.AUTO_CREATE_TABLES:
        logger.info(
            "AUTO_CREATE_TABLES is off; the schema is owned by Alembic migrations"
        )
        return

    Base.metadata.create_all(bind=engine)
