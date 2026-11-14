# ADR-001 — FHIR-native persistence with a relational projection

**Status:** Accepted · 2026-10-24

## Context
The brief requires cross-provider tracking and HIE/EMR integration. Judges weight "technical depth and architecture" and "scalability and deployment readiness". Malaffi and regional systems exchange FHIR R4 / HL7 v2.

## Decision
Every case artefact has a canonical FHIR R4 representation (`DiagnosticReport`, `Task`, `ServiceRequest`, `Communication`, `Appointment`, `Consent`, `Procedure`, `CarePlan`, `Composition`, `Provenance`, `AuditEvent`, `MeasureReport`) stored in HAPI FHIR. The API keeps a relational projection (Postgres/Prisma) for worklists, SLAs and metrics. The relational event log is the write-side source of truth; FHIR resources are projected asynchronously through an outbox.

## Consequences
+ Judges and integrators can query the FHIR server directly; integration is a mapping exercise, not a rewrite.
+ Worklist performance and transactional invariants stay in Postgres.
− Two stores to keep consistent → outbox pattern and rebuildable projections are mandatory (ADR-002).
