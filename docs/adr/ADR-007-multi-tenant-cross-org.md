# ADR-007 — Organisations are first-class; cases span them

**Status:** Accepted · 2026-10-24

## Decision
`Organization` (programme authority, lab, primary care, specialist, hospital) is a first-class entity. Cases carry an owning org per state; referrals have initiator and recipient orgs. Visibility: programme-level roles see the whole loop; provider roles see cases their org owns or is party to. Consent scopes filter what travels in the continuity packet.

## Rationale
The pain is *between* organisations. Single-EHR closed-loop tools stop at the organisational boundary; an HIE-connected emirate can do better, and the data model must reflect it.
