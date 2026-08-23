# Submission Checklist

There are **two separate things to submit**, and they are easy to confuse
because both involve a ZIP. They contain completely different material.

| | What it is | Contains |
|---|---|---|
| **A** | Combined ZIP, automatically validated | **Three text files only** |
| **B** | Final (Milestone 5) submission | Video, slides, code, README, report PDF |

Do **A** first — it is machine-checked and will tell you within minutes whether
it passed.

---

# A. Combined ZIP (`team-098-milestone-3-5.zip`)

> **This is not the code ZIP.** An automated validator rejects the submission if
> it finds *any* extra file, draft, PDF or sub-folder. Three files, nothing else.

**Already built:** `submission/team-098-milestone-3-5.zip`

Verified structure:

```
team-098-milestone-3-5/          <- the parent folder must be inside the ZIP
├── api-doc.yaml                 141 KB  (48 paths, 59 operations, 62 schemas)
├── user-identification.txt        7 KB
└── user-stories.txt               9 KB
```

The filenames are exact — all lowercase, dashes not spaces, those extensions.
The folder itself was zipped, not the three files selected individually; zipping
the files directly fails the structural check.

## Steps

1. **Validity Form** — <https://forms.gle/BhG62m6fHiTehnTFA>
   Enter your email and team number, upload
   `submission/team-098-milestone-3-5.zip`, submit.
2. **Wait for the automated email.** It arrives within a few minutes.
   - **PASS** → continue to step 3.
   - **FAIL** → the email says exactly what is wrong. Fix, rebuild (see below),
     resubmit the form. There is no penalty for resubmitting.
3. **Only after a PASS**, upload the same ZIP to the Submission Drive.

Guide, if you want to re-read the rules:
<https://docs.google.com/document/d/1dSqbxOvU26ob__yfqq-cVIsa9J3N7FyOHcV8necJnGk>

## Rebuilding it

`api-doc.yaml` and `user-stories.txt` are generated from the live API, so they
cannot drift from what the code actually serves:

```bash
cd backend && python scripts/export_openapi.py   # refresh the spec first
cd .. && python submission/build.py              # regenerate all three + the ZIP
```

---

# B. Final submission (Milestone 5)

| Deliverable | Status | Where |
|---|---|---|
| Final PDF report | **Ready** | `docs/11-final-report.pdf` (31 pages) |
| Presentation slides | **Ready** | `docs/13-presentation.pdf` (18 slides, speaker notes included) |
| README with run instructions | **Ready** | `README.md` — verified from a clean clone |
| Complete code ZIP | **Build it** — see below | |
| Recorded video demo | **You record** | Script: `docs/14-demo-script.md` |
| Issue-tracking evidence | **You capture** | See below |

## B1. Before anything else — merge to `main`

Seven commits are on `docs/final-submission-alignment` and not yet on `main`.
Everything below assumes they are merged.

Open the PR, get a teammate to review and approve it — **that review thread is
itself a graded artifact** — then merge.

## B2. Two edits only you can make

1. **`docs/11-final-report.md`** — the team table has two *«name»* placeholders.
   Git only records roll numbers for those accounts, and named ownership is what
   the teamwork criterion looks for. Replace them, then rebuild the PDF:

   ```bash
   cd docs/tools && npm install && node build-pdf.mjs ../11-final-report.md
   ```

*(Part E8's Jira screenshots are now in — see below.)*

## B3. Screenshots

**Jira — done.** Five screenshots are in `docs/screenshots/` and written up in
report Part E8: the project summary dashboard and the epic timeline for four of
the five epics. Between them they evidence what the criterion asks for — work
planned in advance across six sprints, a dated activity feed showing the board
was maintained as work happened rather than filled in at the end, assignees
spanning four team members, and child items closed out per epic.

**GitHub — done.** The pull request list is in Part E8 too: three merged, none
open, PR #2 explicitly approved, and authors spanning two team members.

Optional additions if you want to strengthen it further: a burndown or velocity
chart from Jira's Reports tab, one or two issue detail pages with the
Activity/History tab open, and the Actions tab showing green runs.

**GitHub:**

- The pull requests with their review threads
- The branch list (9 branches — evidence of branch-per-feature)
- The Actions tab showing green runs
- Insights / Contributors

The report already contains a **SCRUM-xx → commit → author → date** traceability
table built from the 13 real commits that carry a Jira id, so the screenshots
corroborate something already written rather than standing alone.

## B4. Record the demo

Follow `docs/14-demo-script.md`. Roughly 8 minutes. Pre-flight matters — the
script lists it.

Two moments carry the whole thing: the classifier filling in a category nobody
chose, and the **same guest-pass token being refused on its second use**. Show
both rather than describing them.

If you demo the deployed site, open it a minute beforehand. Render's free tier
sleeps and the first request takes 30–50 seconds.

## B5. Build the code ZIP

**From a fresh clone of `main`, never from your working directory.** Building
from a working tree is how `node_modules`, `.venv` and a local database end up
inside a submission.

```bash
cd /tmp
git clone --depth 1 https://github.com/V47VANSH/MAY2026-Team-098.git meridian-submission
cd meridian-submission && rm -rf .git
cd .. && zip -r team-098-final-code.zip meridian-submission
```

Then **unzip it somewhere else and follow the README once**. If it does not run
from the archive, the run-instructions marks are lost and the evaluator cannot
open the project at all.

Expected contents: `backend/`, `frontend/`, `ml-service/`, `docs/`,
`.github/workflows/`, `README.md`, `DEPLOYMENT.md`, `CLAUDE.md`, diagrams.
Expected absences: `node_modules`, `.venv`, `*.db`, `__pycache__`, `.env`.

---

# Final check

Run through this against the rubric, one line at a time:

- [ ] Combined ZIP submitted **and** the validator emailed a PASS
- [ ] PASS-ed ZIP uploaded to the Submission Drive
- [ ] `main` contains all the work; the repo landing page shows `backend/`,
      `frontend/`, `ml-service/`
- [ ] Report PDF regenerated after replacing the two name placeholders
- [x] Jira screenshots inserted into report Part E8
- [ ] Slides exported
- [ ] Video recorded, uploaded, and **the share link tested in a private window**
- [ ] Code ZIP built from a fresh clone and test-run from the archive
- [ ] All CI workflows green

Do not leave the submission itself to the last fifteen minutes.
