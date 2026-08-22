# Meridian — Apartment Complex Management System

Team 98 · IITM Software Engineering, May 2026

A multi-tenant platform for apartment societies: one deployment serves many
societies, each isolated by `tenant_id`. It covers the six Milestone 1 epics —
maintenance payments, complaints, facility booking, visitor and emergency
management, society administration, and non-resident owner services.

```
MAY2026-Team-098/
├── frontend/     React + TypeScript + Vite single-page app
├── backend/      FastAPI + SQLAlchemy REST API
├── docs/         Architecture, component, class and database design
└── *.png         Diagrams referenced by the milestone reports
```

## Technologies

**Frontend** — React 18, TypeScript 5.5, Vite 5, React Router 6, Zustand 4
(session state), TanStack Query 5 (server state), Tailwind CSS 3,
openapi-typescript (API types generated from the backend spec), qrcode
(scannable guest passes).

**Backend** — FastAPI 0.115, SQLAlchemy 2.0, Pydantic 2.10, uvicorn, PyJWT
(HS256 access and refresh tokens), PBKDF2-SHA256 password hashing, SQLite by
default (PostgreSQL via `DATABASE_URL`), pytest 8.3.

**General** — Git and GitHub for version control and code review, Jira for
issue tracking, Swagger UI / OpenAPI 3.1 for the API contract.

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

```bash
cd backend
pytest                      # whole suite
pytest tests/test_auth.py   # one module
pytest -k booking           # by keyword
```

The frontend is typechecked as part of its build:

```bash
cd frontend
npm run typecheck           # tsc --noEmit
npm run build               # typecheck + production bundle
```

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

Architecture and design documents live in [docs/](docs/), and the backend has
its own [backend/README.md](backend/README.md) covering the API in more detail.
