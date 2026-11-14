# Datasheet: LoopClose synthetic population (DoH RAI Standard §3.2.5)

| Field | Value |
|---|---|
| Name | LoopClose synthetic screening population |
| Version / seed | v0, `numpy` seed 42 (re-generate with `loopclose-analytics synthetic`) |
| Generator | `analytics/loopclose_analytics/synthetic/generate.py`, written for this project. No third-party dataset and no Synthea dependency in v0 |
| Owner | Syed Naazim Hussain (LoopClose) |
| Outputs | `analytics/output/patients.ndjson` (1,199 patients), `analytics/output/results.ndjson` (1,567 screening results) |
| Licence of the data | Owned by the author; may be shared with the challenge organisers and judges for evaluation |
| Personal data | **None.** Every record is generated. Names are `Patient00000…` / `Synthetic`; phone numbers are random strings in a UAE format and are not assigned to real people |
| Sensitivity | Non-sensitive (synthetic). Treated as if it were PHI in the application (RBAC, audit) so the controls are exercised |

## Purpose (one declared task per dataset, §3.2.1.3)
1. Exercise the case engine, worklists and dashboards end to end (`seed:synthetic` loads the actionable results as cases).
2. Train the **demonstration** drop-off risk model, so the pipeline, features and explanations can be shown. It has no predictive validity (see Limitations 2).
3. Feed the baseline-vs-LoopClose impact simulation (`analytics/loopclose_analytics/simulation/`).

## Composition
| Attribute | How generated | Role in the risk model |
|---|---|---|
| Age 40–75 | uniform | feature (age band) |
| Sex | ~50/50 | not used as a feature |
| Preferred language | ar 45 % / en 25 % / ur 18 % / hi 12 %: an **assumption** for demonstration, not census data (Assumptions 6) | feature (language mismatch) |
| Nationality | sampled per language (e.g. ur → PK) | not used |
| Distance to clinic | log-normal, 1–120 km | feature |
| Transport barrier, prior no-shows | Bernoulli / Poisson | features |
| FIT result | positivity 6 % (literature range 5–7 %) | n/a |
| Mammogram BI-RADS 4/5 | 2.5 % of screens | n/a |
| Codes | LOINC 29771-3 (FIT), 72137-3 (BI-RADS) | n/a |

## Known gaps and bias considerations
- The distributions are plausible, not measured. They are not representative of any real Abu Dhabi population, and subgroup performance cannot be inferred from them.
- Locale and nationality are linked by construction, so language effects and nationality effects cannot be separated.
- No missing-data or data-quality noise is simulated beyond what the generator injects deliberately. Real feeds will be messier.
- Any pilot must retrain and recalibrate on governed pilot data, with clinical sign-off and a representativeness audit (§3.1.5), before the risk tier influences outreach. A rules fallback applies for the first 30 days.

## Provenance of simulation parameters
Published aggregate figures only. Each one is cited inline in `analytics/loopclose_analytics/simulation/parameters.yaml`: Abu Dhabi AHS 2015–16 CRC cohort (PMC8343888, open access), Casalino et al. 2009 via Joint Commission, AHRQ closed-loop learning lab. No individual-level external data is used.
