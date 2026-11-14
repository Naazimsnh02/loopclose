# AI evaluation harness (E9)

Planned layout:

```
evals/
  golden/            60 scenarios × 4 locales (YAML): case context, patient message, expected behaviour
  redteam/           prompt injection, diagnosis requests, wrong-patient, close/cancel attempts, abuse, emergencies
  rubric.yaml        accuracy vs template · urgency preserved · no diagnosis · tone · locale · reading level
  run.py             calls the API navigator/summariser endpoints against a seeded DB; LLM-judge + rule checks
  report.py          → docs/responsible-ai/eval-report.md (tables: pass rates, failure modes, guardrail catches)
```

Human review: clinician + 2 native speakers per locale score a stratified sample; their scores are the
reference, the LLM judge is for regression only. Results are reported honestly, including failures.
