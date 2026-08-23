"""The Alembic revisions must build the same schema the models describe.

docs/03-database-architecture.md section 6 keeps two paths to a schema: local
runs and this suite build it from model metadata, while Postgres (CI and
production) is migrated with `alembic upgrade head`. Two paths can drift — a
model change committed without a matching revision passes every other test in
this suite and then fails on deploy. This module closes that gap by building
both and comparing them.
"""

import os
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine

from app.db.session import Base

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _introspect(path: Path) -> dict:
    """Structure of every table: columns, foreign keys, indexes, CHECKs.

    Compared structurally rather than by comparing `CREATE TABLE` text, because
    the two paths emit the same constraints in a different order.
    """
    con = sqlite3.connect(path)
    try:
        tables = [
            row[0]
            for row in con.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND name NOT LIKE 'sqlite_%' AND name != 'alembic_version' "
                "ORDER BY name"
            )
        ]

        schema = {}
        for table in tables:
            columns = {
                (row[1], row[2].lower(), bool(row[3]), row[5])
                for row in con.execute(f"PRAGMA table_info('{table}')")
            }
            foreign_keys = {
                (row[2], row[3], row[4], row[5], row[6])
                for row in con.execute(f"PRAGMA foreign_key_list('{table}')")
            }

            indexes = set()
            for row in con.execute(f"PRAGMA index_list('{table}')"):
                name, unique, origin = row[1], bool(row[2]), row[3]
                members = tuple(m[2] for m in con.execute(f"PRAGMA index_info('{name}')"))
                # SQLite names the index behind a UNIQUE constraint itself, and
                # the generated name depends on declaration order. Identify
                # those by their columns instead.
                indexes.add(
                    (members, unique, origin)
                    if name.startswith("sqlite_autoindex")
                    else (name, members, unique, origin)
                )

            sql = con.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?", (table,)
            ).fetchone()[0]
            checks = frozenset(re.findall(r"CONSTRAINT (\w+) CHECK", sql))

            schema[table] = {
                "columns": columns,
                "foreign_keys": foreign_keys,
                "indexes": indexes,
                "checks": checks,
            }
        return schema
    finally:
        con.close()


@pytest.fixture
def migrated_schema(tmp_path: Path) -> dict:
    """A database built by running every revision from scratch."""
    database = tmp_path / "migrated.db"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        # Inherits the real environment — a stripped one breaks the
        # interpreter's own imports on Windows — and overrides only the
        # database this revision run should target.
        env={
            **os.environ,
            "DATABASE_URL": f"sqlite:///{database.as_posix()}",
            "SEED_ON_STARTUP": "false",
        },
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    return _introspect(database)


@pytest.fixture
def metadata_schema(tmp_path: Path) -> dict:
    """A database built directly from the ORM models."""
    database = tmp_path / "metadata.db"
    engine = create_engine(f"sqlite:///{database.as_posix()}")
    Base.metadata.create_all(bind=engine)
    engine.dispose()
    return _introspect(database)


def test_migrations_cover_every_table(migrated_schema: dict, metadata_schema: dict):
    """A new model without a revision fails here rather than on deploy."""
    assert set(migrated_schema) == set(metadata_schema)


@pytest.mark.parametrize("aspect", ["columns", "foreign_keys", "indexes", "checks"])
def test_migrated_schema_matches_the_models(
    migrated_schema: dict, metadata_schema: dict, aspect: str
):
    """Every table's structure must match, aspect by aspect.

    Indexes matter as much as columns here: the partial unique index on
    `slot_id WHERE status = 'CONFIRMED'` is the database-level guard against
    double-booking, so a revision that dropped it would remove the second line
    of defence without any other test noticing.
    """
    for table in sorted(set(migrated_schema) & set(metadata_schema)):
        assert migrated_schema[table][aspect] == metadata_schema[table][aspect], (
            f"{table}.{aspect} differs between the migrations and the models"
        )
