# ML Architecture

Owner: Person D · Parent doc: [00 — Architecture Overview](00-architecture-overview.md)

## 1. Scope

Two models, one FastAPI service, deployed separately from the main backend (Render) so the ML owner can iterate, deploy, and retrain independently of backend release cycles.

1. **Complaint classifier** — free-text complaint description → `{category, urgency, confidence}`
2. **Payment risk scorer** — a flat's payment history features → `{risk_score}`

## 2. Service Structure

```
ml-service/
  app/
    main.py                # FastAPI app, auth middleware (shared-secret header)
    complaints/
      classify.py          # inference endpoint
      train.py             # training script
      model.pkl            # versioned artifact (loaded at startup)
    payment_risk/
      score.py
      train.py
      model.pkl
    common/
      artifact_store.py    # load/save model artifacts to Supabase Storage
  tests/
```

Both models live in **one deployable service** (not two), since one person owns both — this halves the operational surface (one Render service, one set of logs, one health check) compared to deploying them separately, while still keeping the two model domains cleanly separated as sibling modules.

## 3. Complaint Classifier

**Problem framing**: multi-class classification (category: `PLUMBING | ELECTRICAL | STRUCTURAL | SECURITY | CLEANING | GENERAL | ...`) + a second output (urgency: `LOW | MEDIUM | HIGH`).

**V1 approach (start simple, deliberately)**:
- TF-IDF vectorization of the complaint description
- Logistic Regression (or Multinomial Naive Bayes) per output — cheap to train, cheap to serve, interpretable, and realistic to get genuinely working within the project's time budget
- Trained on a labeled dataset bootstrapped from: (a) a small set of hand-labeled realistic example complaints written by the team, (b) synthetic augmentation (paraphrasing templates per category/urgency), and (c) real complaints as they accumulate once the system is in use — the model is retrained periodically (see §5) so real usage data gradually replaces synthetic data
- Urgency uses simple heuristics as a training signal (keywords like "leaking," "sparking," "not working," "urgent," "safety") in addition to the label, to keep the initial labeled set consistent

**V2 stretch goal (Phase 3 polish, only if time allows)**: swap TF-IDF+LogReg for sentence embeddings (e.g. a small sentence-transformer) + a shallow classifier on top — the endpoint contract (`POST /complaints/classify` → `{category, urgency, confidence}`) doesn't change, so this is a drop-in upgrade with zero backend changes required.

**Endpoint**:
```
POST /complaints/classify
{ "description": "Water leaking from ceiling in bathroom, getting worse" }
→ { "category": "PLUMBING", "urgency": "HIGH", "confidence": 0.87 }
```

## 4. Payment Risk Scorer

**Problem framing**: binary/probabilistic classification — will this flat's next invoice be paid late?

**Features** (computed from `MaintenanceInvoice`/`Payment` history, passed in the request body — the ML service is stateless, it doesn't query the DB directly):
- `past_late_count`, `avg_days_late`, `current_dues_amount`, `tenure_months`, `month_of_year` (seasonality — e.g. dues around festival/holiday season)

**Model**: Gradient Boosting (scikit-learn `GradientBoostingClassifier`, or XGBoost if the team wants the extra tooling experience) — tabular data with this few features doesn't need deep learning; a boosted tree model is the correct-sized tool and trains in seconds.

**Endpoint**:
```
POST /payment-risk/score
{ "past_late_count": 3, "avg_days_late": 6.2, "current_dues_amount": 4500, "tenure_months": 14, "month": 11 }
→ { "risk_score": 0.82 }
```

Backend calls this periodically (not on every page load) and caches the result in `PaymentRiskScore`; a threshold crossing triggers an early reminder notification (see [02 — Backend Architecture §5](02-backend-architecture.md#5-maintenance--payments-flow)).

## 5. Training & Retraining Pipeline

- Both models' `train.py` scripts pull labeled data from Postgres (via a read-only DB connection scoped to the ML service) or from a bootstrapped CSV for the initial version before real data exists.
- Retraining runs as a **scheduled job** (Render Cron Job, or a GitHub Actions scheduled workflow that calls a retrain endpoint) — weekly cadence is enough at this scale; there's no need for continuous/online training.
- Trained artifacts (`model.pkl` + a small metadata JSON: training date, dataset size, eval metrics) are uploaded to Supabase Storage, versioned by timestamp. The running service reloads the latest artifact on restart/redeploy — no hot-swapping needed for this scope.

## 6. Evaluation

Tracked per training run, logged to the metadata JSON alongside the artifact (simple enough not to need a full experiment-tracking tool like MLflow at this scale):

| Model | Metric | Target (directional, refine once real data exists) |
|---|---|---|
| Complaint category | Macro F1 | Reasonable given class imbalance across categories |
| Complaint urgency | Macro F1 | Weighted toward not under-calling HIGH urgency (false negatives are worse than false positives here) |
| Payment risk | ROC-AUC | Ranking quality matters more than a hard threshold — the app uses the score to prioritize reminders, not to deny anything |

## 7. Fallback Behavior

The ML service being down or slow **must never block a user-facing action**:

- Complaint submission: if `/complaints/classify` errors, times out (short timeout, ~2s), or returns `confidence` below a threshold, the backend defaults to `category = GENERAL`, `urgency = MEDIUM`, and flags the complaint for manual official triage. The complaint is still created either way.
- Payment risk: if `/payment-risk/score` is unavailable, the backend simply skips the early-reminder step for that cycle — the standard due-date reminder (non-ML) still fires regardless, so nothing is silently missed.

## 8. Internal Auth

The ML service is not public-internet-facing beyond what Render's networking requires; every request from the backend includes a shared-secret header (`X-Internal-Secret`), checked by FastAPI middleware, rejecting anything else with 401 — simple and sufficient for a service with exactly one caller.

## 9. Testing

- **Unit**: pytest on feature engineering functions and pre/post-processing (independent of the trained model itself)
- **Model evaluation**: a held-out test split checked in CI whenever `train.py` changes, failing the build if metrics regress below a floor (prevents an accidental training regression from being silently deployed)
- **Contract**: a lightweight integration test hits both endpoints with fixed inputs and asserts the response shape matches what the backend expects
