# Milestone 3 Report — Sprint 4

**Team 98 · Apartment Complex Management System**
Sprint window: 22 Jul – 2 Aug · Board: SCRUM-24 → SCRUM-33

---

## 1. Sprint Summary

Sprint 4 turned the Milestone 2 design into a running, tested backend. Ten
board items were taken in, covering the path from identifying APIs out of the
user stories through to demonstrating the working endpoints and collecting
feedback.

| Item | Description | Outcome |
|---|---|---|
| SCRUM-24 | Identify APIs from user stories | Done — 24 user stories across 6 epics mapped to 44 operations |
| SCRUM-25 | Define endpoints, inputs, and outputs | Done — Pydantic request/response schemas for every route |
| SCRUM-26 | Create Swagger-compatible YAML documentation | Done — `backend/openapi.yaml`, generated from live routes |
| SCRUM-27 | Implement backend API endpoints | Done — 34 paths / 44 operations across all 6 epics |
| SCRUM-28 | Add validation and error handling | Done — uniform error contract, 44 documented error codes |
| SCRUM-29 | Integrate external / GenAI APIs | Done — ML classifier client + payment-risk scoring, both with fallbacks |
| SCRUM-30 | Design functional API test cases | Done — 92 test cases designed and documented |
| SCRUM-31 | Compare expected vs actual outputs | Done — one genuine mismatch found, see §4 and §5 |
| SCRUM-32 | Implement pytest unit tests | Done — 92 tests, 91 passing, 1 documented `xfail` |
| SCRUM-33 | Demonstrate features and collect feedback | Done — feedback in §6 |

### What was built

| Layer | Delivered |
|---|---|
| Framework | FastAPI (Python 3.11) with auto-generated OpenAPI 3.1 |
| Persistence | SQLAlchemy 2.0 models — all 18 tables from the Milestone 2 ERD |
| Auth | JWT access tokens (15 min) + rotating refresh tokens, 8 roles |
| Multi-tenancy | `tenant_id` sourced from the verified token on every scoped query |
| Endpoints | 44 operations across the 6 Milestone 1 epics |
| Tests | 92 pytest cases, no external services required |

### Note on the implementation stack

The Milestone 2 design document specifies NestJS for the backend. The Milestone
3 deliverable requires pytest test cases, which is a Python tool. Rather than
run pytest over HTTP against a Node server — which would need the server
running before the tests could be graded, and would make the tests integration
tests rather than unit tests — the backend was implemented in **FastAPI**.

This keeps the architecture from Milestone 2 intact: the same modular layout,
the same 18-table schema, the same tenant-isolation and contract-first
approach. Python was already the chosen language for the ML service in the
design, so the stack is now uniform rather than split. The submitted tests run
directly from the ZIP with `pytest` and need no server, no PostgreSQL and no
Redis.

---

## 2. API Inventory

34 paths, 44 operations. Full documentation with schemas, examples and error
responses is in `backend/openapi.yaml`.

| Epic | Endpoints |
|---|---|
| Authentication (E5) | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Society Administration (E5) | `POST /tenants`, `GET /tenants`, `POST /flats`, `GET /flats`, `POST /flats/{id}/occupants`, `GET /users` |
| Maintenance & Payments (E1) | `POST /maintenance/invoices`, `GET /maintenance/invoices`, `GET /maintenance/invoices/{id}`, `POST /maintenance/invoices/{id}/pay`, `POST /maintenance/invoices/{id}/payments/confirm`, `GET /maintenance/payments`, `GET /maintenance/summary`, `GET /maintenance/flats/{id}/risk-score` |
| Complaints (E2) | `POST /complaints`, `GET /complaints`, `GET /complaints/{id}`, `PATCH /complaints/{id}/status`, `POST /complaints/{id}/assign` |
| Facilities & Bookings (E3) | `POST /facilities`, `GET /facilities`, `POST /facilities/{id}/slots`, `GET /facilities/{id}/slots`, `POST /bookings`, `GET /bookings`, `POST /bookings/{id}/cancel` |
| Visitors & Emergency (E4) | `POST /visitors/guest-passes`, `GET /visitors/guest-passes`, `POST /visitors/guest-passes/{token}/verify`, `POST /visitors/guest-passes/{id}/revoke`, `POST /sos`, `GET /sos`, `POST /sos/{id}/acknowledge`, `POST /sos/{id}/resolve` |
| Announcements & Notifications (E5, E6) | `POST /announcements`, `GET /announcements`, `GET /notifications`, `POST /notifications/{id}/read` |

