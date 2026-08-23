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
| `render.yaml` | Both Render services as a Blueprint. If the Blueprint flow fails, step 2 lists the same settings to enter by hand |
| `frontend/vercel.json` | The `/api/*` rewrite to Render and the SPA fallback |
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
4. Choose a **pooler** tab, not *Direct connection*.

   > **Why a pooler.** Render's free tier sleeps and wakes your service, and
   > each wake opens a fresh pool. Direct connections are capped low on
   > Supabase's free tier and you will exhaust them; the poolers are built for
   > exactly this pattern.
   >
   > **Session (`:5432`) or transaction (`:6543`) both work.** They differ in
   > whether a client keeps one backend for the whole connection or gets one per
   > transaction, which matters because psycopg prepares statements implicitly
   > and a prepared statement does not survive being handed a different backend.
   > The engine disables implicit prepared statements
   > (`prepare_threshold=None` in `backend/app/db/session.py`) precisely so
   > either mode is safe — without it, transaction mode fails intermittently
   > under load and only in production, which is a miserable thing to debug.

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

## Step 2 — Render (API and ML service), created by hand

The Blueprint flow reads `render.yaml` and creates both services in one go. If
it does not appear or errors, create the two services manually — the settings
below are exactly what `render.yaml` declares, so the outcome is identical.

### 2a. The API service

**New → Web Service** → connect the repository → then:

| Setting | Value |
|---|---|
| Name | `meridian-api` |
| Language | `Python 3` |
| Branch | the branch you are deploying |
| **Root Directory** | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |
| Health Check Path | `/health` |

> The start command runs migrations before the server. If `alembic upgrade head`
> fails, the service never serves — deliberately. An API answering against a
> half-built schema is worse than one that is plainly down, and the deploy log
> shows exactly what failed.

**Environment variables** (Advanced → Add Environment Variable):

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.11.9` |
| `DATABASE_URL` | your Supabase URI from step 1 |
| `AUTO_CREATE_TABLES` | `false` |
| `SEED_ON_STARTUP` | `true` |
| `JWT_SECRET` | click **Generate** |
| `ML_SHARED_SECRET` | click **Generate** |
| `TRUST_PROXY_HEADERS` | `true` |
| `REDIS_URL` | your Upstash `rediss://` URL, or leave unset |

`AUTO_CREATE_TABLES=false` is the one that must not be missed. Left at its
default the app would build the schema from the models at startup, producing
tables Alembic never stamped a revision for — and the next `alembic upgrade`
would then fail on tables that already exist.

`TRUST_PROXY_HEADERS=true` is correct **here specifically**, because Render
terminates TLS and overwrites `X-Forwarded-For`. It must stay `false` anywhere
the header is client-supplied, or a caller resets their own rate-limit counter
by varying it.

Leave `ML_SERVICE_URL`, `RAZORPAY_*`, `GEMINI_API_KEY` and `CORS_ORIGINS` unset
for now. Every one has a working fallback.

Deploy. First build takes 5–10 minutes.

### 2b. The ML service

**New → Web Service** → same repository → then:

| Setting | Value |
|---|---|
| Name | `meridian-ml` |
| Language | `Python 3` |
| **Root Directory** | `ml-service` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |
| Health Check Path | `/health` |

Environment variables:

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.11.9` |
| `ML_SHARED_SECRET` | **the same value you generated on the API** |

Trained artifacts are committed, so it serves predictions as soon as it boots —
there is no training step in the build.

### 2c. Join the two services

1. Copy the ML service's URL, e.g. `https://meridian-ml.onrender.com`.
2. On `meridian-api`, set `ML_SERVICE_URL` to it, **including the scheme**, and
   save. Render redeploys.

A bare hostname will not work: the client builds its request URL by
concatenation, so the scheme has to be there.

If `ML_SHARED_SECRET` does not match on both services, the ML service returns
401 and the API quietly falls back to keyword classification. Everything keeps
working, which is exactly why this is easy to miss — check it explicitly at 2d.

### 2d. Verify before moving on

| Check | Expected |
|---|---|
| `https://<api>/health` | `{"status":"ok","version":"1.0.0"}` |
| API deploy log | `Running upgrade -> 42dd0171617a, initial schema` |
| API deploy log | `Redis connected` if you set `REDIS_URL`, otherwise `REDIS_URL not set` |
| `https://<ml>/health` | both models `true` |
| `https://<api>/api/docs` | Swagger UI loads |

To confirm the two services are really talking, sign in and raise a complaint
with free text — if the category and urgency come back filled and the complaint
is *not* flagged for manual triage, the trained model answered. If it is flagged,
the shared secret or `ML_SERVICE_URL` is wrong.

### 2e. Note the API URL

Copy `meridian-api`'s URL. It goes into `frontend/vercel.json` next.

---

## Step 3 — Point the frontend at the API

`frontend/vercel.json` ships with a placeholder host. Replace it in **both**
rewrite rules:

```json
{ "source": "/api/:path*",
  "destination": "https://YOUR-API.onrender.com/api/:path*" },
{ "source": "/health",
  "destination": "https://YOUR-API.onrender.com/health" }
```

Commit and push. Vercel redeploys on push.

> `vercel.json` lives in `frontend/`, not at the repository root, because the
> Vercel project uses **Root Directory = `frontend`**. Vercel only reads the file
> from the root directory it was given, so a copy at the repository root is
> silently ignored — along with the API rewrite. See `frontend/VERCEL.md`.

Vercel project settings: Root Directory `frontend`, framework preset **Vite**
(auto-detected), default build and output. No environment variables are needed —
`VITE_API_BASE_URL` defaults to `/api`, which the rewrite forwards to Render.

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
