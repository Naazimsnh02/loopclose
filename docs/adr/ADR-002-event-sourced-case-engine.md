# ADR-002 — Event-sourced case engine with a pure state machine

**Status:** Accepted · 2026-10-24

## Decision
`packages/shared` holds a pure function `applyCommand(snapshot, command, programme, now)` that returns a new snapshot plus domain events or a typed `MachineError`. The API persists the events (append-only `CaseEvent`) and the projected `Case` row in one transaction with optimistic concurrency (`version`). Projections (Case row, FHIR) are rebuildable from events.

## Rationale
- Invariants (ownership, closure evidence, AI boundaries) live in one tested place and cannot be bypassed by a controller.
- The event log *is* the audit trail and the metrics source — no ETL.
- Pure function = fast unit tests (37 at scaffold time) and reuse in web (preview transitions) and analytics.

## Consequences
− Developers must think in commands/events; the repository enforces the pattern.
