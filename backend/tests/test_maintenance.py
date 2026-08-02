"""Maintenance invoicing and payment API tests."""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def _iso(days_from_now: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_from_now)).isoformat()


def _create_invoice(
    client: TestClient, headers: dict, flat_id: str, period: str = "2026-07", amount: float = 4200.0
) -> dict:
    response = client.post(
        "/api/v1/maintenance/invoices",
        json={"flat_id": flat_id, "period": period, "amount": amount, "due_date": _iso(10)},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_official_can_raise_an_invoice(client: TestClient, society: dict, login):
    """TC-04: an official creates an invoice, which starts life as PENDING."""
    response = client.post(
        "/api/v1/maintenance/invoices",
        json={
            "flat_id": society["flat_b_id"],
            "period": "2026-07",
            "amount": 4200.0,
            "due_date": _iso(10),
        },
        headers=login("official"),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "PENDING"
    assert body["amount"] == 4200.0
    assert body["period"] == "2026-07"
    assert body["paid_at"] is None


def test_resident_cannot_raise_an_invoice(client: TestClient, society: dict, login):
    """Invoicing is an official-only action; a resident gets 403."""
    response = client.post(
        "/api/v1/maintenance/invoices",
        json={
            "flat_id": society["flat_b_id"],
            "period": "2026-08",
            "amount": 4200.0,
            "due_date": _iso(10),
        },
        headers=login("resident"),
    )

    assert response.status_code == 403
    assert response.json()["error"] == "FORBIDDEN"


def test_duplicate_invoice_for_the_same_period_is_rejected(
    client: TestClient, society: dict, login
):
    """Re-running the billing job must not double-charge a flat."""
    official = login("official")
    _create_invoice(client, official, society["flat_b_id"], period="2026-07")

    response = client.post(
        "/api/v1/maintenance/invoices",
        json={
            "flat_id": society["flat_b_id"],
            "period": "2026-07",
            "amount": 4200.0,
            "due_date": _iso(10),
        },
        headers=official,
    )

    assert response.status_code == 409
    assert response.json()["error"] == "INVOICE_ALREADY_EXISTS"


def test_negative_invoice_amount_is_rejected(client: TestClient, society: dict, login):
    """A non-positive amount fails validation."""
    response = client.post(
        "/api/v1/maintenance/invoices",
        json={
            "flat_id": society["flat_b_id"],
            "period": "2026-09",
            "amount": -500.0,
            "due_date": _iso(10),
        },
        headers=login("official"),
    )

    assert response.status_code == 422
    assert response.json()["error"] == "VALIDATION_ERROR"


def test_resident_sees_only_invoices_for_their_own_flat(client: TestClient, society: dict, login):
    """A resident's invoice list is scoped to the flats they are linked to."""
    official = login("official")
    _create_invoice(client, official, society["flat_b_id"], period="2026-07")  # resident's flat
    _create_invoice(client, official, society["flat_a_id"], period="2026-07")  # someone else's

    response = client.get("/api/v1/maintenance/invoices", headers=login("resident"))

    assert response.status_code == 200
    invoices = response.json()
    assert len(invoices) == 1
    assert invoices[0]["flat_id"] == society["flat_b_id"]


def test_official_sees_every_invoice_in_the_society(client: TestClient, society: dict, login):
    """Officials get the society-wide view."""
    official = login("official")
    _create_invoice(client, official, society["flat_b_id"], period="2026-07")
    _create_invoice(client, official, society["flat_a_id"], period="2026-07")

    response = client.get("/api/v1/maintenance/invoices", headers=official)

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_resident_cannot_read_another_flats_invoice(client: TestClient, society: dict, login):
    """Fetching another flat's invoice by id returns 403, not the record."""
    invoice = _create_invoice(client, login("official"), society["flat_a_id"], period="2026-07")

    response = client.get(
        f"/api/v1/maintenance/invoices/{invoice['id']}", headers=login("resident")
    )

    assert response.status_code == 403
    assert response.json()["error"] == "NOT_YOUR_INVOICE"


def test_pay_creates_a_gateway_order(client: TestClient, society: dict, login):
    """TC-05: requesting payment returns an order the client can check out with."""
    resident = login("resident")
    invoice = _create_invoice(client, login("official"), society["flat_b_id"])

    response = client.post(
        f"/api/v1/maintenance/invoices/{invoice['id']}/pay", headers=resident
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["order_id"].startswith("order_")
    assert body["amount"] == invoice["amount"]
    assert body["currency"] == "INR"


def test_confirming_a_signed_payment_settles_the_invoice(
    client: TestClient, society: dict, login, gateway_signature
):
    """TC-06: a correctly signed confirmation flips the invoice to PAID."""
    resident = login("resident")
    invoice = _create_invoice(client, login("official"), society["flat_b_id"])
    order = client.post(
        f"/api/v1/maintenance/invoices/{invoice['id']}/pay", headers=resident
    ).json()

    payment_id = "pay_test_123456"
    response = client.post(
        f"/api/v1/maintenance/invoices/{invoice['id']}/payments/confirm",
        json={
            "razorpay_order_id": order["order_id"],
            "razorpay_payment_id": payment_id,
            "signature": gateway_signature(order["order_id"], payment_id),
            "method": "upi",
        },
        headers=resident,
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "CAPTURED"

    invoice_after = client.get(
        f"/api/v1/maintenance/invoices/{invoice['id']}", headers=resident
    ).json()
    assert invoice_after["status"] == "PAID"
    assert invoice_after["paid_at"] is not None


def test_payment_with_a_forged_signature_does_not_settle_the_invoice(
    client: TestClient, society: dict, login
):
    """TC-07: an unverifiable signature is refused and the invoice stays unpaid.

    Without this check any client could mark an invoice paid for free.
    """
    resident = login("resident")
    invoice = _create_invoice(client, login("official"), society["flat_b_id"])
    order = client.post(
        f"/api/v1/maintenance/invoices/{invoice['id']}/pay", headers=resident
    ).json()

    response = client.post(
        f"/api/v1/maintenance/invoices/{invoice['id']}/payments/confirm",
        json={
            "razorpay_order_id": order["order_id"],
            "razorpay_payment_id": "pay_forged",
            "signature": "0000000000000000000000000000000000000000000000000000000000000000",
            "method": "card",
        },
        headers=resident,
    )

    assert response.status_code == 403
    assert response.json()["error"] == "INVALID_PAYMENT_SIGNATURE"

    invoice_after = client.get(
        f"/api/v1/maintenance/invoices/{invoice['id']}", headers=resident
    ).json()
    assert invoice_after["status"] == "PENDING"


def test_paying_an_already_paid_invoice_is_rejected(
    client: TestClient, society: dict, login, gateway_signature
):
    """A settled invoice cannot be charged twice."""
    resident = login("resident")
    invoice = _create_invoice(client, login("official"), society["flat_b_id"])
    order = client.post(
        f"/api/v1/maintenance/invoices/{invoice['id']}/pay", headers=resident
    ).json()
    payment_id = "pay_test_once"
    client.post(
        f"/api/v1/maintenance/invoices/{invoice['id']}/payments/confirm",
        json={
            "razorpay_order_id": order["order_id"],
            "razorpay_payment_id": payment_id,
            "signature": gateway_signature(order["order_id"], payment_id),
        },
        headers=resident,
    )

    response = client.post(
        f"/api/v1/maintenance/invoices/{invoice['id']}/pay", headers=resident
    )

    assert response.status_code == 409
    assert response.json()["error"] == "INVOICE_ALREADY_PAID"


def test_overdue_status_is_applied_on_read(client: TestClient, society: dict, login):
    """An unpaid invoice past its due date reports as OVERDUE without a cron job."""
    official = login("official")
    response = client.post(
        "/api/v1/maintenance/invoices",
        json={
            "flat_id": society["flat_b_id"],
            "period": "2026-05",
            "amount": 4000.0,
            "due_date": _iso(-15),
        },
        headers=official,
    )
    invoice_id = response.json()["id"]

    fetched = client.get(f"/api/v1/maintenance/invoices/{invoice_id}", headers=official).json()

    assert fetched["status"] == "OVERDUE"


def test_summary_reports_collection_totals(
    client: TestClient, society: dict, login, gateway_signature
):
    """The official dashboard aggregates counts and rupee totals correctly."""
    official = login("official")
    resident = login("resident")
    paid_invoice = _create_invoice(client, official, society["flat_b_id"], "2026-07", 4200.0)
    _create_invoice(client, official, society["flat_a_id"], "2026-07", 3000.0)

    order = client.post(
        f"/api/v1/maintenance/invoices/{paid_invoice['id']}/pay", headers=resident
    ).json()
    payment_id = "pay_summary"
    client.post(
        f"/api/v1/maintenance/invoices/{paid_invoice['id']}/payments/confirm",
        json={
            "razorpay_order_id": order["order_id"],
            "razorpay_payment_id": payment_id,
            "signature": gateway_signature(order["order_id"], payment_id),
        },
        headers=resident,
    )

    summary = client.get("/api/v1/maintenance/summary", headers=official).json()

    assert summary["total_invoices"] == 2
    assert summary["paid_count"] == 1
    assert summary["total_collected"] == 4200.0
    assert summary["total_outstanding"] == 3000.0


def test_risk_score_is_between_zero_and_one(client: TestClient, society: dict, login):
    """The payment-risk endpoint answers even with no payment history."""
    official = login("official")
    _create_invoice(client, official, society["flat_b_id"], "2026-07")

    response = client.get(
        f"/api/v1/maintenance/flats/{society['flat_b_id']}/risk-score?period=2026-07",
        headers=official,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert 0.0 <= body["risk_score"] <= 1.0
    assert body["period"] == "2026-07"
