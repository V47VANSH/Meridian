# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Meridian** — a multi-tenant apartment society management platform (IITM Software
Engineering, Team 98). One deployment serves many societies, each isolated by
`tenant_id`. Three services in one repo: a React SPA, a FastAPI API, and a
separate FastAPI ML service.

## Commands

Run these from the directory named in each block.

### Backend (`backend/`)

```bash
python -m venv .venv && .venv\Scripts\activate   # Windows; source .venv/bin/activate elsewhere
pip install -r requirements.txt

uvicorn app.main:app --reload        # http://localhost:8000, Swagger at /api/docs
pytest                               # whole suite (131 tests)
pytest tests/test_bookings.py        # one module
pytest -k booking                    # by keyword
pytest tests/test_auth.py::test_refresh_rotates_the_token_and_revokes_the_old_one   # one test
ruff check .                         # lint (config in ruff.toml)
ruff check . --fix

python scripts/export_openapi.py     # regenerate openapi.yaml from the live routes
alembic revision --autogenerate -m "..."   # after any models.py change

# alembic upgrade/check need a database built BY the migrations. The local
# acms.db is built by create_all and carries no revision stamp, so running
# these against it reports "Target database is not up to date". Use a scratch
# database instead — this is what CI does:
DATABASE_URL=sqlite:///./scratch.db alembic upgrade head
DATABASE_URL=sqlite:///./scratch.db alembic check   # empty diff = models match revisions
```

`pytest tests/test_migrations.py` is the check you actually want day to day — it
builds the schema both ways and compares them, with no scratch database to manage.

### Frontend (`frontend/`)

```bash
npm install
npm run dev          # http://localhost:5173, proxies /api to the backend
npm run typecheck    # tsc --noEmit — the only test gate the frontend has
npm run build        # typecheck + production bundle
npm run gen:api      # backend/openapi.yaml -> src/api/generated/schema.d.ts
```

There is no frontend test suite and no ESLint config. `npm run typecheck` is what
CI runs in their place.

### ML service (`ml-service/`)

```bash
pip install -r requirements.txt
uvicorn app.main:app --port 8100
pytest                               # 21 tests
python -m app.complaints.train       # retrain; writes model.pkl + metadata.json
python -m app.payment_risk.train
```

Optional for local work — see *ML never blocks* below.

## The rule that matters most: the contract is generated, never hand-written

```
FastAPI routes  ->  backend/openapi.yaml  ->  frontend/src/api/generated/schema.d.ts
```

**After any change to a route, request model or response model:**

```bash
cd backend  && python scripts/export_openapi.py
cd frontend && npm run gen:api
```

Then commit both generated files. CI fails the build if either has drifted
(`ci-backend.yml` re-exports and diffs; `ci-frontend.yml` regenerates and diffs).
Skipping this means the frontend typechecks against a contract the API no longer
serves.

Frontend feature code imports types from `src/api/types.ts`, which re-exports the
generated schema under friendly names — not from `generated/schema.d.ts` directly,
so a regenerated contract breaks in one file rather than at every call site.

## Architecture

### Backend — modular monolith, one router per epic

`backend/app/api/v1/<epic>.py`: `auth`, `tenants`, `maintenance`, `complaints`,
`bookings`, `visitors`, `announcements`, plus `dashboard` (per-role aggregates)
and `ai` (the assistant). Wired with `APIRouter` + `Depends()` rather than a
global container, so a route's auth, role and tenant requirements are readable
from its signature.

**Three dependencies carry the security model** (`app/core/deps.py`):

| Dependency | Purpose |
|---|---|
| `get_current_user` | Decodes the bearer token |
| `require_roles(Role.X, ...)` | Role gate |
| `get_tenant_id` | **Society scope, read from the token claim only — never a body or query parameter** |

Every tenant-scoped query must filter on `get_tenant_id`. Cross-tenant reads
return **404, not 403**, because confirming a record exists would leak that
another society holds that id. `tests/test_tenant_isolation.py` attempts every
cross-society path with a foreign token.

