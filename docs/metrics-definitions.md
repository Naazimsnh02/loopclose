# Metrics definitions (E8.1)

All metrics derive from `CaseEvent` timestamps. Windows default to the selected period; cohorts are by case creation date unless stated.

| Metric | Numerator / definition | Denominator | Brief §6 |
|---|---|---|---|
| Time to notification | `patient_notified.at − result_issued.at` (median, p90) | cases notified | time to notification |
| Time to acknowledgement | `patient_acknowledged.at − patient_notified.at` | cases acknowledged | patient understanding |
| Time to consult | `consult_done.at − patient_acknowledged.at` | cases consulted | time to consultation |
| Time to confirmatory test | `confirmatory_done.at − result_issued.at` | cases with confirmatory | time to confirmation |
| Confirmatory within SLA | confirmatory_done within programme target (31d FIT) | cases created ≥31d ago | care completion |
| Referral acceptance rate | referrals accepted (first offer) | referrals offered | referral completion |
| Appointment completion | appointments attended | appointments booked | appointment completion |
| No-show rate | `appointment.no_show` events | appointments booked | drop-off |
| Treatment start time | `treatment_or_surveillance.at − confirmatory_done.at` | cases reaching treatment | treatment start |
| Open actionable results by age | open cases bucketed 0–7 / 8–14 / 15–31 / >31 days | — | unresolved results |
| Documented closure rate | `closed` with evidence or decision | terminal cases | documented closure |
| Drop-off reasons | exits + escalations tagged by taxonomy (patient / provider / system / access / communication) | exits | reasons for delay |
| SLA compliance by stage/org | transitions before deadline | transitions | ownership & progression |
| Teach-back pass rate | first-attempt pass | teach-backs asked | understanding |
| Patient confidence (PREM) | 2-question micro-survey mean | responses | reassurance, confidence |
| Grader block rate | blocked outbound messages | outbound attempts | safety |

Exports: CSV (IFHAS-style indicator layout), FHIR `MeasureReport`, JSON API.
