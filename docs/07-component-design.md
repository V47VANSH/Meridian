# Design of Components

**Team 98 · Milestone 2 · Apartment Complex Management System**  
Parent doc: [00 — Architecture Overview](00-architecture-overview.md)

---

## 1. System-Level Component Diagram

The system is organised into five deployment units. Every arrow represents a real runtime communication path.

```mermaid
graph TD
    subgraph Client["Client (Browser / PWA)"]
        FE["React 18 PWA\n(Vite + TypeScript)"]
        SW["Service Worker\n(Push / Offline)"]
        FE --- SW
    end

    subgraph Backend["NestJS API — Modular Monolith (Render)"]
        direction TB
        AUTH["AuthModule"]
        TENANT["TenantModule"]
        USER["UserModule"]
        MAINT["MaintenanceModule"]
        COMP["ComplaintModule"]
        BOOK["BookingModule"]
        VIS["VisitorModule"]
        ANN["AnnouncementModule"]
        NOTIF["NotificationModule"]
        AUDIT["AuditModule"]
        RT["RealtimeGateway\n(Socket.IO)"]
        MLC["MLClientModule"]
        PRISMA["PrismaService\n(Tenant-scoped ORM)"]
    end

    subgraph ML["ML Service — FastAPI (Render)"]
        CC["ComplaintClassifier"]
        PR["PaymentRiskScorer"]
        AS["ArtifactStore"]
        CC --- AS
        PR --- AS
    end

    subgraph Infra["Infrastructure"]
        REDIS["Redis (Upstash)\nCache · Locks · BullMQ · WS Pub-Sub"]
        PG["PostgreSQL (Supabase)\n15 tables · Tenant isolation"]
        STOR["Supabase Storage\nQR images · Photos · ML artifacts"]
    end

    subgraph Ext["External Services"]
        RZP["Razorpay\n(Payments)"]
        SG["SendGrid\n(Email)"]
        TW["Twilio\n(SMS)"]
        SENTRY["Sentry\n(Error tracking)"]
    end

    FE -->|"REST + JWT"| AUTH
    FE -->|"REST + JWT"| MAINT
    FE -->|"REST + JWT"| COMP
    FE -->|"REST + JWT"| BOOK
    FE -->|"REST + JWT"| VIS
    FE -->|"REST + JWT"| ANN
    FE <-->|"WebSocket (Socket.IO)"| RT

    MAINT --> PRISMA
    COMP --> PRISMA
    BOOK --> PRISMA
    VIS --> PRISMA
    ANN --> PRISMA
    AUTH --> PRISMA
    USER --> PRISMA
    TENANT --> PRISMA
    AUDIT --> PRISMA
    NOTIF --> PRISMA

    PRISMA -->|"SQL via Prisma ORM"| PG

    BOOK -->|"Redis lock on slot_id"| REDIS
    NOTIF -->|"BullMQ jobs"| REDIS
    RT -->|"Redis pub-sub adapter"| REDIS

    MAINT -->|"HTTP + shared secret"| MLC
    COMP -->|"HTTP + shared secret"| MLC
    MLC -->|"POST /complaints/classify\nPOST /payment-risk/score"| CC
    MLC --> PR

    MAINT -->|"Razorpay Orders API"| RZP
    RZP -->|"Webhook HMAC verified"| MAINT

    NOTIF -->|"Web Push"| SW
    NOTIF -->|"Email"| SG
    NOTIF -->|"SMS SOS + critical"| TW

    AS -->|"model.pkl versioned"| STOR

    AUTH -.->|"error events"| SENTRY
```

---

## 2. Frontend Components

**Technology**: React 18 + TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand, React Router, Socket.IO client, vite-plugin-pwa.

### 2.1 App Shell & Providers

| Component | Responsibility |
|---|---|
| `AppRouter` | Role-based route guard; reads JWT role from auth store; redirects unauthorized access |
| `AuthProvider` | Zustand store for auth session (access token, decoded claims, refresh logic) |
| `QueryClientProvider` | TanStack Query cache; configured with stale-time and retry policies |
| `SocketProvider` | Opens Socket.IO connection on login; joins `tenant:{id}:user:{id}` and `tenant:{id}:role:{role}` rooms |
| `ServiceWorker` | Registers Web Push subscription; handles offline caching of app shell |

### 2.2 Feature Components (by epic)

| Feature Folder | Pages / Components | Notes |
|---|---|---|
| `features/auth` | `LoginPage`, `RegisterPage`, `ForgotPassword` | Token storage, redirect-on-login |
| `features/dashboard` | `ResidentDashboard`, `OfficialDashboard`, `NonResidentDashboard` | Aggregated summary cards; pulls from multiple query hooks |
| `features/maintenance` | `InvoiceList`, `PayNowModal`, `PaymentHistory`, `InvoiceManagement` (official) | Razorpay `rzp.open()` client-side checkout embed |
| `features/complaints` | `RaiseComplaintForm`, `ComplaintList`, `StatusTimeline`, `TriageQueue` (official/staff) | Timeline driven by `ComplaintStatusHistory`; triage sorted by ML urgency |
| `features/bookings` | `FacilityCalendar` (slot grid), `MyBookings`, `ScheduleManagement` (official) | Live slot updates via `booking.slot_taken` socket event |
| `features/visitors` | `GenerateGuestPass`, `GuestPassHistory`, `QRDisplay`, `SOSButton`, `SOSInbox` (guard), `QRScanner` (guard) | Hold-to-trigger SOS anti-misfire; signed QR token display |
| `features/announcements` | `AnnouncementFeed`, `AnnouncementComposer` (official) | Audience-filtered feed |