All paths are prefixed `/api/v1`.

---

## 3. Test Execution Summary

```
$ pytest
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.3.4, pluggy-1.6.0
rootdir: D:\SE_Project\backend
configfile: pytest.ini
testpaths: tests
collected 92 items

tests\test_announcements.py     ..........                              [ 10%]
tests\test_auth.py              ..............                          [ 26%]
tests\test_bookings.py          ............                            [ 39%]
tests\test_complaints.py        ..............                          [ 54%]
tests\test_maintenance.py       ..............                          [ 69%]
tests\test_tenant_isolation.py  .........                               [ 79%]
tests\test_visitors.py          ............x......                     [100%]

================== 91 passed, 1 xfailed in 81.61s (0:01:21) ===================
```

| Module | Tests | Focus |
|---|---|---|
| `test_auth.py` | 14 | Registration, login, token rotation, revocation |
| `test_maintenance.py` | 14 | Invoicing, payment signature verification, overdue, summary |
| `test_complaints.py` | 14 | Auto-classification, triage ordering, lifecycle transitions |
| `test_bookings.py` | 12 | Slot availability, double-booking, concurrency |
| `test_visitors.py` | 19 | Guest pass issue/verify/revoke, SOS raise/acknowledge |
| `test_announcements.py` | 10 | Audience filtering, notification feed |
| `test_tenant_isolation.py` | 9 | Cross-society data access attempts |
| **Total** | **92** | 91 passed, 1 `xfailed` (documented defect, §5) |

The `x` in the output is the deliberately-failing case in §5. It is marked
`xfail` so the suite stays green on a healthy build and a red run always means
a real regression.

---

## 4. API Test Cases

Ten representative cases follow. Each pytest function shown is the verbatim
source from the submitted code.

---

### TC-01 — Register a new resident

| | |
|---|---|
| **API** | `POST /api/v1/auth/register` |
| **Inputs** | `{"tenant_id": "<society>", "email": "newresident@greenvalley.example", "password": "StrongPass123", "full_name": "Kavya Menon", "phone": "9800000099", "role": "RESIDENT_OWNER", "flat_id": "<flat>"}` |
| **Expected Output** | `201 Created`; body contains the new user with `role = RESIDENT_OWNER`, `status = ACTIVE`, and no password field |
| **Actual Output** | `201 Created`; `{"id": "...", "email": "newresident@greenvalley.example", "role": "RESIDENT_OWNER", "status": "ACTIVE", "tenant_id": "...", ...}` — no password field present |
| **Result** | **Success** |

```python
def test_register_creates_resident_account(client: TestClient, society: dict):
    """TC-01: a valid registration returns 201 and the new user's profile."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "tenant_id": society["tenant_id"],
            "email": "newresident@greenvalley.example",
            "password": "StrongPass123",
            "full_name": "Kavya Menon",
            "phone": "9800000099",
            "role": "RESIDENT_OWNER",
            "flat_id": society["flat_a_id"],
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "newresident@greenvalley.example"
    assert body["role"] == "RESIDENT_OWNER"
    assert body["tenant_id"] == society["tenant_id"]
    assert body["status"] == "ACTIVE"
    # The hash must never appear in an API response.
    assert "password" not in body and "password_hash" not in body
```

---

### TC-02 — Reject login with a wrong password

