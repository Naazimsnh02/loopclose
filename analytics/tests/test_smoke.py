from pathlib import Path

from loopclose_analytics.risk_model.train import FEATURES, train_and_export
from loopclose_analytics.simulation.model import run_simulation
from loopclose_analytics.synthetic.generate import generate_population


def test_synthetic_population(tmp_path: Path) -> None:
    stats = generate_population(n=500, seed=1, out_dir=tmp_path)
    assert stats["patients"] == 500
    assert stats["actionable"] > 0
    assert (tmp_path / "patients.ndjson").exists()


def test_simulation_shows_improvement(tmp_path: Path) -> None:
    s = run_simulation(replications=50, seed=1, out_path=tmp_path / "impact.json")
    assert s["loopclose_completion"] > s["baseline_completion"]
    assert 0.2 < s["baseline_completion"] < 0.8


def test_risk_model_export_matches_api_features(tmp_path: Path) -> None:
    r = train_and_export(seed=1, out_path=tmp_path / "risk_model.json", n=4000)
    assert r["auc"] > 0.6
    import json

    export = json.loads((tmp_path / "risk_model.json").read_text(encoding="utf-8"))
    assert export["features"] == FEATURES
    assert "synthetic" in export["limitation"].lower()
