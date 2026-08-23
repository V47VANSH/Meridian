# Apartment Complex Management System — Backend

Team 98 · Milestone 3 (Sprint 4) · FastAPI + SQLAlchemy + pytest

Backend API for a multi-tenant apartment society platform: one deployment
serves many societies, each isolated by `tenant_id`. Covers all six Milestone 1
epics — maintenance payments, complaints, facility booking, visitor and
emergency management, society administration, and non-resident owner services.

## Quick start

```bash
cd backend

python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open:

| URL | What it is |
|---|---|
| http://localhost:8000/api/docs | Interactive Swagger UI |
| http://localhost:8000/api/redoc | ReDoc reference |
| http://localhost:8000/api/openapi.json | Machine-readable spec |
| http://localhost:8000/health | Liveness probe |

The database is SQLite by default, created and seeded with a demo society on
first start — nothing else needs installing.

### Demo accounts

All seeded accounts use the password `Password123`.

| Email | Role |
|---|---|
| `admin@platform.example` | `SUPER_ADMIN` |
| `official@greenvalley.example` | `SOCIETY_OFFICIAL` |
| `resident@greenvalley.example` | `RESIDENT_OWNER` |
| `owner@greenvalley.example` | `NON_RESIDENT_OWNER` |
| `guard@greenvalley.example` | `SECURITY_GUARD` |
| `staff@greenvalley.example` | `MAINTENANCE_STAFF` |

To try a request in Swagger UI: call `POST /api/v1/auth/login`, copy the
`access_token`, click **Authorize**, and paste it.

## Running the tests

```bash
cd backend
pytest                      # whole suite
pytest tests/test_auth.py   # one module
pytest -k booking           # by keyword
```

92 tests run against a throwaway SQLite database created per test. No server,
no Postgres and no Redis need to be running.

One test is marked `xfail` — it documents a known defect (a guest pass whose
validity window has closed is still listed as `ACTIVE` until a guard scans it)
and is scheduled for the next sprint. It is reported as `xfailed`, not as a
failure, so a red suite always means a real regression.

## Regenerating the Swagger YAML

```bash
python scripts/export_openapi.py
```

Writes `openapi.yaml` from the live route definitions, so the document can
never describe an endpoint that does not exist. Alongside the standard OpenAPI
sections it carries two extensions:

- `x-user-story-mapping` — every epic and user story, and the endpoints that
  implement it
- `x-error-catalogue` — every `error` code the API can return, with its status
  and meaning

## Layout

```
backend/
  app/
    main.py              # app factory, middleware, exception handlers, OpenAPI
    models.py            # SQLAlchemy models — the ERD in docs/09
    schemas.py           # Pydantic request/response contracts
    openapi_extras.py    # user story mapping + error catalogue
    core/
      config.py          # environment-driven settings
      security.py        # password hashing, JWT, HMAC signatures
      deps.py            # auth, role guard, tenant scoping
      errors.py          # uniform error contract
    db/
      session.py         # engine, session factory, declarative base
      seed.py            # demo society
    services/
      ml_client.py       # complaint classifier + payment risk, with fallback
      notifications.py   # multi-channel fan-out
      audit.py           # append-only audit trail
    api/v1/
      auth.py  tenants.py  maintenance.py  complaints.py
      bookings.py  visitors.py  announcements.py
  tests/                 # pytest suite (92 tests)
  scripts/
    export_openapi.py
  openapi.yaml           # generated Swagger document
  requirements.txt
```

## Design notes

**Tenant isolation.** `tenant_id` is read from the verified JWT, never from a
request body or query parameter, so a caller cannot ask for another society's
data. Every tenant-scoped query filters on it, and the performance indexes are
all `(tenant_id, ...)`-prefixed.

**Authentication.** 15-minute access tokens plus rotating refresh tokens. Only
the SHA-256 hash of a refresh token is stored, and rotation revokes the
presented token — so a stolen refresh token is usable at most once and its
reuse is detectable.

**Payments.** The invoice is settled only after the HMAC-SHA256 gateway
signature verifies. Without that check any client could mark an invoice paid
for free; `test_payment_with_a_forged_signature_does_not_settle_the_invoice`
covers exactly that.

**Double-booking.** `POST /bookings` is defended twice: a per-slot lock
serialises concurrent requests, and a partial unique index on
`slot_id WHERE status = 'CONFIRMED'` makes a second confirmed booking
impossible at the database level. The index is partial so cancelling a booking
frees the slot.

**Guest passes.** Tokens are 192 bits of randomness rather than sequential ids,
so passes cannot be enumerated. Validity is evaluated at scan time and the
`ACTIVE → USED` flip happens in the same transaction that returns the result,
which is what makes a captured QR image unusable a second time.

**ML fallback.** Complaint classification calls the ML service when configured
and falls back to a keyword classifier on timeout, transport error, malformed
response, or low confidence. Complaint submission never fails because the model
is down; low-confidence results are flagged for manual triage instead.

## Configuration

Every setting is environment-driven; the defaults run locally with no setup.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./acms.db` | Set to a `postgresql+psycopg://` URL for a real deployment |
| `JWT_SECRET` | dev placeholder | **Must** be set to a strong random value in production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `PASSWORD_HASH_ROUNDS` | `260000` | PBKDF2 cost; the test suite lowers it for speed |
| `ML_SERVICE_URL` | unset | When unset, the keyword fallback classifier is used |
| `ML_CONFIDENCE_THRESHOLD` | `0.55` | Below this, the result is flagged for manual triage |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | test placeholders | Payment gateway credentials |
| `CORS_ORIGINS` | localhost dev ports | Comma-separated allowed origins |
| `SEED_ON_STARTUP` | `true` | Seed the demo society when the database is empty |
