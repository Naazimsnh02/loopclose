# Integration & deployment guide (E11, E13.6) — skeleton

## Inbound results
- **FHIR R4** `POST /fhir/DiagnosticReport` (direct) or HAPI `Subscription` rest-hook → same handler. Idempotent on `identifier`.
- **HL7 v2** `ORU^R01` → DiagnosticReport mapper (`POST /hl7v2/oru`) — E11.2. Mapping table: OBR-4 → code, OBX-5 → value/interpretation, PID-3 → patient identifier, ORC-12/OBR-16 → performer.
- Programme classification: LOINC 29771-3 (FIT), 72137-3 (BI-RADS); flags via extension `…/flag`.

## Adapter interfaces (E11.3)
`ResultSource` · `PatientDemographicsSource` · `SchedulingSink` · `DocumentSink` · `NotificationSink` — stub implementations in the prototype; Malaffi/EMR implementations are mapping work.

## Malaffi notes
Public sources conflict on Malaffi's API surface (FHIR R4 vs HL7 v2/XML). Design assumes either; confirm with DoH/Malaffi before pilot. Results and closure documents are written back as `DiagnosticReport`/`DocumentReference` where permitted.

## Deployment
- Local: `docker compose up` (Postgres, HAPI, MailHog) + `pnpm dev`. Full: `docker compose --profile full up`.
- Hosted demo: Azure Container Apps (UAE North) or equivalent; managed Postgres; TLS; secrets in Key Vault.
- Scaling: stateless API replicas; pg-boss workers scale with replicas; HAPI behind its own Postgres; read replicas for metrics.
- Load targets (E15.4): p95 < 300 ms worklist @ 10k cases, 200 concurrent coordinators.
