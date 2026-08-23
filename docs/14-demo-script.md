# Demo Script

A running order for the recorded demonstration. Roughly **8 minutes** of
screen recording, after the slides.

The ordering is deliberate: it follows one complaint and one visitor through the
system end to end, so each step is the *consequence* of the last rather than a
tour of unrelated screens. Two roles are signed in at once throughout, which is
what makes cause and effect visible.

---

## Pre-flight

Do all of this **before** you start recording.

| | |
|---|---|
| Database | Delete `backend/acms.db` so seeding runs fresh — or use the deployed site |
| Backend | Running, `/health` answers |
| ML service | Running, `/health` shows both models `true` |
| Frontend | Running |
| `ML_SERVICE_URL` | **Set**, and the backend restarted since. Without it every complaint is keyword-classified and step 4 shows nothing |
| Browser | Two windows: one normal, one incognito. Zoom ~110% |
| Screen | Close other tabs, silence notifications, hide bookmarks bar |

**If demoing the deployed site**, open it once a minute beforehand. Render's free
tier sleeps and the first request takes 30–50 seconds.

**Rehearse once untimed**, then record. Two or three takes and a cut is far
easier than chasing one perfect run.

---

## Running order

### 1 · Sign-in — 20s

Open the app. Click **Show demo accounts**.

> "Six seeded roles. I'll sign in as a resident, and in a second window as a
> society official, so you can see both sides of each action."

Sign in as `resident@greenvalley.example` / `Password123`.

---

### 2 · Resident dashboard — 30s

> "One request builds this — a per-role aggregate endpoint. The server does the
> joining, so these counters can't drift from the lists they summarise."

Point at the flat: **B-304**.

> "That's the resident's own flat, resolved at sign-in. Worth noting because the
> API deliberately has no way to ask 'which flat is mine' without saying so —
> the flat list is society-wide."

---

### 3 · Maintenance — 45s

**Invoices** → point out an **OVERDUE** row.

> "Overdue is computed when the invoice is read, not by a nightly job. So it's
> correct the moment you look at it, even if a scheduled job never ran."

Open **Pay Now**.

> "This opens a real gateway order. It won't complete — that needs live Razorpay
> credentials — and the important thing is what happens instead: the resident is
> told online payment is unavailable, rather than being shown a receipt for a
> payment that never happened. The society office records it manually instead."

*Switch to the official window and record the payment offline if you have time.*

---

### 4 · Raise a complaint — the ML moment — 60s

Back as the resident: **Raise Complaint**.

Leave category and urgency on **"Detect from description"**. Type something
unambiguous but not templated:

> *"Water is leaking from the bathroom ceiling and it's getting worse."*

Submit. Then open **My Complaints**.

> "I didn't choose a category or an urgency. The classifier read the text and
> decided: Plumbing, Urgent. TF-IDF into logistic regression, running as a
> separate service."

**Then say the honest part:**

> "And when it isn't confident, it says so — anything under the threshold is
> thrown away, the keyword classifier answers instead, and the complaint gets
> flagged for a human. Never confidently wrong is the property we test for, not
> never wrong."

---

### 5 · Official triages it — 60s

Switch to the **official** window → **Complaint Triage**.

> "Same complaint, society-wide queue, sorted most urgent first."

Toggle **"Needs triage only"**.

> "This filter came out of user feedback — an official asked to see which ones
> the system had guessed at, because urgency ordering can't surface those."

Open the complaint → **assign to staff** → **Resolve immediately**.

> "One click, but it issues *both* transitions. An official asked us to let staff
> skip the in-progress state when they fix something on the spot. We said no —
> that intermediate state is what makes the audit trail meaningful — and gave
> them this instead. Look at the history: both steps are recorded."

---

### 6 · Book a facility — 30s

Resident window → **Facility Calendar** → book a slot.

> "Two defences against double-booking. A per-slot lock, and a partial unique
> index in the database that makes a second confirmed booking impossible. Tested
> with eight simultaneous threads — exactly one succeeds."

---

### 7 · Guest pass — 45s

**Guest Pass** → fill in a visitor → generate.

> "A real QR, encoding a single-use token. The token comes back only to the
> resident who created it — list views omit it, because a list isn't where a
> secret belongs."

**Copy the token.**

---

### 8 · The gate — the security moment — 60s

Sign in as `guard@greenvalley.example` in the incognito window → **Verify Guest
Pass** → paste the token → **Verify**.

> "Approved — visitor name, flat, time."

**Paste the exact same token again and verify.**

> "Refused. Already used. The pass flips to used inside the same transaction that
> returns the result, so photographing the QR and reusing it doesn't work."

*This is the strongest thing in the demo — show the refusal, don't just claim it.*

---

### 9 · Emergency — 45s

Resident window → **Emergency SOS** → press it.

Switch to the **guard** window → **SOS Inbox**. The alert is there.

Click **Acknowledge**, then switch back to the resident.

> "The resident sees that somebody picked it up. That came from feedback too —
> 'I need to see that someone actually responded, not just that the button
> worked.' The incident row is written before any notification is attempted, so
> the alert survives even if every channel fails."

---

### 10 · The AI assistant — 30s

Resident window → open **Meridian AI** → ask in plain language:

> *"I want to book the clubhouse"*

> "It works out the intent and takes you to the screen that does it. Gemini when
> a key is configured, rule-based matching when not — either way it classifies
> and routes."

---

### 11 · Non-resident owner — 20s

Sign in as `owner@greenvalley.example` → **Property Status**.

> "A whole epic for owners who don't live on site — dues and complaint status for
> their flat, remotely."

---

### 12 · The API contract — 40s

Open `/api/docs`.

> "48 paths, 59 operations, generated from the live route table — so it can't
> describe an endpoint that doesn't exist. CI re-exports it and fails on any
> difference."

Expand one endpoint and show the error responses.

> "44 error codes, each catalogued in the spec, and every failure in the system
> returns the same shape with a request id that ties it to a log line."

---

### 13 · The tests — 30s

Terminal:

```bash
cd backend && pytest -q
cd ml-service && pytest -q
```

> "149 backend, 21 for the ML service. Including a tenant-isolation suite that
> attacks every cross-society path with a foreign token, an eight-thread
> concurrency test, and one that builds the schema from the migrations and from
> the models and compares them — so a model change without a migration fails in
> CI rather than on deploy."

---

## What not to do on camera

- **Don't attempt a real Razorpay checkout.** Say why it can't complete and move on.
- **Don't demo anything unrehearsed.** If a screen misbehaves, cut and re-record.
- **Don't claim the ML is better than it is.** The honest framing in step 4 is
  stronger than an overclaim someone can puncture in questions.
- **Don't leave a stale database.** A fresh seed makes the flows predictable.

## If something breaks mid-take

Keep going and cut it later. The one thing worth restarting for is a wrong
account signed into the wrong window — that makes the cause-and-effect confusing
and is hard to explain around.