### 2.3 Shared UI Components

| Component | Responsibility |
|---|---|
| `SkeletonCard` | Loading state placeholder — no blank white screens |
| `EmptyState` | Contextual empty-state with primary CTA |
| `ErrorMessage` | Inline error with `requestId` for support tracing |
| `OfflineBanner` | PWA offline indicator; disables network-dependent actions |
| `NotificationToast` | Real-time toast for SOS, booking, and complaint updates |
| `RoleGuard` | Wraps routes/components; renders nothing if role is not permitted |

### 2.4 API Client & Hook Layer

| Component | Responsibility |
|---|---|
| `src/api/generated/` | Auto-generated typed client from OpenAPI spec via `openapi-typescript-codegen` |
| `src/api/hooks/` | React Query hooks wrapping the generated client (e.g. `useInvoices()`, `useComplaints()`) |
| `src/hooks/useSocket.ts` | Centralised Socket.IO event subscriptions with cleanup on unmount |
| `src/hooks/useAuth.ts` | Auth store selector + refresh token logic |

---

## 3. Backend Components (NestJS Modules)

**Technology**: NestJS (Node.js + TypeScript), Prisma ORM, Redis (Upstash), BullMQ, Socket.IO — deployed as a modular monolith on Render.

Each module follows the pattern: `*.controller.ts` + `*.service.ts` + `*.module.ts` + `dto/`.

| Module | Controller Routes (abbreviated) | Service Responsibilities | External Dependencies |
|---|---|---|---|
| **AuthModule** | `POST /auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout` | JWT generation, refresh token rotation, password hashing | `bcrypt`, `jsonwebtoken`, Prisma |
| **TenantModule** | `POST /tenants`, `GET /tenants/:id`, `PATCH /tenants/:id` | Society onboarding and CRUD (SuperAdmin only) | Prisma |
| **UserModule** | `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` | Resident/staff management per tenant; role assignment | Prisma |
| **MaintenanceModule** | `GET /maintenance/invoices`, `POST /maintenance/invoices/:id/pay`, `POST /webhooks/razorpay` | Monthly invoice generation (BullMQ repeatable job); Razorpay order creation; webhook HMAC verification; ML risk score trigger | Razorpay SDK, MLClientModule, BullMQ, Prisma |
| **ComplaintModule** | `POST /complaints`, `GET /complaints`, `PATCH /complaints/:id/assign`, `PATCH /complaints/:id/status` | Complaint creation → ML classify → status transitions → AuditLog | MLClientModule, AuditModule, NotificationModule, Prisma |
| **BookingModule** | `GET /bookings/facilities`, `GET /bookings/slots`, `POST /bookings`, `DELETE /bookings/:id` | Redis lock on slot → DB unique constraint check → booking confirm; realtime slot-taken broadcast | Redis (lock), RealtimeGateway, NotificationModule, Prisma |
| **VisitorModule** | `POST /visitors/guest-passes`, `GET /visitors/guest-passes`, `POST /visitors/guest-passes/:token/verify`, `POST /sos`, `POST /sos/:id/acknowledge` | Signed QR token generation; atomic single-use verification; SOS incident lifecycle | RealtimeGateway, NotificationModule, Prisma |
| **AnnouncementModule** | `POST /announcements`, `GET /announcements` | Announcement creation with audience targeting; feed retrieval | NotificationModule, Prisma |
| **NotificationModule** | Internal `notify()` call only — no public REST endpoint | BullMQ job enqueue; worker dispatches to Push/Email/SMS independently; writes `Notification` row | BullMQ, Web Push (VAPID), SendGrid, Twilio, Prisma |
| **AuditModule** | `GET /audit-logs` (official/admin only) | Append-only `AuditLog` writer; called by other modules on every state-changing action | Prisma |
| **RealtimeGateway** | WS events: `sos.raised`, `sos.acknowledged`, `complaint.status_changed`, `booking.slot_taken` | Socket.IO server; JWT-verified room join; Redis pub-sub adapter for multi-instance scaling | Redis (`@socket.io/redis-adapter`) |
| **MLClientModule** | Internal HTTP calls only | Thin HTTP client wrapping ML service endpoints; 2 s timeout + fallback logic | `axios`, ML Service |
| **PrismaService** | Internal ORM layer | Prisma Client Extension auto-injects `tenant_id` filter on every query from `nestjs-cls` context | Supabase Postgres |

### 3.1 Cross-Cutting / Common Layer

