"""
E6.3 / E9.5 — Drop-off risk model. Logistic regression (interpretable) exported as JSON for TypeScript scoring.

Training data is SYNTHETIC: a generative story where known barriers raise drop-off odds. This demonstrates
the pipeline (features → calibrated model → explainable scores → retraining plan); it has no predictive
validity for real patients and the export says so in `limitation`.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

FEATURES = [
    "hours_since_notification_no_ack",
    "channel_failures",
    "prior_no_shows",
    "transport_barrier",
    "language_mismatch",
    "age_band_70plus",
    "referral_pending_days",
    "weekend_entry",
]

# Must match apps/api/src/modules/ai/risk/risk.service.ts feature names.


def _synthesise(rng: np.random.Generator, n: int) -> tuple[np.ndarray, np.ndarray]:
    X = np.column_stack(
        [
            rng.exponential(30, n),  # hours since notification without ack
            rng.poisson(0.3, n),  # channel failures
            rng.poisson(0.4, n),  # prior no-shows
            rng.random(n) < 0.12,  # transport barrier
            rng.random(n) < 0.30,  # language mismatch
            rng.random(n) < 0.15,  # age 70+
            rng.exponential(1.5, n),  # referral pending days
            rng.random(n) < 0.28,  # weekend entry
        ]
    ).astype(float)
    logit = (
        -2.2
        + 0.015 * X[:, 0]
        + 0.6 * X[:, 1]
        + 0.8 * X[:, 2]
        + 0.9 * X[:, 3]
        + 0.5 * X[:, 4]
        + 0.3 * X[:, 5]
        + 0.25 * X[:, 6]
        + 0.1 * X[:, 7]
    )
    y = rng.random(n) < 1 / (1 + np.exp(-logit))
    return X, y.astype(int)


def train_and_export(seed: int, out_path: Path, n: int = 20000) -> dict:
    rng = np.random.default_rng(seed)
    X, y = _synthesise(rng, n)
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, random_state=seed, stratify=y)
    scaler = StandardScaler().fit(X_tr)
    model = LogisticRegression(max_iter=1000).fit(scaler.transform(X_tr), y_tr)
    p = model.predict_proba(scaler.transform(X_te))[:, 1]
    auc, brier = float(roc_auc_score(y_te, p)), float(brier_score_loss(y_te, p))

    export = {
        "version": f"risk-lr-{datetime.now(UTC).strftime('%Y%m%d')}-synthetic",
        "trainedOn": "synthetic",
        "trainedAt": datetime.now(UTC).isoformat(),
        "features": FEATURES,
        "intercept": float(model.intercept_[0]),
        "coefficients": {f: float(c) for f, c in zip(FEATURES, model.coef_[0])},
        "scaler": {f: {"mean": float(m), "scale": float(s)} for f, m, s in zip(FEATURES, scaler.mean_, scaler.scale_)},
        "thresholds": {"amber": 0.35, "red": 0.60},
        "holdout": {"auc": auc, "brier": brier, "n": len(y_te), "prevalence": float(y_te.mean())},
        "limitation": (
            "Trained on synthetic data generated from an assumed barrier model. Demonstrates the pipeline and "
            "explainability only; no predictive validity for real patients. Rules fallback governs the first "
            "30 days of any pilot; retrain on pilot outcomes with clinical sign-off before model-driven escalation."
        ),
    }
    out_path.write_text(json.dumps(export, indent=2), encoding="utf-8")
    return {"auc": round(auc, 3), "brier": round(brier, 3), "out": str(out_path)}
