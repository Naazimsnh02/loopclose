# analytics

Python side of LoopClose. Nothing here runs in the request path; outputs are files the API or docs consume.

| Package | Epic | Produces |
|---|---|---|
| `synthetic/` | E10.1–10.3 | UAE-flavoured Synthea post-processing, FIT/mammogram result generators → `output/*.ndjson` for the API seeder |
| `simulation/` | E10.4 | SimPy discrete-event model, baseline vs LoopClose arms → `output/impact.json` + `docs/impact-brief.md` tables |
| `risk_model/` | E6.3, E9.5 | Logistic regression on synthetic cases → `output/risk_model.json` (scored in TypeScript by the API) |
| `evals/` | E9 | Golden set + red-team runner → `docs/responsible-ai/eval-report.md` |

```bash
cd analytics
python -m venv .venv && . .venv/Scripts/activate   # Windows; use bin/activate elsewhere
pip install -e ".[dev]"
pytest -q
lc-analytics --help
```

All data is synthetic. Parameters that stand in for real-world rates carry a citation in `simulation/parameters.yaml`.
