"""Train the payment-risk scorer.

    python -m app.payment_risk.train

docs/04-ml-architecture.md section 4: a boosted tree over five tabular
features. With this few features and this little data a gradient-boosted model
is the correct-sized tool — it trains in seconds and needs no tuning.

No real payment history exists yet, so the training set is simulated from a
generative process where lateness depends on the features in a way the model
has to recover. That is a bootstrap, not evidence: the honest reading of the
ROC-AUC below is "the model learned the process it was shown", and it will be
retrained on real invoice history once enough has accumulated (section 5).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

ARTIFACT_DIR = Path(__file__).resolve().parent
MODEL_PATH = ARTIFACT_DIR / "model.pkl"
METADATA_PATH = ARTIFACT_DIR / "metadata.json"

# Feature order is part of the artifact's contract: `score.py` must build its
# vector the same way round, and a mismatch would silently score nonsense.
FEATURE_ORDER = [
    "past_late_count",
    "avg_days_late",
    "current_dues_amount",
    "tenure_months",
    "month",
]

# The simulation samples the outcome from a probability, so a share of the
# lateness is irreducible noise and no model can rank perfectly. The
# Bayes-optimal AUC for this process is ~0.72 (recomputed into the metadata on
# every run), so the floor sits just below it: the gate is "the model is still
# close to the achievable ceiling", not an arbitrary round number it could
# never reach.
ROC_AUC_FLOOR = 0.65


def simulate(
    n: int = 6000, seed: int = 20260822
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generate a labelled feature table.

    The relationship encoded here is the domain assumption the model is being
    asked to learn: a flat that has paid late before, is carrying dues, and is
    newer to the society is likelier to pay late again, with a mild seasonal
    lift around the festival months.
    """
    rng = np.random.default_rng(seed)

    tenure_months = rng.integers(1, 61, size=n)
    past_late_count = rng.binomial(np.minimum(tenure_months, 24), 0.18)
    avg_days_late = np.where(
        past_late_count > 0, rng.gamma(shape=2.0, scale=3.0, size=n), 0.0
    )
    current_dues_amount = rng.gamma(shape=2.0, scale=2200.0, size=n)
    month = rng.integers(1, 13, size=n)

    late_rate = past_late_count / np.maximum(tenure_months, 1)
    festival_lift = np.isin(month, [10, 11]).astype(float)

    logit = (
        -2.4
        + 4.2 * late_rate
        + 0.09 * avg_days_late
        + 0.00011 * current_dues_amount
        - 0.020 * tenure_months
        + 0.55 * festival_lift
    )
    probability = 1.0 / (1.0 + np.exp(-logit))
    paid_late = rng.binomial(1, probability)

    features = np.column_stack(
        [past_late_count, avg_days_late, current_dues_amount, tenure_months, month]
    ).astype(float)
    # The true probability is returned alongside the sampled outcome so the
    # trainer can report the ceiling any model could reach on this data.
    return features, paid_late, probability


def train() -> dict:
    features, labels, true_probability = simulate()
    x_train, x_test, y_train, y_test, _, p_test = train_test_split(
        features,
        labels,
        true_probability,
        test_size=0.2,
        random_state=42,
        stratify=labels,
    )

    model = GradientBoostingClassifier(
        n_estimators=200, learning_rate=0.05, max_depth=3, random_state=42
    ).fit(x_train, y_train)

    # Ranking quality is the metric that matters: the score prioritises
    # reminders, it never denies anyone anything (section 6).
    roc_auc = roc_auc_score(y_test, model.predict_proba(x_test)[:, 1])
    # Ranking by the generative probability itself is the best any model could
    # do here; reporting it stops the headline number being read as poor when
    # it is in fact near-optimal.
    bayes_roc_auc = roc_auc_score(y_test, p_test)

    metadata = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_size": int(features.shape[0]),
        "test_size": int(x_test.shape[0]),
        "feature_order": FEATURE_ORDER,
        "data_source": "simulated",
        "metrics": {
            "roc_auc": round(float(roc_auc), 4),
            "bayes_optimal_roc_auc": round(float(bayes_roc_auc), 4),
            "share_of_achievable": round(float(roc_auc / bayes_roc_auc), 4),
        },
        "floors": {"roc_auc": ROC_AUC_FLOOR},
        "feature_importances": {
            name: round(float(value), 4)
            for name, value in zip(FEATURE_ORDER, model.feature_importances_)
        },
    }

    joblib.dump({"model": model, "feature_order": FEATURE_ORDER}, MODEL_PATH)
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    metadata = train()
    print(f"dataset: {metadata['dataset_size']} rows ({metadata['test_size']} held out)")
    metrics = metadata["metrics"]
    print(
        f"ROC-AUC: {metrics['roc_auc']:.4f} (floor {ROC_AUC_FLOOR}, "
        f"achievable ceiling {metrics['bayes_optimal_roc_auc']:.4f}, "
        f"{metrics['share_of_achievable']:.0%} of it)"
    )
    print(f"importances: {metadata['feature_importances']}")
    print(f"wrote {MODEL_PATH.name} and {METADATA_PATH.name}")

    if metadata["metrics"]["roc_auc"] < ROC_AUC_FLOOR:
        raise SystemExit("ROC-AUC is below the floor; not publishing")


if __name__ == "__main__":
    main()
