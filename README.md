# Meridian — Apartment Complex Management System

Team 98 · IITM Software Engineering, May 2026

A multi-tenant platform for apartment societies: one deployment serves many
societies, each isolated by `tenant_id`. It covers the six Milestone 1 epics —
maintenance payments, complaints, facility booking, visitor and emergency
management, society administration, and non-resident owner services.

```
MAY2026-Team-098/
├── frontend/           React + TypeScript + Vite single-page app
├── backend/            FastAPI + SQLAlchemy REST API
├── ml-service/         FastAPI service: complaint classifier + payment-risk model
├── docs/               Architecture, component, class and database design,
│                       milestone reports, and the final report
├── .github/workflows/  CI for all three services
└── *.png               Diagrams referenced by the milestone reports
```

The backend and frontend are all you need to run the application. The ML service
is optional — without it, complaint classification falls back to a keyword
classifier and flags each complaint for manual triage, which is the designed
behaviour rather than a failure.

## Technologies

**Frontend** — React 18, TypeScript 5.5, Vite 5, React Router 6, Zustand 4
(session state), TanStack Query 5 (server state), Tailwind CSS 3,
openapi-typescript (API types generated from the backend spec), qrcode
(scannable guest passes).

**Backend** — FastAPI 0.115, SQLAlchemy 2.0, Alembic 1.14 (migrations), Pydantic
2.10, uvicorn, PyJWT (HS256 access and rotating refresh tokens), PBKDF2-SHA256
password hashing, SQLite by default (PostgreSQL via `DATABASE_URL`), pytest 8.3,
Ruff (lint).

**ML service** — FastAPI, scikit-learn 1.6 (TF-IDF + logistic regression for
complaint classification; gradient-boosted trees for payment risk), joblib for
model artifacts.

**External APIs** — Razorpay (test mode; HMAC-SHA256 signature verification
server-side), Google Gemini (natural-language assistant, with a rule-based
fallback when no key is configured).

**General** — Git and GitHub for version control and code review, GitHub Actions
for CI, Jira for issue tracking, Swagger UI / OpenAPI 3.1 for the API contract.

## Requirements

- Node.js 18 or newer, and npm
- Python 3.11 or newer

Verified on Python 3.13.1, Node 22.12.0 and npm 11.7.0.

## Running the application

The two halves run as separate processes. Start the backend first — the
frontend's dev server proxies API calls to it.

### 1. Backend

**Windows**

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Ubuntu / macOS**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements.txt
uvicorn app.main:app --reload
```

The API starts on <http://localhost:8000>. On first run it creates a SQLite
database (`backend/acms.db`) and seeds a demo society — nothing else to install.

| URL | What it is |
|---|---|
| <http://localhost:8000/api/docs> | Interactive Swagger UI |
| <http://localhost:8000/api/redoc> | ReDoc reference |
| <http://localhost:8000/api/openapi.json> | Machine-readable spec |
| <http://localhost:8000/health> | Liveness probe |

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Requests to `/api` are proxied to the backend, so
the browser only ever talks to one origin and no CORS configuration is needed.
If the backend runs somewhere other than port 8000, set `VITE_API_PROXY_TARGET`
(see `frontend/.env.example`).

### 3. ML service (optional)

Skip this and the application still works — complaint classification falls back
to a keyword classifier and flags each complaint for manual triage. Start it to
see the trained models make the call instead.

**Windows**

```bat
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8100
```

**Ubuntu / macOS**

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements.txt
uvicorn app.main:app --port 8100
```

Trained model artifacts are committed, so it serves predictions immediately. To
retrain them from scratch:

```bash
python -m app.complaints.train      # TF-IDF + logistic regression
python -m app.payment_risk.train    # gradient-boosted trees
```

Then point the backend at it and restart the backend:

```bat
set ML_SERVICE_URL=http://localhost:8100          :: Windows
export ML_SERVICE_URL=http://localhost:8100       # Ubuntu / macOS
```

<http://localhost:8100/health> reports whether each trained artifact is loadable,
and <http://localhost:8100/docs> is its Swagger UI.

### Demo accounts

Every seeded account uses the password `Password123`. The sign-in page lists
them behind **Show demo accounts** and fills the form when one is clicked.

| Email | Role |
|---|---|
| `resident@greenvalley.example` | Resident / Flat Owner |
| `official@greenvalley.example` | Society Official |
| `owner@greenvalley.example` | Non-Resident Owner |
| `guard@greenvalley.example` | Security Guard |
| `staff@greenvalley.example` | Maintenance / Cleaning Staff |
| `admin@platform.example` | Platform admin (API only — no UI screens) |

## Testing

