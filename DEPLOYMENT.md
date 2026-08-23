# Deploying Meridian

A complete, standalone walkthrough. Follow it top to bottom — the order matters,
because each step needs a value produced by the one before it.

**Three services:**

| Part | Host | Root directory |
|---|---|---|
| Frontend (React SPA) | Vercel | `frontend` |
| API (FastAPI) | Render | `backend` |
| ML service (FastAPI) | Render | `ml-service` |
| Database | Supabase Postgres | — |
| Redis (optional) | Upstash | — |

**Budget ~45 minutes**, most of it waiting on Render's first build.

---

## Read this first: who has to do what

**The Render GitHub App must be installed by the account that OWNS the
repository.** This is the single thing most likely to stop you before you start.

A GitHub App installation is per-account. Installing it on your own account
grants access to *your* repositories — collaborator access to someone else's
repo is not enough, and the repo simply will not appear in Render's list. The
setting even says so: *"applies to all repositories owned by the resource
owner."*

Since this repo is owned by **V47VANSH**, that account has to install the app.
If you are V47VANSH, you are fine and this will just work.

> **If the repo owner is unavailable**, two alternatives:
>
> - Make the repository **public**. Render's app includes public repositories
>   read-only, so it becomes visible to any installation. Nothing sensitive is
>   committed — verified: no `.env`, no credentials, only `.env.example`
>   templates.
> - Use Render's **"Public Git Repository"** option and paste the clone URL.
>   No GitHub App at all. Also requires the repo to be public, and you lose
>   auto-deploy on push (redeploy is one button).

---

## Credentials you need before starting

Fill these in as you go. **Do not commit this table with real values** — they
belong in the Render dashboard only.

| Value | Where it comes from | Yours |
|---|---|---|
| `DATABASE_URL` | Supabase, step 1 | |
| `REDIS_URL` | Upstash (optional), step 5 | |
| API URL | Render, after step 2a | |
| ML URL | Render, after step 2b | |
| Vercel URL | Vercel, after step 4 | |

If someone is handing you the Supabase and Upstash credentials, get them over a
private channel — not in a commit, an issue, or a chat log that will be shared.

Everything else has a working default. Razorpay and Gemini keys are genuinely
optional; see *What runs without credentials* at the end.

---

## Step 1 — Supabase (database)

1. <https://supabase.com> → **New project**.
2. Name it, set a **database password**, choose the nearest region, create.
   Save the password — it cannot be recovered later, only reset.
3. Wait for provisioning (~2 min).
4. **Project Settings → Database → Connection string → URI**, then pick a
   **pooler** tab (either *Session* `:5432` or *Transaction* `:6543` — both work).

   > **Not "Direct connection."** Supabase's direct endpoint is IPv6-only and
   > Render cannot reach it. The poolers are dual-stack. Direct connections are
   > also capped low on the free tier, and Render's free instances sleep and wake
   > repeatedly, opening a fresh pool each time.
   >
   > Either pooler mode is safe here. The engine disables psycopg's implicit
   > prepared statements (`backend/app/db/session.py`) precisely so transaction
   > mode works — without that, it fails intermittently, under load, in
   > production only.

5. Copy the URI and make **two edits**:
   - Replace `[YOUR-PASSWORD]` with your actual password.
   - Change the scheme `postgresql://` → **`postgresql+psycopg://`**.

   The scheme is not cosmetic. SQLAlchemy chooses its driver from it; without
   `+psycopg` it reaches for `psycopg2`, which is not installed, and the API dies
   at startup with `ModuleNotFoundError`.

   Result:

   ```
   postgresql+psycopg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

   > If the password contains `@ : / #`, percent-encode it
   > (`@`→`%40`, `:`→`%3A`, `/`→`%2F`, `#`→`%23`). An unescaped character there
   > silently truncates the host.

---

## Step 2 — Render

### 2a. API service

**New → Web Service** → connect the repository → configure:

| Setting | Value |
|---|---|
| Name | `meridian-api` |
| Language | **Python 3** |
| Branch | `main` |
| **Root Directory** | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |
| Health Check Path | `/health` |

