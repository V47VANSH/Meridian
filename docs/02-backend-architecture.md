# Backend Architecture

Owner: Person B · Parent doc: [00 — Architecture Overview](00-architecture-overview.md)

## 1. Stack

NestJS (Node.js + TypeScript), deployed as a single service on Render — a **modular monolith**, not microservices (see overview §Approach decision). Prisma as ORM against PostgreSQL (Supabase). Redis (Upstash) for cache, locks, queues, and the Socket.IO pub-sub adapter.

## 2. Folder Structure

```
backend/
  src/
    common/               # guards, decorators, interceptors, filters, pipes
    prisma/               # PrismaService, tenant-scoping middleware
    auth/                 # AuthModule
    tenants/              # TenantModule (society CRUD, SuperAdmin)
    users/                # UserModule
    maintenance/          # MaintenanceModule
    complaints/           # ComplaintModule
    bookings/             # BookingModule
    visitors/             # VisitorModule (guest pass + SOS)
    announcements/        # AnnouncementModule
    notifications/        # NotificationModule (BullMQ producers/consumers)
    audit/                # AuditModule
    realtime/             # Socket.IO gateway
    ml-client/             # thin HTTP client wrapping calls to the ML service
  test/
```

Each feature module = `*.controller.ts` + `*.service.ts` + `*.module.ts` + `dto/` + its own `test/` folder. This 1:1 mapping to Milestone 1 epics means a module can be read, tested, and reasoned about without pulling in the rest of the app.

## 3. API Contract