| | |
|---|---|
| **API** | `POST /api/v1/auth/login` |
| **Inputs** | `{"email": "resident@greenvalley.example", "password": "WrongPassword1"}` |
| **Expected Output** | `401 Unauthorized`; `error = INVALID_CREDENTIALS`; no token issued |
| **Actual Output** | `401 Unauthorized`; `{"statusCode": 401, "error": "INVALID_CREDENTIALS", "message": "Incorrect email or password", "requestId": "..."}` |
| **Result** | **Success** |

```python
def test_login_with_wrong_password_is_rejected(client: TestClient, society: dict):
    """TC-03: a wrong password returns 401 and no token."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": society["emails"]["resident"], "password": "WrongPassword1"},
    )

    assert response.status_code == 401
    body = response.json()
    assert body["error"] == "INVALID_CREDENTIALS"
    assert "access_token" not in body
```

---

### TC-03 — Refresh token is single-use

| | |
|---|---|
| **API** | `POST /api/v1/auth/refresh` |
| **Inputs** | The same `refresh_token` submitted twice in succession |
| **Expected Output** | First call `200 OK` with a new token pair; second call `401` with `error = TOKEN_REVOKED` |
| **Actual Output** | First call `200 OK`, new `access_token` returned; second call `401`, `error = TOKEN_REVOKED` |
| **Result** | **Success** |

```python
def test_refresh_rotates_the_token_and_revokes_the_old_one(client: TestClient, society: dict):
    """A refresh token works once; reusing it afterwards is rejected."""
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": society["emails"]["resident"], "password": TEST_PASSWORD},
    )
    original_refresh = login_response.json()["refresh_token"]

    first = client.post("/api/v1/auth/refresh", json={"refresh_token": original_refresh})
    assert first.status_code == 200
    assert first.json()["access_token"]

    replay = client.post("/api/v1/auth/refresh", json={"refresh_token": original_refresh})
    assert replay.status_code == 401
    assert replay.json()["error"] == "TOKEN_REVOKED"
```

---

### TC-04 — Payment with a forged signature must not settle the invoice

| | |
|---|---|
| **API** | `POST /api/v1/maintenance/invoices/{invoice_id}/payments/confirm` |
| **Inputs** | A valid `razorpay_order_id`, `razorpay_payment_id = "pay_forged"`, and a signature of 64 zeros |
| **Expected Output** | `403 Forbidden`; `error = INVALID_PAYMENT_SIGNATURE`; the invoice remains `PENDING` |
| **Actual Output** | `403 Forbidden`; `error = INVALID_PAYMENT_SIGNATURE`; subsequent fetch shows `status = PENDING` |
| **Result** | **Success** |

This is the security-critical case for the payments epic: without the HMAC
check, any client could mark an invoice paid without paying.

```python
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
```

---

### TC-05 — A duplicate invoice for the same period is rejected

| | |
|---|---|
| **API** | `POST /api/v1/maintenance/invoices` |
| **Inputs** | Two identical invoices for flat B-304, period `2026-07`, amount `4200.0` |
| **Expected Output** | First `201 Created`; second `409 Conflict` with `error = INVOICE_ALREADY_EXISTS` |
| **Actual Output** | First `201 Created`; second `409 Conflict`, `error = INVOICE_ALREADY_EXISTS` |
| **Result** | **Success** |

Protects against the monthly billing job double-charging a flat if it is
re-run.

```python
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
```

---

### TC-06 — Complaint is auto-classified from its description

| | |
|---|---|
| **API** | `POST /api/v1/complaints` |
| **Inputs** | `{"title": "Tap leaking continuously", "description": "The kitchen tap is leaking and water is being wasted."}` |
| **Expected Output** | `201 Created`; `category = PLUMBING`, `urgency = MEDIUM`, `needs_manual_triage = true` |
| **Actual Output** | `201 Created`; `category = PLUMBING`, `urgency = MEDIUM`, `needs_manual_triage = true` |
| **Result** | **Success** |

