# scripts
- `demo-reset.sh` (E7.8/E14) — reset DB to seed + load demo scenarios DEMO-01..03 + ~300 background cases.
- `push-result.sh` (E11) — POST a sample FIT/BI-RADS DiagnosticReport to the intake endpoint.
- `export-fhir-bundle.sh` (E13) — dump case-related FHIR resources for a given case for reviewers.
- `sample-fit-positive.json` — positive FIT DiagnosticReport (patient `pt-00001`, anaemia flag → priority tier) for `POST /fhir/DiagnosticReport`.
