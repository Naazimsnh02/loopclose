# ADR-005 — Closure requires evidence or an authorised human decision

**Status:** Accepted · 2026-10-24

## Decision
`closed` is reachable only via the `close` command, only from programme-configured states, only by a human actor, and only with (a) at least one evidence artefact of an allowed type (e.g. colonoscopy report, care plan, surveillance order) or (b) a documented human decision with a non-empty reason. Side exits (`declined_by_patient`, `lost_to_follow_up`) are human-only; `lost_to_follow_up` additionally requires the outreach protocol to be exhausted (≥3 attempts, ≥2 channels, phone tried).

## Rationale
Brief requirement 5: "A case closes only when the required evidence, or an authorized human decision, is documented." Enforced in code and tests, not policy.
