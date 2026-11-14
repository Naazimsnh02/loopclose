# Assumptions (submission section — keep numbered and current)

1. Actionable results can be delivered as FHIR R4 `DiagnosticReport` (direct push or HIE Subscription) or HL7 v2 ORU^R01 mapped by our adapter. Malaffi/LIS feeds exist or can be established for a pilot; exact Malaffi API surface to be confirmed with DoH/Malaffi.
2. Programme clinical leads own and approve the message-template library, SLA table, urgency rules and evidence types (all are configuration, not code).
3. Patients have a reachable mobile channel and have consented to programme messaging; phone outreach exists for those who have not.
4. Scheduling systems can expose slots or accept booking requests; in the prototype this is stubbed.
5. SLA values in `config/programmes/*.yaml` are placeholders pending validation against the DoH/IFHAS programme standards; the 31-day positive-FIT → colonoscopy target follows the published programme standard.
6. Demographic/language mix of the synthetic population (ar 45% / en 25% / ur 18% / hi 12%) is an assumption for demonstration, not a census figure.
7. Simulation effect sizes for the intervention arm are conservative ranges informed by closed-loop and patient-navigation literature; they are assumptions to be replaced by pilot measurements.
8. Deployment target for a pilot is in-country hosting (e.g. Azure UAE North) with a DoH-approved data processing agreement; the prototype runs on synthetic data only.