**Backend — 131 tests.** Each runs against its own throwaway SQLite database, so
nothing external is required: no PostgreSQL, no Redis, no running server.

```bash
cd backend
pytest                          # whole suite
pytest tests/test_auth.py       # one module
pytest -k booking               # by keyword
ruff check .                    # lint
```

Three suites test properties rather than endpoints, and are the ones worth
reading first:

| Suite | What it proves |
|---|---|
| `test_tenant_isolation.py` | Every cross-society access path, attempted with a token from another society |
| `test_bookings.py` | Eight simultaneous threaded requests for one slot produce exactly one `201` and seven `409`s |
| `test_migrations.py` | The Alembic revisions and the ORM models build structurally identical schemas |

**ML service — 21 tests**, covering the contract the backend depends on, the
pre/post-processing, and the metric floors each trained artifact must clear.

```bash
cd ml-service
pytest
```

**Frontend** is gated by the type checker rather than a test suite:

```bash
cd frontend
npm run typecheck           # tsc --noEmit
npm run build               # typecheck + production bundle
npm run gen:api             # regenerate API types from backend/openapi.yaml
```

All three run in CI on every pull request — see `.github/workflows/`.

## How the two halves connect

The frontend talks to the backend through a single client in
`frontend/src/api/client.ts`, which attaches the bearer token, unwraps the API's
uniform error body into a typed `ApiError`, and transparently refreshes an
expired access token before replaying the request.

Request and response types are **generated** from the backend's published
contract rather than written by hand:

```bash
cd frontend
npm run gen:api             # backend/openapi.yaml -> src/api/generated/schema.d.ts
```

Re-run that after any change to the API, and TypeScript will point at every call
site that no longer matches.

### Integration status

Every screen renders from the API. There is no mock layer: what a page shows is
what the backend returned, and a failed request is reported rather than hidden
behind stale data.

Each feature has a typed module under `frontend/src/api/` — `complaints.ts`,
`maintenance.ts`, `bookings.ts`, `visitors.ts`, `announcements.ts`,
`dashboard.ts`, `directory.ts`, `residents.ts` — exposing TanStack Query hooks
built on the generated types. A write invalidates the queries it affects, so
the lists, counters and detail views cannot drift apart.

Two things depend on outside configuration:

- **Online payment** needs real Razorpay credentials. The backend verifies the
  gateway's signature before settling an invoice, so a payment cannot be
  confirmed without them. With the placeholder key the order is still recorded
  and the resident is told online payment cannot complete; a society official
  can record the payment against the invoice directly, which works fully.
- **The AI assistant** falls back to rule-based intent matching unless
  `GEMINI_API_KEY` is set. Either way it classifies the request and links to the
  screen that handles it.

Complaint photo attachments are not implemented: `attachment_urls` exists on
the API but there is no upload endpoint to store a file against it.

## Documentation

**Submitting?** [SUBMISSION.md](SUBMISSION.md) covers both submissions and what
still needs doing by hand.

**Deploying?** Everything is in [DEPLOYMENT.md](DEPLOYMENT.md) — Supabase, Render
and Vercel, explained step by step.

**Start with the [final report](docs/11-final-report.md)** — it compiles every
milestone and sprint, and covers the tools used, the testing results, the code
review and issue-tracking process, and where the delivered system differs from
the original design and why.

The design documents it draws on live in [docs/](docs/):

| | |
|---|---|
| [00 — Architecture Overview](docs/00-architecture-overview.md) | System overview, roles, epic mapping, technology delivery status |
| [01 — Frontend](docs/01-frontend-architecture.md) · [02 — Backend](docs/02-backend-architecture.md) | Per-layer architecture |
| [03 — Database](docs/03-database-architecture.md) · [09 — Database Design](docs/09-database-design.md) | Schema, isolation, migrations, ERD |
| [04 — ML](docs/04-ml-architecture.md) | Both models, training, evaluation, fallbacks |
| [05 — DevOps](docs/05-devops-architecture.md) | CI, environments, secrets, hosting status |
| [06 — Wireframes](docs/06-wireframes-and-workflow.md) · [07 — Components](docs/07-component-design.md) · [08 — Class Diagram](docs/08-class-diagram.md) | Design artifacts |
| [10 — Milestone 3 Report](docs/10-milestone-3-report.md) | Sprint 4 record: API inventory, test cases TC-01…TC-11, user feedback |
| [13 — Presentation](docs/13-presentation.md) · [PDF](docs/13-presentation.pdf) | Slide deck with speaker notes |
| [14 — Demo Script](docs/14-demo-script.md) | Running order for the recorded demonstration |

The backend also has its own [backend/README.md](backend/README.md) covering the
API in more detail, and the ML service has
[ml-service/README.md](ml-service/README.md).
