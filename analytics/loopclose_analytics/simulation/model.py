"""
E10.4 — Monte-Carlo cohort simulation of the positive-FIT pathway: baseline vs LoopClose.

v0 is a stage-probability cohort model (fast, transparent). A SimPy queueing version with capacity
constraints (endoscopy slots) is the planned extension; keep the same output schema.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import yaml

PARAMS_PATH = Path(__file__).with_name("parameters.yaml")


def _tri(rng: np.random.Generator, spec: list[float] | float) -> float:
    if isinstance(spec, list):
        low, mode, high = spec
        return float(rng.triangular(low, mode, high))
    return float(spec)


def _run_arm(rng: np.random.Generator, n_positive: int, p: dict, sla_days: int) -> dict:
    notified = rng.random(n_positive) >= _tri(rng, p["notify_failure_rate"])
    acked = notified & (rng.random(n_positive) < _tri(rng, p["ack_rate_given_notified"]))
    booked = acked & (rng.random(n_positive) >= _tri(rng, p["referral_to_appointment_loss"]))
    attended = booked & (rng.random(n_positive) >= _tri(rng, p["no_show_rate"]))
    median_days = _tri(rng, p["median_days_result_to_colonoscopy"])
    days = rng.lognormal(mean=np.log(median_days), sigma=0.45, size=n_positive)
    within_sla = attended & (days <= sla_days)
    return {
        "notified": float(notified.mean()),
        "acknowledged": float(acked.mean()),
        "appointment_booked": float(booked.mean()),
        "colonoscopy_completed": float(attended.mean()),
        "completed_within_sla": float(within_sla.mean()),
        "median_days_to_colonoscopy": float(np.median(days[attended])) if attended.any() else None,
        "unresolved_actionable_results": int((~attended).sum()),
    }


def run_simulation(replications: int, seed: int, out_path: Path) -> dict:
    params = yaml.safe_load(PARAMS_PATH.read_text(encoding="utf-8"))
    rng = np.random.default_rng(seed)
    n_positive = int(params["population"]["eligible_adults"] * params["population"]["fit_positivity"])
    sla_days = int(params["sla"]["colonoscopy_within_days"])

    arms = {"baseline": [], "loopclose": []}
    for _ in range(replications):
        arms["baseline"].append(_run_arm(rng, n_positive, params["baseline"], sla_days))
        arms["loopclose"].append(_run_arm(rng, n_positive, params["intervention"], sla_days))

    def summarise(rows: list[dict]) -> dict:
        out = {}
        for k in rows[0]:
            vals = np.array([r[k] for r in rows if r[k] is not None], dtype=float)
            out[k] = {"median": float(np.median(vals)), "p05": float(np.percentile(vals, 5)), "p95": float(np.percentile(vals, 95))}
        return out

    summary = {
        "n_positive_fit": n_positive,
        "replications": replications,
        "seed": seed,
        "arms": {k: summarise(v) for k, v in arms.items()},
        "note": "Synthetic cohort simulation under cited/assumed parameters. Not clinical evidence. See parameters.yaml.",
    }
    out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    b, l = summary["arms"]["baseline"], summary["arms"]["loopclose"]
    return {
        "n_positive_fit": n_positive,
        "baseline_completion": round(b["colonoscopy_completed"]["median"], 3),
        "loopclose_completion": round(l["colonoscopy_completed"]["median"], 3),
        "baseline_within_sla": round(b["completed_within_sla"]["median"], 3),
        "loopclose_within_sla": round(l["completed_within_sla"]["median"], 3),
        "out": str(out_path),
    }