**Environment variables:**

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.11.9` |
| `DATABASE_URL` | from step 1 |
| `AUTO_CREATE_TABLES` | `false` |
| `SEED_ON_STARTUP` | `true` |
| `JWT_SECRET` | click **Generate** |
| `ML_SHARED_SECRET` | click **Generate**, then copy it — you need it again in 2b |
| `TRUST_PROXY_HEADERS` | `true` |

Leave `ML_SERVICE_URL`, `REDIS_URL`, `RAZORPAY_*`, `GEMINI_API_KEY` and
`CORS_ORIGINS` unset for now.

**Two of these fail silently if you get them wrong, so they are worth
understanding rather than pasting:**

- **`AUTO_CREATE_TABLES=false`** — otherwise the app builds the schema from the
  ORM models at startup, creating tables Alembic never stamped a revision for.
  The next `alembic upgrade` then fails on tables that already exist, and the
  service will not start.
- **`TRUST_PROXY_HEADERS=true`** — correct *here specifically*, because Render
  terminates TLS and overwrites `X-Forwarded-For`. It must stay `false` anywhere
  the header is client-supplied, or any caller resets their own rate-limit
  counter just by varying it.

Deploy. First build takes 5–10 minutes.

**Then check the deploy log for:**

```
Running upgrade  -> 42dd0171617a, initial schema
```

That is Alembic building the Postgres schema. If you see it, the database
connection works.

### 2b. ML service

**New → Web Service** → same repository:

| Setting | Value |
|---|---|
| Name | `meridian-ml` |
| Language | **Python 3** |
| **Root Directory** | `ml-service` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |
| Health Check Path | `/health` |

Environment variables:

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.11.9` |
| `ML_SHARED_SECRET` | **the exact value generated on the API in 2a** |

Trained models are committed, so it serves predictions as soon as it boots —
there is no training step in the build.

### 2c. Point the API at the ML service

On **`meridian-api`** → Environment → add:

| Key | Value |
|---|---|
| `ML_SERVICE_URL` | the ML service's URL, **including `https://`** |

e.g. `https://meridian-ml.onrender.com`. A bare hostname will not work — the
client builds its request URL by string concatenation.

Save; Render redeploys.

> **If `ML_SHARED_SECRET` does not match on both services**, the ML service
> returns 401 and the API silently falls back to keyword classification.
> Everything still appears to work, which is exactly why this is easy to miss.
> Step 6 tells you how to check.

---

## Step 3 — Point the frontend at the API

> **Already done for the current deployment.** `frontend/vercel.json` points at
> <https://may2026-team-098.onrender.com>. Skip to step 4 unless you are
> deploying the API somewhere else.

Edit **`frontend/vercel.json`** and set the host in **both** rewrite rules to
your API URL from 2a:

```json
{ "source": "/api/:path*",
  "destination": "https://YOUR-API.onrender.com/api/:path*" },
{ "source": "/health",
  "destination": "https://YOUR-API.onrender.com/health" }
```

Commit and push. Vercel redeploys automatically on push.

**Why a rewrite rather than pointing the app at the API directly:** the browser
calls `/api` on the Vercel origin and Vercel forwards it to Render, so
everything stays same-origin. CORS is never exercised, and no API URL is baked
into the JavaScript bundle — the same build works against any backend.

> **`vercel.json` must live in `frontend/`, not the repository root.** Vercel
> reads it from whatever Root Directory the project is configured with. A copy at
> the root is silently ignored, taking the API rewrite with it — the site loads
> fine and then 404s on every API call.

---

## Step 4 — Vercel (frontend)

1. <https://vercel.com> → **Add New → Project** → import the repository.
2. Settings:

   | Setting | Value |
   |---|---|
   | **Root Directory** | `frontend` |
   | Framework Preset | **Vite** (auto-detected) |
   | Build Command | default (`npm run build`) |
   | Output Directory | default (`dist`) |
   | Environment Variables | none needed |

3. Deploy.

`npm run build` runs `tsc && vite build`, so a type error fails the deploy rather
than shipping a broken bundle.

---

## Step 5 — Optional extras

None of these are required. Each has a working fallback, and the app is fully
demonstrable without any of them.

### Redis (Upstash)

Only matters if you run more than one instance — and Render's free tier runs
one. Without Redis, the booking lock and rate limiter use in-process
equivalents, which are correct for a single instance.

<https://upstash.com> → create a Redis database → copy the **`rediss://`
connection URL** (not the REST URL) → set `REDIS_URL` on `meridian-api`.

The startup log tells you which path is live:
`Redis connected...` or `REDIS_URL not set...`

### CORS

Only needed for direct calls to the Render URL (Swagger UI, `curl`). The Vercel
rewrite means normal browser use never touches CORS.

Set `CORS_ORIGINS` on `meridian-api` to your Vercel URL, comma-separated if
several.

### Razorpay and Gemini

`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (test mode) and `GEMINI_API_KEY`. See
*What runs without credentials* below for exactly what changes.

---

## Step 6 — Verify

| Check | Expected |
|---|---|
| `https://<api>/health` | `{"status":"ok","version":"1.0.0"}` |
| `https://<api>/api/docs` | Swagger UI loads |
| `https://<ml>/health` | `"models": {"complaint_classifier": true, "payment_risk": true}` |
| `https://<app>.vercel.app` | Sign-in page renders |
| Sign in `resident@greenvalley.example` / `Password123` | Resident dashboard with seeded data |

