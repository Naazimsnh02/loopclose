# ADR-003 — Durable SLA timers on Postgres (pg-boss), Temporal as scale-up path

**Status:** Accepted · 2026-10-24

## Context
SLA enforcement needs timers that survive restarts, with warn (70%) and breach (100%) points per state entry, cancelled or superseded when the case moves on.

## Decision
Use pg-boss (Postgres-backed job queue) for all timers and background jobs. Jobs are keyed `caseId:version`; workers re-check the case version/state before acting so superseded timers are no-ops. Temporal.io is documented as the migration path for multi-day human-in-the-loop workflows at larger scale.

## Rationale
One infrastructure dependency (Postgres) for a 4-week build; durability is what matters, not orchestration features.

## Consequences
+ `docker compose up` needs no extra service.
− No true cancel-by-key → version check pattern is required in every worker.
