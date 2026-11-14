"""Command-line entry points. Each subcommand writes to analytics/output/ (git-ignored)."""

from pathlib import Path

import typer

from loopclose_analytics.risk_model.train import train_and_export
from loopclose_analytics.simulation.model import run_simulation
from loopclose_analytics.synthetic.generate import generate_population

app = typer.Typer(help="LoopClose analytics")
OUTPUT = Path(__file__).resolve().parents[1] / "output"


@app.command()
def synthetic(n: int = 5000, seed: int = 42) -> None:
    """Generate a synthetic population with FIT and mammogram results (E10.1–10.2)."""
    OUTPUT.mkdir(exist_ok=True)
    stats = generate_population(n=n, seed=seed, out_dir=OUTPUT)
    typer.echo(stats)


@app.command()
def simulate(replications: int = 1000, seed: int = 42) -> None:
    """Run baseline vs LoopClose discrete-event simulation (E10.4)."""
    OUTPUT.mkdir(exist_ok=True)
    summary = run_simulation(replications=replications, seed=seed, out_path=OUTPUT / "impact.json")
    typer.echo(summary)


@app.command()
def train_risk(seed: int = 42) -> None:
    """Train the drop-off risk model on synthetic cases and export JSON coefficients (E6.3)."""
    OUTPUT.mkdir(exist_ok=True)
    report = train_and_export(seed=seed, out_path=OUTPUT / "risk_model.json")
    typer.echo(report)


if __name__ == "__main__":
    app()