`needs_manual_triage` is `true` because the ML service is not configured in the
test environment, so the deterministic keyword fallback produced the result and
flags itself for human confirmation. This is the documented fallback behaviour
— complaint submission never fails because the model is unavailable.

```python
def test_complaint_is_auto_classified_from_its_text(client: TestClient, society: dict, login):
    """TC-09: the description drives category and urgency without user input.

    'leaking' points at PLUMBING; the classifier flags its own guess for
    manual triage because it is the rule-based fallback, not the model.
    """
    complaint = _raise_complaint(
        client,
        login("resident"),
        title="Tap leaking continuously",
        description="The kitchen tap is leaking and water is being wasted.",
    )

    assert complaint["category"] == "PLUMBING"
    assert complaint["urgency"] == "MEDIUM"
    assert complaint["needs_manual_triage"] is True
```

---

### TC-07 — Illegal complaint status transition is blocked

| | |
|---|---|
| **API** | `PATCH /api/v1/complaints/{complaint_id}/status` |
| **Inputs** | A complaint in `OPEN`; body `{"status": "RESOLVED", "note": "Skipping ahead"}` |
| **Expected Output** | `400 Bad Request`; `error = INVALID_STATUS_TRANSITION` |
| **Actual Output** | `400 Bad Request`; `error = INVALID_STATUS_TRANSITION` |
| **Result** | **Success** |

```python
def test_illegal_status_jump_is_rejected(client: TestClient, society: dict, login):
    """A complaint cannot go straight from OPEN to RESOLVED."""
    complaint = _raise_complaint(client, login("resident"))

    response = client.patch(
        f"/api/v1/complaints/{complaint['id']}/status",
        json={"status": "RESOLVED", "note": "Skipping ahead"},
        headers=login("staff"),
    )

    assert response.status_code == 400
    assert response.json()["error"] == "INVALID_STATUS_TRANSITION"
```

---

### TC-08 — Concurrent bookings for one slot produce exactly one winner

| | |
|---|---|
| **API** | `POST /api/v1/bookings` |
| **Inputs** | Eight simultaneous requests (8 threads) for the same `slot_id` |
| **Expected Output** | Exactly one `201 Created` and seven `409 Conflict` |
| **Actual Output** | `statuses.count(201) == 1`, `statuses.count(409) == 7` |
| **Result** | **Success** |

This is the direct test of the failure mode named in Milestone 1 — "manual
facility booking causes conflicts". Both defences are exercised at once: the
per-slot lock and the partial unique index.

```python
def test_concurrent_bookings_produce_exactly_one_winner(
    client: TestClient, society: dict, login
):
    """TC-14: eight simultaneous requests for one slot yield one confirmation.

    Exercises the per-slot lock and the partial unique index together.
    """
    official = login("official")
    facility = _create_facility(client, official)
    slot = _create_slot(client, official, facility["id"])
    resident_headers = login("resident")

    def attempt(_: int):
        return client.post(
            "/api/v1/bookings", json={"slot_id": slot["id"]}, headers=resident_headers
        ).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        statuses = list(pool.map(attempt, range(8)))

    assert statuses.count(201) == 1
    assert statuses.count(409) == 7
```

---

### TC-09 — A guest pass cannot be used twice

| | |
|---|---|
| **API** | `POST /api/v1/visitors/guest-passes/{qr_token}/verify` |
| **Inputs** | The same valid `qr_token` scanned twice by a guard |
| **Expected Output** | First scan `valid = true`; second scan `valid = false` with a reason saying the pass was already used |
| **Actual Output** | First `{"valid": true, "visitor_name": "R. Kumar", "flat_label": "B-304", ...}`; second `{"valid": false, "reason": "This pass has already been used", ...}` |
| **Result** | **Success** |

Confirms that capturing a QR image does not let someone re-enter: the
`ACTIVE → USED` flip happens in the same transaction that returns the result.

