"""Tests for newly added API endpoints covering User Story gaps."""

from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient


def _iso(days_from_now: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_from_now)).isoformat()


# ---------------------------------------------------------------------------
# Maintenance APIs
# ---------------------------------------------------------------------------


def test_official_can_send_invoice_reminder(client: TestClient, society: dict, login):
    """US-1.2: Official sends payment reminder for invoice."""
    inv = client.post(
        "/api/v1/maintenance/invoices",
        json={"flat_id": society["flat_b_id"], "period": "2026-08", "amount": 3500.0, "due_date": _iso(5)},
        headers=login("official"),
    ).json()

    res = client.post(
        f"/api/v1/maintenance/invoices/{inv['id']}/remind",
        headers=login("official"),
    )
    assert res.status_code == 200, res.text
    assert "Reminder sent" in res.json()["message"]


def test_official_can_record_offline_payment(client: TestClient, society: dict, login):
    """US-1.3: Official records offline payment (cash/cheque)."""
    inv = client.post(
        "/api/v1/maintenance/invoices",
        json={"flat_id": society["flat_b_id"], "period": "2026-09", "amount": 4000.0, "due_date": _iso(10)},
        headers=login("official"),
    ).json()

    res = client.post(
        f"/api/v1/maintenance/invoices/{inv['id']}/offline-payment",
        json={"method": "CASH", "reference_note": "Receipt #1042"},
        headers=login("official"),
    )
    assert res.status_code == 200, res.text
    pay_body = res.json()
    assert pay_body["status"] == "CAPTURED"
    assert pay_body["method"] == "CASH"

    # Verify invoice is now paid
    inv_check = client.get(f"/api/v1/maintenance/invoices/{inv['id']}", headers=login("official")).json()
    assert inv_check["status"] == "PAID"

    # Test GET /payments/{payment_id} (US-1.1)
    pay_get = client.get(f"/api/v1/maintenance/payments/{pay_body['id']}", headers=login("official"))
    assert pay_get.status_code == 200
    assert pay_get.json()["id"] == pay_body["id"]


# ---------------------------------------------------------------------------
# Complaints APIs
# ---------------------------------------------------------------------------


def test_complaint_summary_and_priority_update(client: TestClient, society: dict, login):
    """US-2.2 & US-2.3: Complaint summary statistics and priority override."""
    c = client.post(
        "/api/v1/complaints",
        json={"title": "Elevator noise", "description": "Loud grinding noise during operation"},
        headers=login("resident"),
    ).json()

    # Priority update
    p_res = client.patch(
        f"/api/v1/complaints/{c['id']}/priority",
        json={"urgency": "HIGH", "note": "Escalated due to tenant concerns"},
        headers=login("official"),
    )
    assert p_res.status_code == 200, p_res.text
    assert p_res.json()["urgency"] == "HIGH"

    # Summary stats
    s_res = client.get("/api/v1/complaints/summary", headers=login("official"))
    assert s_res.status_code == 200, s_res.text
    body = s_res.json()
    assert body["total_complaints"] >= 1
    assert body["high_urgency_count"] >= 1


# ---------------------------------------------------------------------------
# Facilities & Bookings APIs
# ---------------------------------------------------------------------------


def test_booking_details_and_slot_management(client: TestClient, society: dict, login):
    """US-3.1 & US-3.4: Fetch booking confirmation details and update slot status."""
    fac = client.post(
        "/api/v1/facilities",
        json={"name": "Tennis Court", "capacity": 4},
        headers=login("official"),
    ).json()

    slot = client.post(
        f"/api/v1/facilities/{fac['id']}/slots",
        json={"date": "2026-09-20", "start_time": "09:00", "end_time": "10:00", "is_bookable": True},
        headers=login("official"),
    ).json()

    booking = client.post(
        "/api/v1/bookings",
        json={"slot_id": slot["id"]},
        headers=login("resident"),
    ).json()

    # GET /bookings/{booking_id}
    b_get = client.get(f"/api/v1/bookings/{booking['id']}", headers=login("resident"))
    assert b_get.status_code == 200, b_get.text
    assert b_get.json()["facility_name"] == "Tennis Court"

    # PATCH /facilities/{facility_id}/slots/{slot_id}
    slot2 = client.post(
        f"/api/v1/facilities/{fac['id']}/slots",
        json={"date": "2026-09-20", "start_time": "10:00", "end_time": "11:00", "is_bookable": True},
        headers=login("official"),
    ).json()


    s_patch = client.patch(
        f"/api/v1/facilities/{fac['id']}/slots/{slot2['id']}",
        json={"is_bookable": False},
        headers=login("official"),
    )
    assert s_patch.status_code == 200, s_patch.text
    assert s_patch.json()["is_bookable"] is False


# ---------------------------------------------------------------------------
# Visitors & Emergency APIs
# ---------------------------------------------------------------------------


