# Backend Architecture

Owner: Person B · Parent doc: [00 — Architecture Overview](00-architecture-overview.md)

## 1. Stack

FastAPI (Python 3.11), deployed as a single service on Render — a **modular monolith**, not microservices (see overview §Approach decision). SQLAlchemy 2.0 as ORM against PostgreSQL (Supabase), with Alembic for migrations. Redis (Upstash) for cache, booking locks, and the notification job queue.

Python is used for the backend rather than a Node stack because the ML service is already Python (see [04 — ML Architecture](04-ml-architecture.md)), so the team maintains one language across both services instead of two. It also makes the backend directly testable with `pytest`, which is the tool the milestone deliverables are graded with.

## 2. Folder Structure

```
backend/
  app/
    core/                 # config, security, dependencies, error contract
    db/                   # engine, session factory, seed data
    services/             # ML client, notifications, audit trail
    api/v1/               # one router module per epic
      auth.py             # AuthRouter
      tenants.py          # society CRUD, flats, directory (SuperAdmin + Official)
      maintenance.py      # invoices, payments, risk score
      complaints.py       # complaint lifecycle
      bookings.py         # facilities, slots, bookings
      visitors.py         # guest passes + SOS
      announcements.py    # announcements + notification feed
    models.py             # SQLAlchemy ORM models (all 18 tables)
    schemas.py            # Pydantic request/response contracts
    openapi_extras.py     # user story mapping + error catalogue
    main.py               # app factory, middleware, exception handlers
  tests/                  # one suite per router, plus tenant isolation
  scripts/                # OpenAPI export
```

Each epic = one `api/v1/*.py` router + its Pydantic schemas + its own test module. This 1:1 mapping to Milestone 1 epics means a router can be read, tested, and reasoned about without pulling in the rest of the app.

Wiring is done with `APIRouter` plus `Depends()` rather than a globally registered container. The dependency graph is therefore explicit per route, which is what makes a route's authentication, role and tenant requirements readable directly from its signature instead of having to be traced through separate registration files.

## 3. API Contract