Every controller method is decorated with `@ApiOperation`, `@ApiResponse` etc. (NestJS Swagger module), which auto-generates an OpenAPI 3.0 spec served at `/api/docs` and exported as `openapi.json` in CI. This is the single source of truth the frontend codegens against (see [01 — Frontend Architecture](01-frontend-architecture.md#3-api-client)).

**Rule for the team**: a route's DTOs and Swagger decorators are written and committed *before* the business logic — this lets Person A start against a stubbed/mocked response immediately rather than waiting on Person B's full implementation.

## 4. Security

- **AuthN**: JWT access token (15 min expiry) + refresh token. Refresh token is a rotated, httpOnly, secure cookie; its hash is stored in the `RefreshToken` table so any individual token can be revoked (e.g. on logout-everywhere or suspected compromise).
- **AuthZ**: `@Roles(Role.SOCIETY_OFFICIAL, ...)` guard checks the decoded JWT's role claim. `@TenantScoped()` guard checks the resource being accessed belongs to the JWT's `tenant_id` claim — applied globally, opted out of explicitly (not opted in), so a new route is tenant-safe by default.
- **Guest passes**: not a JWT — a signed, random (non-sequential, non-guessable), single-use token with `valid_from`/`valid_until`. On guard scan, the pass flips `ACTIVE → USED` atomically (DB transaction), preventing replay even if the QR image is captured.
- **Rate limiting**: `@nestjs/throttler` backed by Redis, tighter limits on `/auth/*` and `/sos` than general API traffic.
- **Secrets**: Razorpay keys, JWT signing secret, ML shared-secret, Twilio/SendGrid keys — all via environment variables (Render env vars in prod, `.env` + `.env.example` locally, never committed).

## 5. Maintenance & Payments Flow

1. `MaintenanceModule` generates `MaintenanceInvoice` rows on a monthly schedule (BullMQ repeatable job).
2. Resident hits **Pay Now** → backend creates a Razorpay Order (`POST /maintenance/invoices/:id/pay` → Razorpay Orders API) → returns `order_id` to frontend → Razorpay Checkout opens client-side with a **test-mode** key.
3. On payment, Razorpay sends a **webhook** to `POST /webhooks/razorpay`. Backend verifies the webhook signature (HMAC with the Razorpay webhook secret) before trusting the payload — this is the one endpoint in the system that's intentionally unauthenticated (can't require a user JWT from Razorpay's servers) but is *signature-verified*, which is the correct pattern here, not a hole.
4. On verified `payment.captured`, invoice flips to `PAID`, a `Payment` row is written, resident is notified (push + in-app).
5. Separately, `PaymentRiskScore` is refreshed periodically by calling the ML service (see [04 — ML Architecture](04-ml-architecture.md)); if a flat's risk score crosses a threshold, an early reminder notification fires ahead of the due date.

## 6. Complaint Flow

1. Resident submits complaint (free-text description + optional photo upload to Supabase Storage).
2. Backend calls ML service `/complaints/classify` with the description → gets `{category, urgency, confidence}`.
3. If `confidence` is below a threshold, or the ML service is unreachable, falls back to `category = "GENERAL"`, `urgency = "MEDIUM"` and flags the complaint for manual triage — **the system never blocks complaint submission on ML being up**.
4. Complaint is written with the resolved category/urgency, appears in the official/staff triage queue sorted by urgency, and every status transition appends a `ComplaintStatusHistory` row + fires an `AuditLog` entry + realtime event to the raiser.

## 7. Booking Flow (Race Safety)

Double-booking is the concrete failure mode called out in Milestone 1 ("manual facility booking causes conflicts"). To prevent it under concurrent requests:

1. `POST /bookings` acquires a short-lived Redis lock keyed on `slot_id`.
2. Inside the lock, it checks (and the DB has a unique constraint as a second line of defense) that no `CONFIRMED` booking exists for that slot, then creates the booking and releases the lock.
3. On success, a `booking.slot_taken` realtime event updates every other client currently viewing that facility's calendar, so a second user sees the slot go unavailable without needing to refresh or hit a failed request themselves.

## 8. Visitor & Emergency Flow

**Guest pass**: resident calls `POST /visitors/guest-passes` with visitor name/phone + validity window → backend generates a signed, random `qr_token` (not a sequential ID), stores a `GuestPass` row as `ACTIVE`, and returns a QR-encodable string to the frontend. On guard scan (`POST /visitors/guest-passes/:token/verify`), the backend re-checks `valid_from`/`valid_until` against the current time (expiry is evaluated on read, not by a background job — there is no separate "mark expired" cron; an out-of-window `ACTIVE` pass is treated as expired at verification time) and, only if still within window and still `ACTIVE`, flips it to `USED` in the same transaction that returns the verification result — this is what makes the token single-use even if the QR image were somehow captured and reused.

**SOS**: `POST /sos` (resident) writes an `SOSIncident` row as `OPEN`, then: (a) emits `sos.raised` to the `tenant:{id}:role:SECURITY_GUARD` room via the realtime gateway, and (b) enqueues an `SOS_RAISED` notification job (push + SMS to on-duty guards, see §9). A guard calling `POST /sos/:id/acknowledge` flips it to `ACKNOWLEDGED`, which emits `sos.acknowledged` back to the raiser so they see confirmation someone is responding, not just a fire-and-forget button press.

## 9. Realtime Gateway

Socket.IO server attached to the NestJS app, using the Redis adapter (`@socket.io/redis-adapter`) so it works correctly if Render ever runs more than one instance. On connection, the gateway verifies the same JWT used for REST calls, then **server-side** joins the socket to `tenant:{id}:user:{id}` and `tenant:{id}:role:{role}` rooms — the client cannot request arbitrary room membership, closing off a cross-tenant eavesdropping vector.

## 10. Notifications

`NotificationModule` exposes an internal `notify(userId, type, payload)` call used by other modules (Maintenance, Complaint, Booking, Visitor). It enqueues a BullMQ job rather than sending synchronously:

```
notify() → BullMQ queue → worker picks up job
  → resolves channels for this notification `type` (see table below)
  → dispatches to each channel independently (one failing channel doesn't block another)
  → writes a `Notification` row regardless of channel outcome, for the in-app feed
```

| Type | Channels |
|---|---|
| `SOS_RAISED` | Push + SMS + in-app |
| `PAYMENT_DUE_SOON` | Push + Email |
| `PAYMENT_OVERDUE` | Push + Email |
| `COMPLAINT_STATUS_CHANGED` | Push + in-app |
| `BOOKING_CONFIRMED` | Push + in-app |
| `ANNOUNCEMENT_POSTED` | Push + in-app |

## 11. Error Handling

A global `HttpExceptionFilter` maps all errors to a consistent shape:

```json
{ "statusCode": 400, "error": "VALIDATION_ERROR", "message": "...", "requestId": "..." }
```

`requestId` is generated per-request (middleware) and included in Sentry error reports, so a user-reported bug can be traced to its exact server-side log/trace.

## 12. Testing

- **Unit**: Jest, one suite per module's service (business logic), mocking Prisma via a test double
- **Integration**: supertest against a seeded test Postgres (docker-compose in CI), one suite per module's controller (routing, guards, validation)
- **Contract**: CI regenerates `openapi.json` and fails the build if it diverges from the committed spec without a corresponding version bump
