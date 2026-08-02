"""Guest pass and SOS API tests."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


def _iso(hours_from_now: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours_from_now)).isoformat()


def _create_pass(
    client: TestClient,
    headers: dict,
    flat_id: str,
    valid_from_hours: float = -1,
    valid_until_hours: float = 6,
    visitor_name: str = "R. Kumar",
) -> dict:
    response = client.post(
        "/api/v1/visitors/guest-passes",
        json={
            "visitor_name": visitor_name,
            "visitor_phone": "9812345678",
            "purpose": "Personal visit",
            "flat_id": flat_id,
            "valid_from": _iso(valid_from_hours),
            "valid_until": _iso(valid_until_hours),
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_resident_can_generate_a_guest_pass(client: TestClient, society: dict, login):
    """TC-16: a pass is created ACTIVE and returns its QR token to the issuer."""
    response = client.post(
        "/api/v1/visitors/guest-passes",
        json={
            "visitor_name": "R. Kumar",
            "visitor_phone": "9812345678",
            "purpose": "Personal visit",
            "flat_id": society["flat_b_id"],
            "valid_from": _iso(0),
            "valid_until": _iso(6),
        },
        headers=login("resident"),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "ACTIVE"
    assert body["visitor_name"] == "R. Kumar"
    # The token is long and random so passes cannot be guessed or enumerated.
    assert body["qr_token"] and len(body["qr_token"]) >= 24


def test_pass_tokens_are_unique_per_pass(client: TestClient, society: dict, login):
    """Two passes never share a token."""
    resident = login("resident")
    first = _create_pass(client, resident, society["flat_b_id"])
    second = _create_pass(client, resident, society["flat_b_id"], visitor_name="S. Nair")

    assert first["qr_token"] != second["qr_token"]


def test_resident_cannot_issue_a_pass_for_another_flat(client: TestClient, society: dict, login):
    """A resident may only issue passes for a flat they are linked to."""
    response = client.post(
        "/api/v1/visitors/guest-passes",
        json={
            "visitor_name": "Uninvited Guest",
            "flat_id": society["flat_a_id"],
            "valid_from": _iso(0),
            "valid_until": _iso(6),
        },
        headers=login("resident"),
    )

    assert response.status_code == 403
    assert response.json()["error"] == "NOT_YOUR_FLAT"


def test_validity_window_must_be_positive(client: TestClient, society: dict, login):
    """A window that ends before it starts fails validation."""
    response = client.post(
        "/api/v1/visitors/guest-passes",
        json={
            "visitor_name": "Time Traveller",
            "flat_id": society["flat_b_id"],
            "valid_from": _iso(6),
            "valid_until": _iso(1),
        },
        headers=login("resident"),
    )

    assert response.status_code == 422


def test_guard_can_verify_a_valid_pass(client: TestClient, society: dict, login):
    """TC-17: scanning a valid pass admits the visitor and consumes the pass."""
    guest_pass = _create_pass(client, login("resident"), society["flat_b_id"])

    response = client.post(
        f"/api/v1/visitors/guest-passes/{guest_pass['qr_token']}/verify",
        headers=login("guard"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["valid"] is True
    assert body["visitor_name"] == "R. Kumar"
    assert body["flat_label"] == "B-304"


def test_a_pass_cannot_be_used_twice(client: TestClient, society: dict, login):
    """TC-18: replaying a captured QR image is refused on the second scan."""
    guest_pass = _create_pass(client, login("resident"), society["flat_b_id"])
    guard = login("guard")

    first = client.post(
        f"/api/v1/visitors/guest-passes/{guest_pass['qr_token']}/verify", headers=guard
    )
    second = client.post(
        f"/api/v1/visitors/guest-passes/{guest_pass['qr_token']}/verify", headers=guard
    )

    assert first.json()["valid"] is True
    assert second.status_code == 200
    assert second.json()["valid"] is False
    assert "already been used" in second.json()["reason"]


def test_an_expired_pass_is_refused_at_the_gate(client: TestClient, society: dict, login):
    """A pass scanned after its window closes is rejected and marked EXPIRED."""
    guest_pass = _create_pass(
        client,
        login("resident"),
        society["flat_b_id"],
        valid_from_hours=-5,
        valid_until_hours=-1,
    )

    response = client.post(
        f"/api/v1/visitors/guest-passes/{guest_pass['qr_token']}/verify",
        headers=login("guard"),
    )

    assert response.status_code == 200
    assert response.json()["valid"] is False
    assert "expired" in response.json()["reason"].lower()


def test_a_pass_is_refused_before_its_window_opens(client: TestClient, society: dict, login):
    """Arriving a day early does not get the visitor in."""
    guest_pass = _create_pass(
        client,
        login("resident"),
        society["flat_b_id"],
        valid_from_hours=24,
        valid_until_hours=30,
    )

    response = client.post(
        f"/api/v1/visitors/guest-passes/{guest_pass['qr_token']}/verify",
        headers=login("guard"),
    )

    assert response.json()["valid"] is False
    assert "not valid until" in response.json()["reason"]


def test_a_revoked_pass_is_refused(client: TestClient, society: dict, login):
    """Once the resident cancels the visit, the pass stops working."""
    resident = login("resident")
    guest_pass = _create_pass(client, resident, society["flat_b_id"])

    revoke = client.post(
        f"/api/v1/visitors/guest-passes/{guest_pass['id']}/revoke", headers=resident
    )
    assert revoke.status_code == 200
    assert revoke.json()["status"] == "REVOKED"

    verify = client.post(
        f"/api/v1/visitors/guest-passes/{guest_pass['qr_token']}/verify",
        headers=login("guard"),
    )
    assert verify.json()["valid"] is False
    assert "revoked" in verify.json()["reason"].lower()


def test_an_unknown_token_is_not_found(client: TestClient, society: dict, login):
    """A made-up token returns 404 rather than admitting anyone."""
    response = client.post(
        "/api/v1/visitors/guest-passes/completely-made-up-token/verify",
        headers=login("guard"),
    )

    assert response.status_code == 404
    assert response.json()["error"] == "PASS_NOT_FOUND"


def test_resident_cannot_verify_passes(client: TestClient, society: dict, login):
    """Verification is a guard action; a resident cannot admit their own guest."""
    resident = login("resident")
    guest_pass = _create_pass(client, resident, society["flat_b_id"])

    response = client.post(
        f"/api/v1/visitors/guest-passes/{guest_pass['qr_token']}/verify", headers=resident
    )

    assert response.status_code == 403


def test_pass_list_does_not_expose_tokens(client: TestClient, society: dict, login):
    """The token is a secret; a list view must not hand it out."""
    _create_pass(client, login("resident"), society["flat_b_id"])

    response = client.get("/api/v1/visitors/guest-passes", headers=login("guard"))

    assert response.status_code == 200
    assert all(p["qr_token"] is None for p in response.json())


@pytest.mark.xfail(
    reason=(
        "Known defect: validity is only re-evaluated when a guard scans a pass, so a pass "
        "whose window has closed is still listed as ACTIVE until someone scans it. "
        "Scheduled for the next sprint."
    ),
    strict=True,
)
def test_expired_pass_is_listed_as_expired(client: TestClient, society: dict, login):
    """A pass past its validity window should not be listed as ACTIVE.

    Expected: the pass appears with status EXPIRED.
    Actual:   it is still reported as ACTIVE, because expiry is evaluated at
              verification time only and never on the list path.
    """
    _create_pass(
        client,
        login("resident"),
        society["flat_b_id"],
        valid_from_hours=-5,
        valid_until_hours=-1,
    )

    response = client.get(
        "/api/v1/visitors/guest-passes?status=ACTIVE", headers=login("resident")
    )

    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# SOS
# ---------------------------------------------------------------------------


def test_resident_can_raise_an_sos(client: TestClient, society: dict, login):
    """TC-19: an SOS is recorded OPEN and awaits a responder."""
    response = client.post(
        "/api/v1/sos",
        json={"flat_id": society["flat_b_id"], "location_note": "Basement parking, B block"},
        headers=login("resident"),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "OPEN"
    assert body["acknowledged_by"] is None


def test_raising_an_sos_notifies_every_guard(client: TestClient, society: dict, login):
    """The alert reaches the guard's notification feed."""
    client.post(
        "/api/v1/sos",
        json={"flat_id": society["flat_b_id"], "location_note": "Medical emergency"},
        headers=login("resident"),
    )

    feed = client.get("/api/v1/notifications", headers=login("guard"))

    assert feed.status_code == 200
    assert any(n["type"] == "SOS_RAISED" for n in feed.json())