**To prove the API and ML service are actually talking:** sign in as a resident,
raise a complaint with free text, leaving category and urgency on *"Detect from
description"*. If the category and urgency come back filled and the complaint is
**not** flagged for triage, the trained model answered. If it *is* flagged, the
shared secret or `ML_SERVICE_URL` is wrong — everything else keeps working, which
is why this needs checking deliberately.

### If something is wrong

| Symptom | Cause |
|---|---|
| Site loads, sign-in fails, network tab shows 404 on `/api/v1/auth/login` | Rewrite host in `frontend/vercel.json` is wrong or still the placeholder |
| API build fails: no `requirements.txt` | Root Directory not set to `backend` / `ml-service` |
| API starts then exits, `ModuleNotFoundError: psycopg2` | Scheme is `postgresql://`, needs `postgresql+psycopg://` |
| API exits during `alembic upgrade` | Database unreachable — wrong password, unescaped special character, or Direct connection instead of a pooler |
| `alembic upgrade` fails: relation already exists | `AUTO_CREATE_TABLES` was not set to `false` on a previous deploy. Drop the tables in Supabase and redeploy |
| Complaints always flagged "needs triage" | `ML_SHARED_SECRET` mismatch, or `ML_SERVICE_URL` missing its scheme |
| First request takes 30–50s | Free-tier spin-down. Normal. See below |

---

## What runs without credentials

Every optional integration degrades to a working fallback rather than an error.
This is deliberate, and it is why you can deploy with almost nothing configured:

| Unset | Behaviour |
|---|---|
| `ML_SERVICE_URL` | Complaints classified by keyword rules and flagged for manual triage |
| `GEMINI_API_KEY` | AI assistant uses rule-based intent matching; still routes to the right screen |
| `RAZORPAY_*` | Payment order is still recorded; the resident is told online payment cannot complete, rather than shown a false receipt. An official records payment manually |
| `REDIS_URL` | In-process booking lock and rate limiter |
| `CORS_ORIGINS` | Fine — the Vercel rewrite keeps everything same-origin |

---

## Things that will bite you

**Free-tier spin-down.** Render free services sleep after ~15 minutes idle, and
the next request takes **30–50 seconds** while the container wakes. This is the
single most likely thing to derail a live demo. **Open both URLs a minute before
you present** — the API *and* the ML service.

**Spin-down silently disables the ML service.** This one is worth understanding,
because nothing about it looks like a failure. The API gives the ML service
`ML_TIMEOUT_SECONDS` to answer, defaulting to **2 seconds** — deliberately
short, because complaint submission must never wait on a slow model. A sleeping
Render instance needs 30–50 seconds to wake. So the first complaint after an idle
period times out, the keyword fallback answers, the complaint is created and
flagged for manual triage, and everything looks fine.

You can tell which one answered: a complaint classified by the trained model
comes back with `classification_confidence` around 0.9 and
`needs_manual_triage: false`. The fallback returns confidence `0.0` and always
flags for triage.

Two ways to handle it, and they are complementary:

- **Warm the ML service before it matters** — open its `/health` a minute before
  a demo. Free instances stay awake ~15 minutes after a request.
- **Raise the timeout** on the API service: `ML_TIMEOUT_SECONDS=10` is a
  reasonable compromise for free-tier hosting. Do not raise it much further —
  the number is the length of time a resident waits before their complaint is
  accepted, and the fallback exists precisely so they do not have to.

**Supabase pausing.** Free projects pause after a week of inactivity. Un-pause
from the dashboard; data survives.

**Seeding runs once.** `SEED_ON_STARTUP=true` is safe across redeploys —
`seed_if_empty` is a no-op once any society exists. It also will not restore data
you delete. To reset: drop the tables in Supabase, redeploy.

**The demo accounts are public.** `Password123` on a public URL is fine for
grading and unacceptable for anything else. If this outlives the submission,
change the seeded passwords and rotate `JWT_SECRET`.

**A migration failure blocks startup, on purpose.** Migrations run in the start
command, so if `alembic upgrade head` fails the service never serves. An API
answering against a half-built schema is worse than one that is plainly down, and
the deploy log tells you exactly what failed.

---

## Reference

- `render.yaml` — the same two services as a Blueprint. If Render's Blueprint
  flow works for you, it produces exactly the configuration above.
- `frontend/VERCEL.md` — why `vercel.json` lives where it does.
- `backend/.env.example` — every backend variable with its default.
- `docs/05-devops-architecture.md` — CI, environments, secrets, monitoring.
