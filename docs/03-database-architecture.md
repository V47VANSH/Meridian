# Database Architecture

Owner: Person C · Parent doc: [00 — Architecture Overview](00-architecture-overview.md)

## 1. Stack

PostgreSQL, hosted via **Supabase** (free tier) — chosen because it bundles Postgres + object storage (for guest-pass QR images, complaint photo attachments) on one free account, avoiding a separate S3/R2 setup. **SQLAlchemy 2.0** is the ORM used by the backend, with **Alembic** for migrations. Enums are stored as VARCHAR with a CHECK constraint rather than native Postgres enum types, which keeps values readable in the database and avoids the migration cost of altering an enum.

## 2. Entity-Relationship Overview

```
Tenant (society)
 ├─< User (tenant_id FK)
 ├─< Flat (tenant_id FK)
 │    └─< FlatOwnership >─ User        (many-to-many: OWNER | RESIDENT_TENANT)
 ├─< MaintenanceInvoice (flat_id FK)
 │    └─< Payment
 │    └─< PaymentRiskScore
 ├─< Complaint (flat_id FK, raised_by, assigned_to → User)
 │    └─< ComplaintStatusHistory
 ├─< Facility
 │    └─< FacilitySlot
 │         └─< Booking (booked_by → User)
 ├─< GuestPass (flat_id FK, generated_by → User)
 ├─< SOSIncident (flat_id FK, raised_by, acknowledged_by → User)
 ├─< Announcement (posted_by → User)
 ├─< Notification (user_id FK)
 └─< AuditLog (actor → User)
```

## 3. Core Tables

### `Tenant`
`id, name, address, created_at`

### `User`
`id, tenant_id, email (unique per tenant), password_hash, role (enum), phone, status (ACTIVE|SUSPENDED), created_at`

### `Flat`
`id, tenant_id, block, flat_number, occupancy_type (OWNER_OCCUPIED|RENTED|VACANT)`

### `FlatOwnership`
`user_id, flat_id, relation (OWNER|RESIDENT_TENANT)` — join table. Handles: an owner who lives in their flat (one row, relation=OWNER, and they use resident-facing features), an owner who rents it out (OWNER row for the owner-user + RESIDENT_TENANT row for the tenant-user, both linked to the same flat), and a non-resident owner (OWNER row, no RESIDENT_TENANT row exists for that flat).

### Maintenance
- `MaintenanceInvoice`: `id, tenant_id, flat_id, period (YYYY-MM), amount, due_date, status (PENDING|PAID|OVERDUE), paid_at`
- `Payment`: `id, invoice_id, razorpay_order_id, razorpay_payment_id, amount, status, method, created_at`
- `PaymentRiskScore`: `id, tenant_id, flat_id, period, risk_score (0-1), computed_at` — cache of the ML model's latest output, refreshed periodically, not recomputed per request

### Complaints
- `Complaint`: `id, tenant_id, raised_by, flat_id, category, description, urgency, status (OPEN|IN_PROGRESS|RESOLVED|CLOSED), assigned_to, attachment_urls[], created_at, resolved_at`
- `ComplaintStatusHistory`: `id, complaint_id, status, changed_by, note, changed_at`

### Facility Booking
- `Facility`: `id, tenant_id, name, type, capacity, rules`
- `FacilitySlot`: `id, facility_id, date, start_time, end_time, is_bookable`
- `Booking`: `id, tenant_id, slot_id, booked_by, status (CONFIRMED|CANCELLED), created_at`
  - **Constraint**: partial unique index on `(slot_id) WHERE status = 'CONFIRMED'` — the database itself refuses a second confirmed booking for the same slot, independent of the Redis lock in the application layer (see [02 — Backend Architecture §7](02-backend-architecture.md#7-booking-flow-race-safety)).

### Visitor & Emergency
- `GuestPass`: `id, tenant_id, generated_by, flat_id, visitor_name, visitor_phone, valid_from, valid_until, qr_token (unique), status (ACTIVE|USED|EXPIRED|REVOKED), used_at, verified_by`
- `SOSIncident`: `id, tenant_id, raised_by, flat_id, status (OPEN|ACKNOWLEDGED|RESOLVED), acknowledged_by, created_at, resolved_at, location_note`

### Admin / Cross-cutting
- `Announcement`: `id, tenant_id, posted_by, title, body, audience (ALL|RESIDENTS|NON_RESIDENT_OWNERS|STAFF), created_at`
- `Notification`: `id, tenant_id, user_id, channel (IN_APP|PUSH|EMAIL|SMS), type, payload (jsonb), read_at, sent_at, status`
- `AuditLog`: `id, tenant_id, actor, action, entity_type, entity_id, created_at` — append-only, never updated or deleted
- `RefreshToken`: `id, user_id, token_hash, expires_at, revoked_at`

## 4. Tenant Isolation

Every tenant-scoped table has a non-nullable `tenant_id`. Two layers of enforcement:

1. **Application layer**: a `get_tenant_id` dependency resolves the society scope from the verified JWT at the start of each request. Because it is a declared dependency, a route that touches tenant-scoped data states its scope in its own signature, and every scoped query filters on that value. The scope is never read from a request body or query parameter, so a caller cannot ask for another society's data by editing a payload.
2. **Row-level defense**: composite indexes are always `(tenant_id, ...)` first, so a query that somehow omitted the tenant filter would still be structurally unusual to write and easy to catch in review.
3. **Test layer**: a dedicated suite attempts every cross-society access path — invoice, complaint, booking, guest pass, announcement — using a token belonging to a *different* society, which is the realistic shape of the attack. Isolation is therefore enforced by tests, not left as a convention.

Cross-tenant reads return **404, not 403**: confirming that a record exists would itself leak that another society holds that id.

## 5. Indexing Strategy

| Table | Index | Reason |
|---|---|---|
| `User` | `(tenant_id, email)` unique | Login lookup, tenant-scoped email uniqueness |
| `MaintenanceInvoice` | `(tenant_id, flat_id, period)` unique | One invoice per flat per period |
| `Booking` | `(slot_id) WHERE status='CONFIRMED'` partial unique | Double-booking prevention at the DB level |
| `Complaint` | `(tenant_id, status, urgency)` | Triage queue query (officials/staff view) |
| `GuestPass` | `(qr_token)` unique | Guard-side scan lookup |
| `AuditLog` | `(tenant_id, entity_type, entity_id)` | "Show history for this record" queries |

## 6. Migrations & Environments

- **Alembic** for schema changes; every migration is a committed, reviewed script under `alembic/versions/`, treated like any other code change.
- Local dev and the test suite run on SQLite, created directly from the model metadata so the project clones and runs with no database server. CI: ephemeral Postgres service container with `alembic upgrade head` before the integration suite. Production: Supabase-hosted Postgres, migrations applied via a GitHub Actions deploy step — never autogenerate against prod.
- **Seeding**: `app/db/seed.py` creates a demo society with representative data (flats, a user per role, sample invoices/complaints/facilities/slots/announcements) — used for local dev and to populate the E2E environment. It is idempotent: it does nothing if a society already exists.

> **Current state**: the schema is created from model metadata (`Base.metadata.create_all`) for local and test runs. Alembic is introduced with the PostgreSQL migration in Sprint 5; the models are already the single source of truth, so the first revision is generated from them.

## 7. Backups

Supabase free tier includes automatic daily backups with a short retention window — sufficient for an academic project; documented here so it's a conscious choice, not an oversight, if the project ever needed to graduate to a paid tier with longer retention.
