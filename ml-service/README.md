# ML Service

Complaint classification and payment-risk scoring for the Apartment Complex
Management System. One deployable carrying both models
(see [docs/04-ml-architecture.md](../docs/04-ml-architecture.md)).

The backend is the only caller, and it never depends on this service being up:
every endpoint has a deterministic fallback in `backend/app/services/ml_client.py`.

## Running

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate        # Windows;  source .venv/bin/activate elsewhere
pip install -r requirements.txt

python -m app.complaints.train      # writes complaints/model.pkl + metadata.json
python -m app.payment_risk.train    # writes payment_risk/model.pkl + metadata.json

uvicorn app.main:app --port 8100
```

Point the backend at it with `ML_SERVICE_URL=http://localhost:8100`. Set
`ML_SHARED_SECRET` to the same value on both sides to require the
`X-Internal-Secret` header; leave it unset and the endpoints are open, which is
what makes local runs and tests work without ceremony.

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness, plus whether each artifact is loadable |
| `POST /complaints/classify` | `{description}` → `{category, urgency, confidence}` |
| `POST /payment-risk/score` | five features → `{risk_score}` |

## Models

**Complaint classifier** — TF-IDF (word unigrams and bigrams) into logistic
regression, one model per output. Bigrams matter: "not urgent" and "no water"
both invert what their individual words suggest.

**Payment risk** — gradient-boosted trees over the five features in doc 04 §4.

## What the metrics do and do not say

`metadata.json` next to each artifact records the training date, dataset size
and held-out metrics.

Read them carefully. Neither model has seen real data yet:

- The classifier's macro-F1 is ~1.0, but its training and test data are both
  generated from the same phrase templates, so that number largely measures
  the templates. The honest signal is `test_classifier_is_never_confidently_wrong_on_unseen_phrasing`,
  which uses phrasings written nowhere in the training set. The model gets most
  of them right and, where it does not, returns confidence below the backend's
  threshold — so the backend discards the answer and flags the complaint for
  manual triage. That is the property worth guaranteeing: never confidently
  wrong, rather than never wrong.
- The risk model's ROC-AUC is ~0.67 against a Bayes-optimal ~0.68 for its own
  simulated process, i.e. ~98% of what is achievable. Outcomes are sampled from
  a probability, so most of the remaining gap is irreducible noise, not a
  modelling failure. Both numbers are recorded so the headline is not read out
  of context.

Both are bootstraps. Retraining on real complaint text and real invoice history
is what turns them into evidence.

## Tests

```bash
pytest
```

Contract tests (the shape the backend depends on), unit tests on the
pre/post-processing, and evaluation tests that fail if a published artifact
drops below the floor its trainer sets.
