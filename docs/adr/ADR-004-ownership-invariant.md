# ADR-004 — Ownership invariant and two-phase hand-off

**Status:** Accepted · 2026-10-24

## Decision
A non-terminal case always has exactly one owner whose role matches the state's `ownerRole` (programme config). Transitions that change owner role must name the new owner; otherwise the engine rejects with `OWNER_REQUIRED`. Cross-organisation hand-offs are *offer → accept* with a timeout that escalates to the programme coordinator (never to AI). Declines carry reason codes and trigger redirect.

## Rationale
The brief's core pain is "who owns the next step is unclear, especially between organisations". Making ownerless states unrepresentable is stronger than a dashboard that shows them.