def test_guard_can_acknowledge_an_sos(client: TestClient, society: dict, login):
    """TC-20: acknowledgement records the responder and tells the raiser."""
    incident = client.post(
        "/api/v1/sos", json={"location_note": "Lift stuck"}, headers=login("resident")
    ).json()

    response = client.post(
        f"/api/v1/sos/{incident['id']}/acknowledge", headers=login("guard")
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ACKNOWLEDGED"
    assert body["acknowledged_by"] == society["guard_id"]
    assert body["acknowledged_at"] is not None

    raiser_feed = client.get("/api/v1/notifications", headers=login("resident")).json()
    assert any("Help is on the way" in n["title"] for n in raiser_feed)


def test_an_sos_cannot_be_acknowledged_twice(client: TestClient, society: dict, login):
    """A second acknowledgement returns 409 rather than overwriting the first."""
    incident = client.post(
        "/api/v1/sos", json={"location_note": "Fire alarm"}, headers=login("resident")
    ).json()
    guard = login("guard")
    client.post(f"/api/v1/sos/{incident['id']}/acknowledge", headers=guard)

    response = client.post(f"/api/v1/sos/{incident['id']}/acknowledge", headers=guard)

    assert response.status_code == 409
    assert response.json()["error"] == "SOS_NOT_OPEN"


def test_resident_cannot_acknowledge_an_sos(client: TestClient, society: dict, login):
    """Only guards and officials respond to alerts."""
    incident = client.post(
        "/api/v1/sos", json={"location_note": "Test"}, headers=login("resident")
    ).json()

    response = client.post(
        f"/api/v1/sos/{incident['id']}/acknowledge", headers=login("neighbour")
    )

    assert response.status_code == 403


def test_guard_inbox_lists_open_incidents(client: TestClient, society: dict, login):
    """The guard sees society-wide alerts; a resident sees only their own."""
    client.post("/api/v1/sos", json={"location_note": "A"}, headers=login("resident"))
    client.post("/api/v1/sos", json={"location_note": "B"}, headers=login("neighbour"))

    guard_view = client.get("/api/v1/sos?status=OPEN", headers=login("guard"))
    resident_view = client.get("/api/v1/sos", headers=login("resident"))

    assert len(guard_view.json()) == 2
    assert len(resident_view.json()) == 1
