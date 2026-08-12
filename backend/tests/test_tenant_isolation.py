"""Multi-tenancy tests.

The platform's central promise is that one society can never read or modify
another's data. Every check here comes from a token belonging to a *different*
society, which is the realistic shape of the attack.
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from tests.conftest import TEST_PASSWORD


def _outsider_headers(client: TestClient, society: dict) -> dict:
    """Log in as a resident of the *other* society."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": society["emails"]["outsider"], "password": TEST_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_flats_are_scoped_to_the_callers_society(client: TestClient, society: dict, login):
    """A society's flat list contains only its own flats."""
    response = client.get("/api/v1/flats", headers=login("official"))

    assert response.status_code == 200
    flats = response.json()
    assert {f["label"] for f in flats} == {"A-102", "B-304"}
    assert all(f["tenant_id"] == society["tenant_id"] for f in flats)


def test_outsider_cannot_read_another_societys_invoice(
    client: TestClient, society: dict, login
):
    """An invoice id from society A is not resolvable with a society B token."""
    due_date = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    invoice = client.post(
        "/api/v1/maintenance/invoices",
        json={
            "flat_id": society["flat_b_id"],
            "period": "2026-07",
            "amount": 4200.0,
            "due_date": due_date,
        },
        headers=login("official"),
    ).json()

    response = client.get(
        f"/api/v1/maintenance/invoices/{invoice['id']}",
        headers=_outsider_headers(client, society),
    )

    assert response.status_code == 404
    assert response.json()["error"] == "INVOICE_NOT_FOUND"


def test_outsider_cannot_read_another_societys_complaint(
    client: TestClient, society: dict, login
):
    """Complaint ids do not leak across societies."""
    complaint = client.post(
        "/api/v1/complaints",
        json={
            "title": "Water leakage in basement parking",
            "description": "Water is leaking from the ceiling near the ramp.",
        },
        headers=login("resident"),
    ).json()

    response = client.get(
        f"/api/v1/complaints/{complaint['id']}", headers=_outsider_headers(client, society)
    )

    assert response.status_code == 404


def test_outsider_cannot_verify_another_societys_guest_pass(
    client: TestClient, society: dict, login
):
    """TC-25: a guest pass token is only valid inside the society that issued it.

    Without this, a globally unique token would be scannable at any gate on
    the platform.
    """
    guest_pass = client.post(
        "/api/v1/visitors/guest-passes",
        json={
            "visitor_name": "R. Kumar",
            "flat_id": society["flat_b_id"],
            "valid_from": datetime.now(timezone.utc).isoformat(),
            "valid_until": (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
        },
        headers=login("resident"),
    ).json()

    response = client.post(
        f"/api/v1/visitors/guest-passes/{guest_pass['qr_token']}/verify",
        headers=_outsider_headers(client, society),
    )

    assert response.status_code in (403, 404)


def test_outsider_cannot_see_another_societys_announcements(
    client: TestClient, society: dict, login
):
    """Announcement feeds do not cross society boundaries."""
    client.post(
        "/api/v1/announcements",
        json={"title": "Internal notice", "body": "For our society only.", "audience": "ALL"},
        headers=login("official"),
    )

    response = client.get("/api/v1/announcements", headers=_outsider_headers(client, society))

    assert response.status_code == 200
    assert response.json() == []


def test_outsider_cannot_book_another_societys_slot(client: TestClient, society: dict, login):
    """A slot belonging to society A cannot be booked with a society B token."""
    official = login("official")
    facility = client.post(
        "/api/v1/facilities",
        json={"name": "Clubhouse", "capacity": 40},
        headers=official,
    ).json()
    future_date = (datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%d")
    slot = client.post(
        f"/api/v1/facilities/{facility['id']}/slots",
        json={"date": future_date, "start_time": "18:00", "end_time": "19:00"},
        headers=official,
    ).json()

    response = client.post(
        "/api/v1/bookings",
        json={"slot_id": slot["id"]},
        headers=_outsider_headers(client, society),
    )

    assert response.status_code == 404
    assert response.json()["error"] == "SLOT_NOT_FOUND"


def test_the_same_email_can_exist_in_two_societies(client: TestClient, society: dict):
    """Email uniqueness is per society, so one person can hold two accounts."""
    shared_email = "shared.owner@greenvalley.example"

    first = client.post(
        "/api/v1/auth/register",
        json={
            "tenant_id": society["tenant_id"],
            "email": shared_email,
            "password": "StrongPass123",
            "full_name": "Shared Owner",
            "role": "RESIDENT_OWNER",
        },
    )
    second = client.post(
        "/api/v1/auth/register",
        json={
            "tenant_id": society["other_tenant_id"],
            "email": shared_email,
            "password": "StrongPass123",
            "full_name": "Shared Owner",
            "role": "RESIDENT_OWNER",
        },
    )

    assert first.status_code == 201
    assert second.status_code == 201

    # Logging in is then ambiguous until the caller names the society.
    ambiguous = client.post(
        "/api/v1/auth/login", json={"email": shared_email, "password": "StrongPass123"}
    )
    assert ambiguous.status_code == 400
    assert ambiguous.json()["error"] == "TENANT_REQUIRED"

    resolved = client.post(
        "/api/v1/auth/login",
        json={
            "email": shared_email,
            "password": "StrongPass123",
            "tenant_id": society["tenant_id"],
        },
    )
    assert resolved.status_code == 200


def test_platform_admin_has_no_society_context(client: TestClient, society: dict, login):
    """A SUPER_ADMIN manages societies but cannot act inside one."""
    response = client.get("/api/v1/flats", headers=login("admin"))

    assert response.status_code == 403
    assert response.json()["error"] == "NO_TENANT_CONTEXT"


def test_only_platform_admin_can_create_a_society(client: TestClient, society: dict, login):
    """Society onboarding is reserved for the platform operator."""
    allowed = client.post(
        "/api/v1/tenants",
        json={"name": "Sunrise Towers", "address": "Koramangala, Bengaluru"},
        headers=login("admin"),
    )
    refused = client.post(
        "/api/v1/tenants",
        json={"name": "Rogue Society", "address": "Nowhere"},
        headers=login("official"),
    )

    assert allowed.status_code == 201
    assert refused.status_code == 403
