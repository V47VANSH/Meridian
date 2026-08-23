# DevOps & Cloud Architecture

Owner: Person E · Parent doc: [00 — Architecture Overview](00-architecture-overview.md)

## 1. Hosting Targets

> **Delivery status.** The project is submitted as a **run-locally** system: three
> services started from the repository, with a zero-configuration SQLite database
> that seeds itself on first run. None of the hosts below were provisioned. The
> table is retained as the intended production topology, and the **Status** column
> says what is actually in the repository.
>
> This was a deliberate trade. Every hosted dependency below is one the system is
> built to run *without* — Postgres falls back to SQLite, Redis to an in-process
> lock plus a database constraint, the ML service to a keyword classifier, the
> gateway to an official recording payment manually. Provisioning them would have
> bought a URL, not a capability.

| Component | Host | Status |
|---|---|---|
| Frontend (React SPA) | Vercel | Planned — run locally via Vite dev server / `npm run build` |
| Backend (FastAPI) | Render | Planned — run locally via uvicorn |
| ML service (FastAPI) | Render | Planned — run locally via uvicorn |
| Database | Supabase Postgres | Planned — **SQLite is the delivered default**; the Postgres path is exercised in CI |
| Object storage | Supabase Storage | Not built — this is why complaint photo upload is not implemented |
| Cache/Queue | Upstash Redis | Not built — in-process booking lock + partial unique index instead |
| Payments | Razorpay | **Implemented server-side** (HMAC verification); test-mode credentials required to complete a checkout |
| Email | SendGrid | Not built |
| SMS | Twilio | Not built |
| Error tracking | Sentry | Not built |
| Uptime | UptimeRobot | Not built — `/health` endpoints exist on backend and ML service |

There is no Terraform/IaC layer, and at this scope there does not need to be: the
GitHub Actions workflow files are the only infrastructure definition committed.
`render.yaml` and `vercel.json` would be added alongside a real deployment.

## 2. Repository Structure (Monorepo)

```
/
  frontend/            # React SPA
  backend/             # FastAPI API
  ml-service/          # FastAPI ML service (both models)
  docs/                # architecture, design and milestone reports
  .github/workflows/   # CI pipelines (ci-backend, ci-frontend, ci-ml)
```

One repo, not three, so a single PR can span frontend+backend when a feature genuinely requires both, and so CI can run contract-consistency checks across layers in one pipeline.

## 3. Branching & PR Workflow

- `main` is always deployable.
- Feature/task branches: `<layer>/<short-description>` (e.g. `backend/complaint-triage`, `frontend/sos-button`) or `<epic>/<task>` — team should pick one convention and stick to it; branch-per-task keeps PRs small and reviewable.
- Every PR requires: passing CI (see below) + at least one review from another teammate before merge — this is the "professional GitHub repo" requirement from the brief, enforced structurally rather than by agreement alone (branch protection rule on `main`).

## 4. CI Pipeline (GitHub Actions)

Three workflows, triggered on PR and on push to `main`. There is no deploy stage
in any of them, because nothing is hosted (§1).

**`ci-frontend.yml`** (path-filtered to `frontend/**` and `backend/openapi.yaml`)
```
npm ci → typecheck (tsc --noEmit)
→ regenerate the API types, fail if they differ from the committed ones
→ build
```

The generated-types check is the important one. The client is codegen'd from the
backend's published contract, so if the spec moved and the types were not
regenerated, the app would typecheck against a contract the API no longer serves
— the exact drift a generated client exists to prevent.

> There is no lint step and no unit-test step: the frontend has no ESLint config
> and no test suite. `tsc --noEmit` is the type gate that runs in their place.
> Adding Vitest and React Testing Library is the largest single item of remaining
> work on the frontend.