**Uniform error contract** — `app/core/errors.py` maps every failure to
`{statusCode, error, message, requestId}`. `error` is a stable machine-readable
code the frontend branches on; there are 44, catalogued in `openapi_extras.py` and
published in the spec as `x-error-catalogue`. Raise the typed errors
(`NotFoundError`, `ConflictError`, `ForbiddenError`, `BadRequestError`) rather
than `HTTPException`.

### Frontend — one API module per feature

`frontend/src/api/<feature>.ts` exports a query-key object, plain fetch functions,
and TanStack Query hooks. Mutations invalidate the keys they affect, which is what
keeps lists, counters and detail views from drifting apart. Follow the existing
shape in `complaints.ts` when adding a feature.

- `src/api/client.ts` — the only place the app talks to the API. Attaches the
  bearer token, unwraps errors into a typed `ApiError`, and refreshes an expired
  access token before replaying the request. That refresh is **single-flight**:
  the backend revokes a refresh token as it rotates it, so concurrent refreshes
  would log the user out.
- `src/store/authStore.ts` — Zustand, session only. Deliberately performs no
  network calls; `client.ts` reads tokens from it, so importing the client here
  would create a cycle.
- Server state lives in TanStack Query, session state in Zustand. They are not
  interchangeable.

There is **no mock data layer** — it was deleted. Every screen renders from the
API. Do not reintroduce fixtures to make a screen "work".

### Database — two paths to one schema

Local runs and the test suite build the schema from model metadata
(`Base.metadata.create_all`); Postgres is migrated with Alembic. Two paths can
drift, so **`tests/test_migrations.py` builds both and compares them
structurally** — columns, foreign keys, indexes, CHECK constraints. A model change
without a matching revision fails there, not on deploy. Run
`alembic revision --autogenerate` whenever you touch `models.py`.

Enums are `VARCHAR` + `CHECK`, not native Postgres enums. Booking double-booking is
prevented by a **partial unique index** on `slot_id WHERE status = 'CONFIRMED'`
(plus an in-process lock); the index is the real guarantee.

### ML never blocks a user action

`backend/app/services/ml_client.py` calls the ML service and falls back to a
deterministic classifier on timeout, transport error, bad response, **or
confidence below `ML_CONFIDENCE_THRESHOLD`**. When `ML_SERVICE_URL` is unset — the
default — the fallback is always used and complaints are flagged
`needs_manual_triage`. That is designed behaviour, not a failure. The same holds
for the Gemini assistant (`ai_service.py`) and payment-risk scoring.

Preserve this property in any change: complaint submission must never fail
because ML is down.

### Tests

`pytest` with FastAPI's `TestClient`. **Each test gets its own throwaway SQLite
database** — `conftest.py` sets `DATABASE_URL`, `JWT_SECRET`, `SEED_ON_STARTUP` and
a low `PASSWORD_HASH_ROUNDS` before any app module is imported. No PostgreSQL, no
Redis, no running server. Use the `society`, `login` and `client` fixtures.

## Conventions

- Commit messages: imperative subject, then prose explaining *why* — including
  what was wrong before, when fixing something. Match the existing history.
- `main` is always runnable; work on a branch and merge via reviewed PR.
- Jira issue ids (`SCRUM-xx`) appear in commit subjects where a board item exists.
- Docstrings explain the reasoning behind a decision, not what the code does.

## Designed but not built

Do not assume these exist; several docs describe them as intent. WebSocket/realtime
gateway (clients poll), Redis, push/email/SMS delivery (channels are routed and
logged; the in-app `Notification` row is always written), **rate limiting** (a
`RATE_LIMITED` code is reserved but nothing enforces it), PWA/service worker,
frontend tests, Sentry, and any deployment (`render.yaml`/`vercel.json` do not
exist). `docs/00-architecture-overview.md` §5 has a Status column; `docs/11-final-report.md`
Part G explains each deviation.

## Docs

`docs/11-final-report.md` is the entry point — it compiles every milestone and
sprint. `docs/00`–`09` are living design docs, kept in sync with the code.
`docs/10` is a **dated Sprint 4 record, deliberately not updated** — annotate it,
never rewrite it. `backend/README.md` and `ml-service/README.md` cover their
services in more detail.
