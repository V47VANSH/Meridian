"""Shared pytest fixtures.

Each test runs against its own throwaway SQLite database, so tests never share
state and can run in any order. Nothing external is required — no Postgres, no
Redis, no running server.
"""

import os
import tempfile
from collections.abc import Iterator

import pytest

# Configured before any app module is imported, so the engine binds to the
# temporary database rather than the developer's local one.
_TEMP_DIR = tempfile.mkdtemp(prefix="acms-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEMP_DIR}/test.db".replace("\\", "/")
os.environ["JWT_SECRET"] = "test-secret"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ["RAZORPAY_KEY_SECRET"] = "test_gateway_secret"
# Production uses 260k PBKDF2 rounds; the suite hashes hundreds of passwords,
# so it drops the cost. This changes speed only, not the code under test.
os.environ["PASSWORD_HASH_ROUNDS"] = "1000"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import hash_password, sign_payload  # noqa: E402
from app.db.session import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    Flat,
    FlatOwnership,
    OccupancyType,
    Relation,
    Role,
    Tenant,
    User,
)

TEST_PASSWORD = "Password123"


@pytest.fixture(autouse=True)
def fresh_database() -> Iterator[None]:
    """Drop and recreate every table before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> Iterator[TestClient]:
    """HTTP client bound to the application, with startup hooks disabled."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _make_user(
    session: Session, tenant_id: str | None, email: str, role: Role, name: str
) -> User:
    user = User(
        tenant_id=tenant_id,
        email=email,
        password_hash=hash_password(TEST_PASSWORD),
        full_name=name,
        phone="9800000000",
        role=role.value,
    )
    session.add(user)
    return user


@pytest.fixture
def society(db: Session) -> dict:
    """A fully populated society: one user per role, four flats, two linked.

    Returned as plain ids and emails rather than ORM objects, so tests are not
    affected by session expiry after a request commits.
    """
    tenant = Tenant(name="Green Valley Residency", address="Whitefield, Bengaluru")
    other_tenant = Tenant(name="Lakeside Enclave", address="Hebbal, Bengaluru")
    db.add_all([tenant, other_tenant])
    db.flush()

    admin = _make_user(db, None, "admin@platform.example", Role.SUPER_ADMIN, "Platform Admin")
    official = _make_user(db, tenant.id, "official@greenvalley.example", Role.SOCIETY_OFFICIAL, "Meera Iyer")
    resident = _make_user(db, tenant.id, "resident@greenvalley.example", Role.RESIDENT_OWNER, "Arjun Rao")
    neighbour = _make_user(db, tenant.id, "neighbour@greenvalley.example", Role.RESIDENT_OWNER, "Priya Nair")
    owner = _make_user(db, tenant.id, "owner@greenvalley.example", Role.NON_RESIDENT_OWNER, "Sunita Desai")
    guard = _make_user(db, tenant.id, "guard@greenvalley.example", Role.SECURITY_GUARD, "Ramesh Kumar")
    staff = _make_user(db, tenant.id, "staff@greenvalley.example", Role.MAINTENANCE_STAFF, "Vikram Singh")
    outsider = _make_user(
        db, other_tenant.id, "outsider@lakeside.example", Role.RESIDENT_OWNER, "Rahul Menon"
    )
    db.flush()

    flat_a = Flat(
        tenant_id=tenant.id,
        block="A",
        flat_number="102",
        occupancy_type=OccupancyType.OWNER_OCCUPIED.value,
    )
    flat_b = Flat(
        tenant_id=tenant.id,
        block="B",
        flat_number="304",
        occupancy_type=OccupancyType.OWNER_OCCUPIED.value,
    )
    db.add_all([flat_a, flat_b])
    db.flush()

    db.add(
        FlatOwnership(user_id=resident.id, flat_id=flat_b.id, relation=Relation.OWNER.value)
    )
    db.add(FlatOwnership(user_id=owner.id, flat_id=flat_a.id, relation=Relation.OWNER.value))
    db.commit()

    return {
        "tenant_id": tenant.id,
        "other_tenant_id": other_tenant.id,
        "flat_a_id": flat_a.id,
        "flat_b_id": flat_b.id,
        "admin_id": admin.id,
        "official_id": official.id,
        "resident_id": resident.id,
        "neighbour_id": neighbour.id,
        "owner_id": owner.id,
        "guard_id": guard.id,
        "staff_id": staff.id,
        "outsider_id": outsider.id,
        "emails": {
            "admin": "admin@platform.example",
            "official": "official@greenvalley.example",
            "resident": "resident@greenvalley.example",
            "neighbour": "neighbour@greenvalley.example",
            "owner": "owner@greenvalley.example",
            "guard": "guard@greenvalley.example",
            "staff": "staff@greenvalley.example",
            "outsider": "outsider@lakeside.example",
        },
    }


@pytest.fixture
def login(client: TestClient, society: dict):
    """Log a seeded user in and return their `Authorization` header."""

    def _login(who: str) -> dict[str, str]:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": society["emails"][who], "password": TEST_PASSWORD},
        )
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return _login


@pytest.fixture
def gateway_signature():
    """Produce the HMAC a real payment gateway would send back."""

    def _sign(order_id: str, payment_id: str) -> str:
        return sign_payload(f"{order_id}|{payment_id}", "test_gateway_secret")

    return _sign