Every route declares Pydantic request and response models plus its error responses, from which FastAPI generates an OpenAPI 3.1 spec served at `/api/docs` and exported to `openapi.yaml` by `scripts/export_openapi.py`. This is the single source of truth the frontend codegens against (see [01 — Frontend Architecture](01-frontend-architecture.md#3-api-client)).

Because the spec is generated from the live route table, it cannot describe an endpoint that does not exist — a class of drift that a hand-maintained spec is prone to. CI enforces the converse: it re-exports the spec and fails if the committed `openapi.yaml` has moved, so a route cannot be added without the contract following it.

The delivered contract is **48 paths / 59 operations / 62 schemas**, across nine routers — the seven epic routers below plus `dashboard.py` (per-role aggregation views) and `ai.py` (the natural-language assistant).

The exported document carries two extensions beyond standard OpenAPI:

| Extension | Contents |
|---|---|
| `x-user-story-mapping` | Every epic and user story, and the endpoints implementing it |
| `x-error-catalogue` | Every `error` code the API can return, with its status and meaning |

**Rule for the team**: a route's Pydantic schemas and response declarations are written and committed *before* the business logic — this lets Person A start against a stubbed response immediately rather than waiting on Person B's full implementation.

## 4. Security

- **AuthN**: JWT access token (15 min expiry) + refresh token, both signed with `PyJWT`. Only the SHA-256 hash of a refresh token is stored in the `RefreshToken` table, so a database leak yields no usable tokens. Refresh is **rotating**: presenting a token issues a new pair and revokes the presented one, so a stolen token is usable at most once and its reuse is detectable.
- **Passwords**: PBKDF2-SHA256 with 260,000 iterations, salted per user. The iteration count is embedded in the stored digest, so raising the cost later does not invalidate existing passwords.
- **AuthZ**: `require_roles(Role.SOCIETY_OFFICIAL, ...)` is a dependency that checks the decoded JWT's role claim. `get_tenant_id` is a dependency that supplies the society scope for the request, taken from the token's `tenant_id` claim — never from a request body or query parameter, so a caller cannot ask for another society's data.
- **Guest passes**: not a JWT — a signed, random (non-sequential, non-guessable) 192-bit single-use token with `valid_from`/`valid_until`. On guard scan, the pass flips `ACTIVE → USED` atomically, preventing replay even if the QR image is captured.
- **Rate limiting**: *not implemented.* The error catalogue reserves a `RATE_LIMITED` (429) code for it, and the intended shape is Redis-backed middleware with tighter limits on `/auth/*` and `/sos` than on general traffic. Nothing enforces it today, so a caller can retry the login endpoint without throttling — the most significant security gap in the delivered system, and the first thing to add alongside Redis.
- **Secrets**: payment gateway keys, JWT signing secret, ML shared-secret, SMS/email keys — all via environment variables (Render env vars in prod, `.env` locally, never committed).

## 5. Maintenance & Payments Flow

1. Invoices are generated per flat per month; `(tenant_id, flat_id, period)` is unique, so re-running the billing job cannot double-charge a resident.
2. Resident hits **Pay Now** → `POST /maintenance/invoices/{id}/pay` creates a gateway order and records a `Payment` row as `CREATED` → returns `order_id` to the frontend → checkout opens client-side with a **test-mode** key.
3. On payment, the client submits the gateway's confirmation to `POST /maintenance/invoices/{id}/payments/confirm`. The backend verifies the HMAC-SHA256 signature over `<order_id>|<payment_id>` **before trusting anything in the payload** — without this check any client could mark an invoice paid for free.
4. Only on a verified signature does the invoice flip to `PAID`, the `Payment` row move to `CAPTURED`, and the resident get notified. A failed verification marks the payment `FAILED` and leaves the invoice untouched.
5. Invoice status is recomputed **on read**: an unpaid invoice past its due date reports `OVERDUE` without depending on a nightly job having run.
6. Separately, `PaymentRiskScore` is refreshed by calling the ML service (see [04 — ML Architecture](04-ml-architecture.md)); if a flat's risk score crosses a threshold, an early reminder fires ahead of the due date.

## 6. Complaint Flow

1. Resident submits complaint (free-text description + optional photo upload to Supabase Storage).
2. Backend calls ML service `/complaints/classify` with the description → gets `{category, urgency, confidence}`.
3. If `confidence` is below the threshold, or the ML service is unreachable, a deterministic keyword classifier produces the category and urgency instead, and the complaint is flagged `needs_manual_triage` for an official to confirm — **the system never blocks complaint submission on ML being up**.
4. Complaint is written with the resolved category/urgency, appears in the official/staff triage queue sorted by urgency, and every status transition appends a `ComplaintStatusHistory` row + fires an `AuditLog` entry + notifies the raiser.
5. Status transitions are validated against the lifecycle (`OPEN → IN_PROGRESS → RESOLVED → CLOSED`). A complaint cannot jump from `OPEN` straight to `RESOLVED`, and a closed complaint cannot be reopened — both would erase the accountability trail the epic exists to provide.

## 7. Booking Flow (Race Safety)

Double-booking is the concrete failure mode called out in Milestone 1 ("manual facility booking causes conflicts"). To prevent it under concurrent requests:

1. `POST /bookings` acquires a short-lived lock keyed on `slot_id` (Redis in a multi-instance deploy; an in-process lock is equivalent for the single-instance deploy this milestone targets).
2. Inside the lock, it checks that no `CONFIRMED` booking exists for that slot, then creates the booking and releases the lock.
3. A **partial unique index** on `slot_id WHERE status = 'CONFIRMED'` is the second line of defence: even if the lock were bypassed by a second process, the database refuses the duplicate and the request returns `409` rather than creating a conflicting booking. The index is partial so that cancelling a booking frees the slot for someone else.
4. On success, a `booking.slot_taken` realtime event updates every other client currently viewing that facility's calendar, so a second user sees the slot go unavailable without needing to refresh.

This is covered directly by a test that fires eight simultaneous booking requests at one slot and asserts exactly one `201` and seven `409`s.

## 8. Visitor & Emergency Flow

**Guest pass**: resident calls `POST /visitors/guest-passes` with visitor name/phone + validity window → backend generates a random `qr_token` (not a sequential ID, so passes cannot be enumerated), stores a `GuestPass` row as `ACTIVE`, and returns a QR-encodable string. The token is returned only to the resident who created the pass — list views omit it, because a list is not where a secret belongs.

On guard scan (`POST /visitors/guest-passes/{token}/verify`), the backend re-checks `valid_from`/`valid_until` against the current time (expiry is evaluated on read, not by a background job — there is no separate "mark expired" cron) and, only if still within window and still `ACTIVE`, flips it to `USED` in the same transaction that returns the verification result — this is what makes the token single-use even if the QR image were captured and reused. Every rejection returns a specific reason (used, revoked, expired, or not yet valid) rather than a bare false, so the guard knows what to tell the visitor.

> **Resolved in Sprint 5.** The window check was originally applied on the verify path but not on the *list* path, so a pass whose window had closed was still listed as `ACTIVE` until someone scanned it. There was no security impact — the gate refused it either way — but the resident's list was misleading. It is now evaluated on read on both paths. The defect's full lifecycle, from discovery in testing through to fix, is recorded in the Milestone 3 report §5 and summarised in the final report.

**SOS**: `POST /sos` (resident) writes an `SOSIncident` row as `OPEN`, then notifies every security guard in the society (push + SMS + in-app, see §10). The incident row is written first, so the alert survives even if every notification channel fails. A guard calling `POST /sos/{id}/acknowledge` flips it to `ACKNOWLEDGED` and notifies the raiser back, so they see confirmation someone is responding rather than a fire-and-forget button press.

## 9. Realtime Gateway

FastAPI WebSocket endpoint using Redis pub/sub so it works correctly if Render ever runs more than one instance. On connection, the gateway verifies the same JWT used for REST calls, then **server-side** subscribes the socket to `tenant:{id}:user:{id}` and `tenant:{id}:role:{role}` channels — the client cannot request arbitrary channel membership, closing off a cross-tenant eavesdropping vector.

> **Status**: the REST endpoints backing every realtime event (SOS raise/acknowledge, booking confirm, complaint status change) are implemented and tested. The WebSocket transport itself is scheduled for Sprint 5; until then clients poll.

## 10. Notifications

`app/services/notifications.py` exposes an internal `notify(db, tenant_id, user_id, type, title, body)` call used by other routers (Maintenance, Complaint, Booking, Visitor):

```
notify() → resolve channels for this notification type (see table below)
        → dispatch to each channel independently (one failing channel
          does not block another)
        → write a `Notification` row regardless of channel outcome,
          for the in-app feed
```

The in-app `Notification` row is always written, whatever happens to the external channels. `notify_many()` fans one event out to several recipients — used for SOS (all on-duty guards) and announcements (everyone in the target audience).

> **Delivery status.** External channels are resolved and **logged at the dispatch boundary**; no push, email or SMS is actually sent, and there is no queue. The routing table above is implemented and exercised, so wiring a real provider is a change inside `notify()` and nowhere else. Queue-backed delivery — so a flaky provider can never slow down or fail an API request — is the intended next step and the reason the boundary exists at all.

| Type | Channels |
|---|---|
| `SOS_RAISED` | Push + SMS + in-app |
| `PAYMENT_DUE_SOON` | Push + Email |
| `PAYMENT_OVERDUE` | Push + Email |
| `COMPLAINT_STATUS_CHANGED` | Push + in-app |
| `BOOKING_CONFIRMED` | Push + in-app |
| `ANNOUNCEMENT_POSTED` | Push + in-app |

## 11. Error Handling

Registered exception handlers map every error — application errors, framework 404s/405s, Pydantic validation failures, and unhandled exceptions — to one consistent shape:

```json
{ "statusCode": 400, "error": "VALIDATION_ERROR", "message": "...", "requestId": "..." }
```

`error` is a stable machine-readable code the frontend can branch on; `message` is for humans and may be reworded without breaking clients. All 44 codes are catalogued in the exported OpenAPI document.

`requestId` is generated per-request by middleware, returned in the `X-Request-Id` response header, and included in error reports — so a user-reported bug can be traced to its exact server-side log entry. The catch-all handler never leaks a stack trace or internal detail to the client.

Two deliberate choices worth noting:

- Cross-tenant reads return **404, not 403**. Confirming a record exists would leak that another society holds that id.
- Login returns the identical error for an unknown email and a wrong password, so the response cannot be used to discover which emails are registered.

## 12. Testing

- **Unit / integration**: `pytest` with FastAPI's `TestClient`, one suite per router. Each test runs against its own throwaway SQLite database, so tests share no state and can run in any order — no PostgreSQL, no Redis, and no running server required.
- **Tenant isolation**: a dedicated suite that attempts every cross-society access path with a token belonging to a *different* society, which is the realistic shape of the attack.
- **Concurrency**: the double-booking guard is tested with real simultaneous threaded requests, not a simulated sequence.
- **Contract**: `scripts/export_openapi.py` regenerates `openapi.yaml` in CI and fails the build if it diverges from the committed spec without a corresponding version bump.

Current state: **131 tests, all passing, no `xfail` markers.** The suite previously carried one `strict=True` `xfail` documenting the guest-pass listing defect in §8; that defect is fixed and the case is now a positive assertion. The separate ML service carries a further 21 tests.

Two suites worth calling out because they test properties rather than endpoints: `test_tenant_isolation.py` attempts every cross-society access path with a token from another society, and `test_migrations.py` builds the schema from both the Alembic revisions and the ORM metadata and compares them structurally, so a model change committed without a migration fails here rather than on deploy.