```python
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
```

---

### TC-10 — One society cannot read another's invoice

| | |
|---|---|
| **API** | `GET /api/v1/maintenance/invoices/{invoice_id}` |
| **Inputs** | An invoice id belonging to Green Valley Residency, requested with a token belonging to a resident of Lakeside Enclave |
| **Expected Output** | `404 Not Found`; `error = INVOICE_NOT_FOUND` |
| **Actual Output** | `404 Not Found`; `error = INVOICE_NOT_FOUND` |
| **Result** | **Success** |

`404` rather than `403` is deliberate: confirming the record exists would leak
that another society holds that id.

```python
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
```

---

## 5. Test Case Where Expected and Actual Output Do Not Match

### TC-11 — An expired guest pass is still listed as ACTIVE ❌

| | |
|---|---|
| **API** | `GET /api/v1/visitors/guest-passes?status=ACTIVE` |
| **Inputs** | A guest pass created with `valid_from = now − 5h`, `valid_until = now − 1h` (its window has closed), then the resident lists their `ACTIVE` passes |
| **Expected Output** | `200 OK` with an empty list `[]` — a pass whose window has closed is no longer active |
| **Actual Output** | `200 OK` with **one** pass, still reporting `"status": "ACTIVE"` |
| **Result** | **Fail** |

Verbatim pytest output:

```
tests/test_visitors.py::test_expired_pass_is_listed_as_expired

    assert response.json() == []
E   AssertionError: assert [{'created_at...643e77', ...}] == []
E
E     Left contains one more item: {'created_at': '2026-08-02T11:33:38.515751',
E     'flat_id': '77f84cd0669d4deba91b3983506c4a17',
E     'generated_by': 'cd77af9b218e44c995c9c0ca32cfbb6e',
E     'id': 'c65ea30347d44d2b9c9394482d643e77', ...}
```

```python
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
```

### Root cause

The design deliberately evaluates pass expiry **at scan time** rather than
through a scheduled job, so there is no background task that sweeps expired
passes. `POST /visitors/guest-passes/{token}/verify` applies that rule
correctly — it compares the window against the current time and flips the row
to `EXPIRED`.

`GET /visitors/guest-passes` does not apply the same rule. It filters on the
stored `status` column alone, so a pass whose window has closed but which
nobody has scanned still reads as `ACTIVE`.

### Impact

No security impact — an expired pass is still correctly refused at the gate,
which is the control that matters. The defect is a **correctness and UX**
problem: the resident's "Active passes" list is misleading, and any count built
on `status = ACTIVE` overstates the number of usable passes.

### How testing surfaced it

The scan-path test (`test_an_expired_pass_is_refused_at_the_gate`) passes,
because verification handles expiry properly. Writing a separate test for the
*list* path is what exposed that the same rule was never applied there. Testing
one behaviour through two different endpoints found an inconsistency that
testing either endpoint alone would have missed.

### Planned fix (Sprint 5)

Move the window check into a shared helper used by both the verify and list
paths, so `ACTIVE` is always derived from `status AND valid_until > now()`
rather than from the stored column alone. The test above will then flip from
`xfail` to `pass`; because it is marked `strict=True`, pytest will actively
fail the build if the defect is fixed without updating the marker, so the
record cannot silently go stale.

---

## 8. Submission Contents

| Deliverable | Location |
|---|---|
| **A** — Milestone 3 report | This document |
| **B** — Swagger YAML | `backend/openapi.yaml` (34 paths, 44 operations, user story mapping, error catalogue) |
| **C** — Backend code + tests | `backend/` — application, 92 pytest cases, `requirements.txt` |

### Running the submitted code

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS / Linux
pip install -r requirements.txt

pytest                          # run all 92 tests
uvicorn app.main:app --reload   # serve the API at http://localhost:8000/api/docs
```

The tests run against a temporary SQLite database created per test. No
database server, no Redis and no running API are required.