| Component | Responsibility |
|---|---|
| `JwtAuthGuard` | Verifies JWT access token on every protected route |
| `RolesGuard` | Checks `@Roles()` decorator against JWT role claim |
| `TenantScopedGuard` | Verifies resource `tenant_id` matches JWT `tenant_id`; globally applied, opt-out model |
| `ThrottlerGuard` | Redis-backed rate limiting; tighter limits on `/auth/*` and `/sos` |
| `HttpExceptionFilter` | Maps all errors to `{ statusCode, error, message, requestId }` |
| `RequestIdMiddleware` | Generates UUID per request; included in logs and Sentry reports |
| `TenantContextInterceptor` | Populates `nestjs-cls` store with `tenant_id` from JWT for Prisma middleware |

---

## 4. ML Service Components

**Technology**: Python, FastAPI, scikit-learn (TF-IDF + Logistic Regression / Gradient Boosting), deployed separately on Render.

| Component | File | Responsibility |
|---|---|---|
| **FastAPI App** | `app/main.py` | Entry point; mounts routers; shared-secret auth middleware (`X-Internal-Secret` header) |
| **Complaint Classifier** | `app/complaints/classify.py` | `POST /complaints/classify` — TF-IDF vectorise → LogReg predict → return `{category, urgency, confidence}` |
| **Complaint Trainer** | `app/complaints/train.py` | Load labeled data → train → evaluate macro-F1 → save `model.pkl` + metadata JSON |
| **Payment Risk Scorer** | `app/payment_risk/score.py` | `POST /payment-risk/score` — feature vector → GradientBoosting predict → return `{risk_score}` |
| **Payment Risk Trainer** | `app/payment_risk/train.py` | Load invoice/payment history → engineer features → train → evaluate ROC-AUC → save artifact |
| **Artifact Store** | `app/common/artifact_store.py` | Load/save `model.pkl` and metadata to Supabase Storage; versioned by timestamp |

---

## 5. Infrastructure Components

| Component | Provider | Role |
|---|---|---|
| **PostgreSQL** | Supabase (free tier) | Primary data store; 15 tables; partial unique indexes; row-level tenant isolation via Prisma middleware |
| **Supabase Storage** | Supabase | Object storage for complaint photos, guest-pass QR images, ML model artifacts |
| **Redis — Cache** | Upstash (free tier) | Short-lived caching (e.g. facility slot availability) |
| **Redis — Locks** | Upstash | `SET NX EX` distributed lock keyed on `slot_id` to prevent double-booking race condition |
| **Redis — BullMQ Queue** | Upstash | Notification job queue; decouples slow channel dispatch from the HTTP request lifecycle |
| **Redis — Socket.IO Adapter** | Upstash | Pub-sub adapter allows Socket.IO to fan-out across multiple Render instances |
| **Razorpay** | External | Payment gateway (test/sandbox mode); Order creation API + HMAC-verified webhook |
| **SendGrid** | External | Transactional email for payment due/overdue notices |
| **Twilio** | External | SMS for SOS alerts and payment-critical notices |
| **Web Push (VAPID)** | Browser standard | In-browser push for all notification types; subscription stored per user |
| **Sentry** | External | Error tracking; `requestId` links frontend errors to server-side traces |

---

## 6. Component Interaction Summary

| Interaction | From → To | Protocol | Notes |
|---|---|---|---|
| User authentication | React PWA → AuthModule | REST HTTPS | Returns JWT access + httpOnly refresh cookie |
| All API calls | React PWA → NestJS modules | REST + `Bearer <JWT>` | Guards applied on every route |
| Real-time updates | React PWA ↔ RealtimeGateway | WebSocket (Socket.IO) | JWT verified on handshake |
| Push notifications | NotificationModule → Service Worker | Web Push (VAPID) | Via stored browser subscription |
| ML complaint classification | ComplaintModule → MLClientModule → ML Service | Internal HTTP + shared secret | 2 s timeout; fallback to GENERAL/MEDIUM |
| ML payment risk scoring | MaintenanceModule → MLClientModule → ML Service | Internal HTTP + shared secret | Periodic; result cached in `PaymentRiskScore` |
| Booking race-safety lock | BookingModule → Redis | Redis `SET NX EX` | Released after DB write; DB unique index is second defence |
| Notification dispatch | NotificationModule → Redis BullMQ | BullMQ `add()` | Workers dispatch to Push / SendGrid / Twilio independently |
| Socket fan-out | RealtimeGateway → Redis pub-sub | `@socket.io/redis-adapter` | Enables multi-instance horizontal scale |
| Payment order creation | MaintenanceModule → Razorpay API | HTTPS | Returns `order_id` to frontend |
| Payment capture (webhook) | Razorpay → MaintenanceModule | HTTPS webhook (HMAC verified) | Invoice flipped to PAID; `Payment` row created |
| DB queries | All backend modules → PrismaService | Prisma ORM (in-process) | `tenant_id` auto-injected by Prisma Client Extension |
| ORM → Database | PrismaService → Supabase PostgreSQL | Postgres wire protocol | Connection pool managed by Prisma |
| ML artifact persistence | ArtifactStore → Supabase Storage | HTTPS | Versioned by timestamp; reloaded on service restart |
| Error reporting | Any component → Sentry | HTTPS | `requestId` correlates frontend + backend events |