def test_get_guest_pass_and_get_sos(client: TestClient, society: dict, login):
    """US-4.1 & US-4.2: Retrieve guest pass with token and retrieve SOS details."""
    # Guest pass
    gp = client.post(
        "/api/v1/visitors/guest-passes",
        json={
            "visitor_name": "Rohan Sharma",
            "flat_id": society["flat_b_id"],
            "valid_from": _iso(0),
            "valid_until": _iso(1),
        },
        headers=login("resident"),
    ).json()

    gp_get = client.get(f"/api/v1/visitors/guest-passes/{gp['id']}", headers=login("resident"))
    assert gp_get.status_code == 200, gp_get.text
    assert gp_get.json()["qr_token"] is not None

    # SOS
    sos = client.post(
        "/api/v1/sos",
        json={"location_note": "Block B Elevator"},
        headers=login("resident"),
    ).json()

    sos_get = client.get(f"/api/v1/sos/{sos['id']}", headers=login("resident"))
    assert sos_get.status_code == 200, sos_get.text
    assert sos_get.json()["location_note"] == "Block B Elevator"


# ---------------------------------------------------------------------------
# Dashboard & Audit Log APIs
# ---------------------------------------------------------------------------


def test_dashboard_and_audit_log_endpoints(client: TestClient, society: dict, login):
    """US-5.1, US-5.2 & US-6.2: Aggregated dashboard endpoints and audit log history."""
    res_dash = client.get("/api/v1/dashboard/resident", headers=login("resident"))
    assert res_dash.status_code == 200, res_dash.text
    assert "open_complaints" in res_dash.json()

    off_dash = client.get("/api/v1/dashboard/official", headers=login("official"))
    assert off_dash.status_code == 200, off_dash.text
    assert "total_flats" in off_dash.json()

    non_res_dash = client.get("/api/v1/dashboard/non-resident", headers=login("owner"))
    assert non_res_dash.status_code == 200, non_res_dash.text
    assert "latest_announcements" in non_res_dash.json()

    # Audit logs
    audit_res = client.get("/api/v1/audit-logs", headers=login("official"))
    assert audit_res.status_code == 200, audit_res.text
    assert isinstance(audit_res.json(), list)


def test_resident_dashboard_reports_an_overdue_invoice_as_overdue(
    client: TestClient, society: dict, login
):
    """The dashboard's pending invoice must agree with the invoice list.

    Overdue status is decided on read. Without that step the dashboard showed
    PENDING for the same invoice every other screen showed as OVERDUE.
    """
    official = login("official")
    past_due = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    client.post(
        "/api/v1/maintenance/invoices",
        json={
            "flat_id": society["flat_b_id"],
            "period": "2026-05",
            "amount": 4200.0,
            "due_date": past_due,
        },
        headers=official,
    )

    dashboard = client.get("/api/v1/dashboard/resident", headers=login("resident"))
    assert dashboard.status_code == 200, dashboard.text
    assert dashboard.json()["pending_invoice"]["status"] == "OVERDUE"


def test_non_resident_dashboard_reports_an_overdue_invoice_as_overdue(
    client: TestClient, society: dict, login
):
    """The non-resident owner's dashboard resolves overdue status the same way."""
    past_due = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    client.post(
        "/api/v1/maintenance/invoices",
        json={
            "flat_id": society["flat_a_id"],
            "period": "2026-05",
            "amount": 4000.0,
            "due_date": past_due,
        },
        headers=login("official"),
    )

    dashboard = client.get("/api/v1/dashboard/non-resident", headers=login("owner"))
    assert dashboard.status_code == 200, dashboard.text
    assert dashboard.json()["pending_invoice"]["status"] == "OVERDUE"


def test_resident_dashboard_upcoming_bookings_exclude_past_slots(
    client: TestClient, society: dict, login
):
    """"Upcoming" must mean upcoming, in slot order rather than booking order."""
    official = login("official")
    resident = login("resident")

    facility_id = client.post(
        "/api/v1/facilities",
        json={"name": "Clubhouse", "type": "COMMON", "capacity": 40, "rules": ""},
        headers=official,
    ).json()["id"]

    today = datetime.now(timezone.utc)
    far = (today + timedelta(days=9)).strftime("%Y-%m-%d")
    near = (today + timedelta(days=2)).strftime("%Y-%m-%d")

    # Booked nearest-first, so ordering by creation time returns them newest
    # first — the far date ahead of the near one, which is what the dashboard
    # used to do.
    for date in (near, far):
        slot_id = client.post(
            f"/api/v1/facilities/{facility_id}/slots",
            json={"date": date, "start_time": "18:00", "end_time": "19:00", "is_bookable": True},
            headers=official,
        ).json()["id"]
        booked = client.post("/api/v1/bookings", json={"slot_id": slot_id}, headers=resident)
        assert booked.status_code == 201, booked.text

    dashboard = client.get("/api/v1/dashboard/resident", headers=resident)
    assert dashboard.status_code == 200, dashboard.text

    dates = [b["date"] for b in dashboard.json()["upcoming_bookings"]]
    assert dates == [near, far]
