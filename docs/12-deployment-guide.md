# Deployment Guide

Frontend on **Vercel**, API and ML service on **Render**, database on
**Supabase Postgres** — the topology in
[05 — DevOps Architecture](05-devops-architecture.md).

Order matters: Supabase first (the API needs a database), then Render (Vercel
needs the API's URL), then Vercel last.

Budget about 45 minutes end to end, most of it waiting on Render's first build.

---

## Before you start

Everything below is committed and ready:

| File | What it does |
|---|---|
| `render.yaml` | Defines both Render services, their build and start commands, and every environment variable |
| `vercel.json` | Frontend build plus the `/api/*` rewrite to Render |
| `backend/alembic/` | Migrations that build the Postgres schema |

Push the branch you are deploying to GitHub first. Render and Vercel both read
from the repository, not from your machine.

---

## Step 1 — Supabase (the database)

1. Go to <https://supabase.com> → **New project**.
2. Name it `meridian`, set a **database password** (save it — it appears in the
   connection string and cannot be recovered later, only reset), pick the region
   closest to you, and create it. Provisioning takes a couple of minutes.
3. Once ready: **Project Settings → Database → Connection string → URI**.
4. Choose the **Session pooler** tab, not *Direct connection*.

   > **Why the pooler.** Render's free tier sleeps and wakes your service, and
   > each wake opens a fresh pool. Direct connections are capped low on
   > Supabase's free tier and you will exhaust them; the session pooler is built
   > for exactly this pattern.

5. Copy the URI. It looks like:

   ```
   postgresql://postgres.abcdefghijk:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
   ```

6. **Two edits before you use it:**
   - Replace `[YOUR-PASSWORD]` with the password from step 2.
   - Change the scheme `postgresql://` to **`postgresql+psycopg://`**.

   The scheme change is not cosmetic. SQLAlchemy picks its driver from it, and
   without `+psycopg` it reaches for `psycopg2`, which is not installed — the
   API would fail at startup with `ModuleNotFoundError`.

   Final form:

   ```
   postgresql+psycopg://postgres.abcdefghijk:yourpassword@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
   ```

7. Keep this string to hand. It is `DATABASE_URL` in the next step.

> If the password contains `@`, `:`, `/` or `#`, percent-encode it
> (`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`). An unescaped character
> there truncates the host and produces a confusing connection error.

---

## Step 2 — Render (API and ML service)

1. Go to <https://render.com> → **New → Blueprint**.
2. Connect the GitHub repository and select the branch you are deploying.
3. Render reads `render.yaml` and offers to create two services:
   **`meridian-api`** and **`meridian-ml`**. Approve both.
4. It will prompt for the variables marked `sync: false`. Fill in:

   | Service | Variable | Value |
   |---|---|---|
   | `meridian-api` | `DATABASE_URL` | The Supabase URI from step 1 |
   | `meridian-api` | `RAZORPAY_KEY_ID` | Razorpay test key, or leave blank |
   | `meridian-api` | `RAZORPAY_KEY_SECRET` | Razorpay test secret, or leave blank |
   | `meridian-api` | `RAZORPAY_WEBHOOK_SECRET` | Leave blank |
   | `meridian-api` | `GEMINI_API_KEY` | Gemini key, or leave blank |
   | `meridian-api` | `REDIS_URL` | Leave blank for now (see step 5) |
   | `meridian-api` | `ML_SERVICE_URL` | Leave blank — filled in at 4c |
   | `meridian-api` | `CORS_ORIGINS` | Leave blank — filled in at step 4 |
   | `meridian-ml` | `ML_SHARED_SECRET` | Leave blank — filled in at 4b |

   Blanks are safe. Every one of them has a documented fallback: no Razorpay
   means the API records an order and tells the resident online payment cannot
   complete; no Gemini means rule-based intent matching; no Redis means the
   in-process lock and rate limiter; no ML service means keyword classification.

5. Deploy. The first build takes 5–10 minutes per service.

### 4a. Confirm the API came up

Open `https://meridian-api.onrender.com/health` (substitute your real URL).
You want:

```json
{"status": "ok", "version": "1.0.0"}
```

Check the deploy log for `Running upgrade -> 42dd0171617a, initial schema` — that
is Alembic building the Postgres schema. `AUTO_CREATE_TABLES` is `false` here, so
migrations are the only thing that touches it.

### 4b. Join the two services with a shared secret

Render generates `ML_SHARED_SECRET` on the API but cannot copy it to a sibling.

1. `meridian-api` → **Environment** → reveal `ML_SHARED_SECRET` → copy it.
2. `meridian-ml` → **Environment** → paste it into `ML_SHARED_SECRET` → save.

Without this the ML service rejects the API's calls with 401, and the API
silently falls back to keyword classification — working, but not using the
trained models.

### 4c. Point the API at the ML service

1. Copy the ML service's URL, e.g. `https://meridian-ml.onrender.com`.
2. `meridian-api` → **Environment** → set `ML_SERVICE_URL` to it → save.

Include the scheme. The client builds its request URL by concatenation, so a
bare hostname produces an unusable URL.

Verify: `https://meridian-ml.onrender.com/health` should report both models
loadable:

```json
{"status": "ok", "models": {"complaint_classifier": true, "payment_risk": true}}
```

### 4d. Note the API URL

Copy `meridian-api`'s URL. You need it in step 3, and I need it to replace the
placeholder in `vercel.json`.

---

## Step 3 — Update the rewrite, then deploy Vercel

`vercel.json` currently points at a placeholder host. **Edit it before importing
to Vercel**, or the deployed frontend will call a domain that does not exist:

```json
"rewrites": [
  { "source": "/api/:path*",
    "destination": "https://YOUR-API.onrender.com/api/:path*" },
  { "source": "/health",
    "destination": "https://YOUR-API.onrender.com/health" },
  ...
]
```

Commit and push that change, then:

1. <https://vercel.com> → **Add New → Project** → import the repository.
2. **Root Directory: leave as the repository root.** Do not set it to
   `frontend/` — `vercel.json` lives at the root and already handles the build
   (`cd frontend && npm ci`, then `cd frontend && npm run build`, output
   `frontend/dist`).
3. Framework preset: **Other**. The config supplies everything.
4. No environment variables are needed. `VITE_API_BASE_URL` defaults to `/api`,
   which the rewrite forwards to Render.
5. Deploy.

---

## Step 4 — Close the loop on CORS

The rewrite means the browser calls `/api` on the Vercel origin, so normal use
never exercises CORS. Direct calls do — Swagger UI, `curl`, anything hitting the
Render URL straight.

Set `CORS_ORIGINS` on `meridian-api` to your Vercel URL:

```
https://meridian-098.vercel.app
```

Comma-separate if you have several (production plus a preview domain).

---

## Step 5 — Redis (optional)

Skip unless you want it. Without Redis the booking lock and rate limiter run
in-process, which is correct for a single Render instance — and the free tier
only ever runs one.

Redis matters when you run more than one instance: an in-process lock does
nothing about two workers, and a per-process rate-limit counter lets a caller
multiply their allowance by the worker count.

1. <https://upstash.com> → create a Redis database, same region as Render.
2. Copy the **`redis://` connection URL** (not the REST URL).
3. `meridian-api` → **Environment** → `REDIS_URL` → paste → save.

The startup log tells you which path is active:

```
Redis connected; using it for booking locks and rate limiting
```
or
```
REDIS_URL not set; using in-process lock and rate limiting
```

---

## Verifying the deployment

| Check | Expected |
|---|---|
| `https://<api>/health` | `{"status":"ok"}` |
| `https://<api>/api/docs` | Swagger UI loads |
| `https://<ml>/health` | Both models `true` |
| `https://<app>.vercel.app` | Sign-in page renders |
| Sign in as `resident@greenvalley.example` / `Password123` | Resident dashboard with seeded data |
| Raise a complaint with free text | Category and urgency filled automatically |
| Response headers on any API call | `X-RateLimit-Limit`, `X-Request-Id` present |

If sign-in fails but the page loads, the rewrite host is wrong — check the
browser network tab for a 404 on `/api/v1/auth/login`.

---

## Things that will bite you

**Free-tier spin-down.** Render free services sleep after ~15 minutes idle. The
next request takes **30–50 seconds** while the container wakes. This is the
single most likely thing to derail a live demo. Open the URL a minute before you
present, or demo locally and show the deployed URL as evidence.

**Supabase pausing.** Free projects pause after a week of inactivity. Un-pause
from the dashboard; the data survives.

**Seeding runs once.** `SEED_ON_STARTUP` is `true`, but `seed_if_empty` is a
no-op once any society exists, so redeploys will not duplicate the demo data —
and will not restore it if you delete it. To reset, drop the tables in Supabase
and redeploy.

**The demo accounts are public.** `Password123` on a public URL is fine for
grading and unacceptable for anything else. If this outlives the submission,
change the seeded passwords and rotate `JWT_SECRET`.

**A migration failure blocks startup.** Migrations run in the start command, so
if `alembic upgrade head` fails the service never serves. That is deliberate —
an API running against a half-built schema is worse than one that is down. The
deploy log will show the failure.
