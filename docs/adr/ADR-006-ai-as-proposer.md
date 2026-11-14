# ADR-006 — AI proposes; humans decide (bounded AI services)

**Status:** Accepted · 2026-10-24

## Decision
Three AI features, each bounded by *tool design and the state machine*, not by prompt wording alone:
1. **Navigator** — sends approved templates (optionally rephrased, safety-graded), asks/grades one teach-back per stage, proposes bookings, escalates. May transition only to `patient_acknowledged` where programme policy allows.
2. **Summariser** — drafts a `Composition` from structured data with claim→source references; clinician approves.
3. **Drop-off risk** — interpretable model (JSON coefficients) with top-3 reasons; suggests actions; never escalates by itself beyond creating a proposal/escalation item for a human.

A **SafetyGrader** runs on every outbound patient message (rules first, LLM second; fails closed). Every AI call is audited (prompt hash, model, tokens, outcome). Each feature has a kill-switch. Patient free text is always wrapped as data.

## Rationale
DoH Responsible AI Standard expectations; LLM patient-communication evidence (review-required rates up to 80% in some settings) argues for template-bound generation; the brief demands human-governed escalation and closure.
