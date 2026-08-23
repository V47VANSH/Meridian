"""Train the complaint classifier.

    python -m app.complaints.train

docs/04-ml-architecture.md section 3: TF-IDF vectorisation with a linear model
per output — cheap to train, cheap to serve, and interpretable. Two separate
classifiers rather than one multi-output model, because category and urgency
answer different questions from the same text and are evaluated separately.

Writes `model.pkl` next to this module plus a `metadata.json` carrying the
training date, dataset size and held-out metrics, which is what section 6 asks
for instead of a full experiment-tracking tool.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from app.complaints.dataset import build_dataset

ARTIFACT_DIR = Path(__file__).resolve().parent
MODEL_PATH = ARTIFACT_DIR / "model.pkl"
METADATA_PATH = ARTIFACT_DIR / "metadata.json"

# Minimum macro-F1 for a run to be considered publishable. CI re-trains when
# this module changes and fails below the floor, so an accidental regression
# cannot be deployed silently (section 9).
CATEGORY_F1_FLOOR = 0.85
URGENCY_F1_FLOOR = 0.60


def _build_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    # Word bigrams carry the phrases that decide a label —
                    # "not urgent" and "no water" both invert what the
                    # individual words suggest.
                    ngram_range=(1, 2),
                    min_df=2,
                    sublinear_tf=True,
                    strip_accents="unicode",
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=2000,
                    # Urgency is heavily skewed toward the baseline label; this
                    # stops the model from ignoring the minority classes.
                    class_weight="balanced",
                ),
            ),
        ]
    )


def train() -> dict:
    texts, categories, urgencies = build_dataset()

    # One split shared by both models, stratified on category so every class is
    # represented on both sides.
    (
        train_texts,
        test_texts,
        train_categories,
        test_categories,
        train_urgencies,
        test_urgencies,
    ) = train_test_split(
        texts, categories, urgencies, test_size=0.2, random_state=42, stratify=categories
    )

    category_model = _build_pipeline().fit(train_texts, train_categories)
    urgency_model = _build_pipeline().fit(train_texts, train_urgencies)

    category_f1 = f1_score(
        test_categories, category_model.predict(test_texts), average="macro"
    )
    urgency_f1 = f1_score(test_urgencies, urgency_model.predict(test_texts), average="macro")

    metadata = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_size": len(texts),
        "test_size": len(test_texts),
        "metrics": {
            "category_macro_f1": round(category_f1, 4),
            "urgency_macro_f1": round(urgency_f1, 4),
        },
        "floors": {
            "category_macro_f1": CATEGORY_F1_FLOOR,
            "urgency_macro_f1": URGENCY_F1_FLOOR,
        },
        "sklearn_report": {
            "category": classification_report(
                test_categories, category_model.predict(test_texts), output_dict=True, zero_division=0
            ),
            "urgency": classification_report(
                test_urgencies, urgency_model.predict(test_texts), output_dict=True, zero_division=0
            ),
        },
    }

    joblib.dump({"category": category_model, "urgency": urgency_model}, MODEL_PATH)
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    metadata = train()
    metrics = metadata["metrics"]
    print(f"dataset: {metadata['dataset_size']} examples ({metadata['test_size']} held out)")
    print(f"category macro-F1: {metrics['category_macro_f1']:.4f} (floor {CATEGORY_F1_FLOOR})")
    print(f"urgency  macro-F1: {metrics['urgency_macro_f1']:.4f} (floor {URGENCY_F1_FLOOR})")
    print(f"wrote {MODEL_PATH.name} and {METADATA_PATH.name}")

    if metrics["category_macro_f1"] < CATEGORY_F1_FLOOR:
        raise SystemExit("category macro-F1 is below the floor; not publishing")
    if metrics["urgency_macro_f1"] < URGENCY_F1_FLOOR:
        raise SystemExit("urgency macro-F1 is below the floor; not publishing")


if __name__ == "__main__":
    main()
