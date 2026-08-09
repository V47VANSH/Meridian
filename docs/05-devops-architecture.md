# DevOps & Cloud Architecture

Owner: Person E · Parent doc: [00 — Architecture Overview](00-architecture-overview.md)

## 1. Hosting Targets (all free-tier)

| Component | Host | Notes |
|---|---|---|
| Frontend (React PWA) | Vercel | Auto-deploy from `main`, preview deploy per PR |
| Backend (FastAPI) | Render (Web Service, Docker) | Auto-deploy from `main` |
| ML service (FastAPI) | Render (Web Service, Docker) | Separate service, separate repo folder, own deploy |
| Database + Storage | Supabase | Postgres + object storage, bundled |
| Cache/Queue | Upstash Redis | Free tier, serverless-friendly (REST + TCP) |
| Payments | Razorpay | Test/sandbox mode, no real transactions |
| Email | SendGrid | Free tier (100/day) |
| SMS | Twilio | Trial credit |
| Error tracking | Sentry | Free tier |
| Uptime | Render health checks / UptimeRobot | Free |

No Terraform/IaC layer — at this scope, `render.yaml` + `vercel.json` + GitHub Actions workflow files **are** the infra-as-code; a full IaC tool would be overhead the team doesn't need for two Render services and one Vercel project.

## 2. Repository Structure (Monorepo)

```
/
  frontend/            # React PWA
  backend/             # FastAPI API
  ml-service/          # FastAPI ML service
  docs/                # this architecture, ADRs, etc.
  .github/workflows/   # CI/CD pipelines
  render.yaml          # Render service definitions (backend + ml-service)
  vercel.json          # Vercel project config (frontend)
```

One repo, not three, so a single PR can span frontend+backend when a feature genuinely requires both, and so CI can run contract-consistency checks across layers in one pipeline.

## 3. Branching & PR Workflow

- `main` is always deployable.
- Feature/task branches: `<layer>/<short-description>` (e.g. `backend/complaint-triage`, `frontend/sos-button`) or `<epic>/<task>` — team should pick one convention and stick to it; branch-per-task keeps PRs small and reviewable.
- Every PR requires: passing CI (see below) + at least one review from another teammate before merge — this is the "professional GitHub repo" requirement from the brief, enforced structurally rather than by agreement alone (branch protection rule on `main`).

## 4. CI Pipeline (GitHub Actions)

Three workflows, triggered on PR and on push to `main`:

**`ci-frontend.yml`** (path-filtered to `frontend/**`)
```
install → typecheck → lint → unit test (Vitest) → build
→ (on main) deploy handled by Vercel's own GitHub integration
```

**`ci-backend.yml`** (path-filtered to `backend/**`)
```
install (pip) → lint (ruff) → pytest (SQLite, no services needed)
→ spin up Postgres+Redis service containers → alembic upgrade head
→ pytest against Postgres (catches dialect-specific issues SQLite hides)
→ regenerate openapi.yaml, diff against committed spec
→ (on main) deploy to Render via Render's GitHub integration / deploy hook
```

The suite runs twice deliberately. The SQLite pass needs no service containers and gives fast feedback on every push; the Postgres pass catches the things SQLite is lenient about — partial index behaviour, stricter type coercion, and constraint enforcement differences.

**`ci-ml.yml`** (path-filtered to `ml-service/**`)
```
install → lint → pytest (unit + model-eval-floor check) → build
→ (on main) deploy to Render via deploy hook
```

Path-filtering means a frontend-only PR doesn't wait on ML tests and vice versa — keeps feedback loops fast despite one monorepo.

## 5. Environments

Given the free-tier target, the project runs two environments rather than three:

- **Preview**: Vercel/Render preview deploys per open PR (frontend gets this natively; backend preview environments are optional/skipped if Render's free tier makes them impractical — local docker-compose is the fallback for backend PR review)
- **Production**: `main` branch, always deployable, seeded with demo data for grading/demo purposes

A staging environment is deliberately not included — for a project of this scope and free-tier budget, it adds an environment to maintain without a corresponding real risk it protects against (no real users yet, no real money moving).

## 6. Secrets Management

- Local: `.env` files, gitignored, with a committed `.env.example` documenting every required variable
- CI: GitHub Actions Secrets (repo settings), injected as env vars per workflow
- Production: Render/Vercel's own environment variable dashboards — never written to a committed file

Secrets required: `DATABASE_URL`, `JWT_SECRET`, `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, `TWILIO_*`, `ML_SHARED_SECRET`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, `SENTRY_DSN`, `SUPABASE_*`.

## 7. Monitoring & Observability

- **Sentry**: wired into both frontend and backend; every unhandled exception reports with the `requestId` correlation ID described in [02 — Backend Architecture §10](02-backend-architecture.md#11-error-handling)
- **Uptime**: Render's built-in health check endpoint (`GET /health` on backend and ML service) + optionally UptimeRobot pinging it for a public status signal
- **Logs**: Render's built-in log viewer is sufficient at this scale — no need for a separate log aggregation service

## 8. Cost Summary

Every component above is free-tier: Vercel (hobby), Render (free web services, note: free tier services spin down on inactivity — acceptable for a demo/academic project, worth calling out explicitly so it isn't mistaken for a bug during grading), Supabase (free project), Upstash (free tier), Razorpay (test mode, no cost by definition), SendGrid (free 100/day), Twilio (trial credit), Sentry (free tier). Total infrastructure cost: **$0**, matching the "free and easy to integrate" requirement.