**`ci-backend.yml`** (path-filtered to `backend/**`)
```
job "test":     pip install → ruff check → pytest (SQLite, no services needed)
                → re-export openapi.yaml, fail if the committed spec moved
job "postgres": postgres:16 service container → alembic upgrade head
                → alembic check (empty autogenerate diff)
```

The second job is what SQLite cannot tell us: whether the migrations actually
apply on the engine production would run, and whether a model changed without a
matching revision. It runs the migrations, not the test suite — the suite pins
its own throwaway SQLite database in `conftest.py`, so running it against the
Postgres container would not exercise Postgres.

**`ci-ml.yml`** (path-filtered to `ml-service/**`)
```
job "test":    pip install → ruff check → pytest (contract, unit, metric floors)
job "retrain": retrain both models; each trainer exits non-zero if its
               held-out metric falls below the floor it declares
```

Path-filtering means a frontend-only PR doesn't wait on ML tests and vice versa —
keeps feedback loops fast despite one monorepo.

## 5. Environments

**As delivered, there is one environment: the developer's machine.** `main` is
always runnable — a clone plus the README's steps gives a working system with a
seeded demo society, which is what the submission is graded against.

The intended production topology was two environments (per-PR preview and a
`main` production deploy), with staging deliberately excluded: for a project with
no real users and no real money moving, staging adds an environment to maintain
without a corresponding risk it protects against. That reasoning still holds; it
simply has not been exercised, because nothing is deployed.

## 6. Secrets Management

- **Local**: `.env` files, gitignored, with a committed `.env.example` in
  `backend/` and `frontend/` documenting every variable and its default.
- **CI**: the workflows inject only non-secret placeholder values
  (`JWT_SECRET: ci-secret`, `RAZORPAY_KEY_SECRET: ci_gateway_secret`) because the
  suite needs no real credentials. A deploy stage would move these to GitHub
  Actions Secrets.
- **Production**: the host's environment variable dashboard — never a committed
  file. Not exercised.

Variables the delivered system reads: `DATABASE_URL`, `JWT_SECRET`,
`ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`,
`PASSWORD_HASH_ROUNDS`, `ML_SERVICE_URL`, `ML_SHARED_SECRET`,
`ML_TIMEOUT_SECONDS`, `ML_CONFIDENCE_THRESHOLD`,
`PAYMENT_RISK_REMINDER_THRESHOLD`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `CORS_ORIGINS`,
`SEED_ON_STARTUP`. Every one has a working default, so the project runs with no
`.env` at all.

`SENDGRID_API_KEY`, `TWILIO_*`, `VAPID_*`, `SENTRY_DSN` and `SUPABASE_*` belong
to the components in §1 that were not built, and are not read by any code.

## 7. Monitoring & Observability

- **Health checks**: `GET /health` on the backend and on the ML service. The ML
  probe additionally reports whether each trained artifact is loadable — a
  service that is up but has no model would fail every request, so the two states
  are distinguished.
- **Request correlation**: every response carries `X-Request-Id`, and the same id
  appears in the error body and the server log line — see
  [02 — Backend Architecture §11](02-backend-architecture.md#11-error-handling).
  The frontend surfaces it on error screens so a user-reported failure can be
  traced to its exact log entry.
- **Error tracking**: Sentry is **not** wired in. The correlation id above is the
  delivered substitute; an SDK would be the first addition alongside a deployment.
- **Uptime**: no external monitor, since there is no public endpoint to poll.

## 8. Cost

Total infrastructure cost: **$0** — nothing is provisioned. The intended topology
was chosen to stay free-tier throughout (Vercel hobby, Render free web services,
Supabase free project, Upstash free tier, Razorpay test mode, SendGrid 100/day,
Twilio trial credit, Sentry free tier), so cost was never the constraint that
decided against deploying; time on the final milestone was.

One note worth carrying forward: Render's free web services spin down on
inactivity, so a first request after a quiet period takes several seconds. That
is worth stating explicitly in any future deployment so it is not mistaken for a
performance defect.
