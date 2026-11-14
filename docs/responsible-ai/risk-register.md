# AI & platform risk register (DoH RAI Standard §3.3)

Ratings: likelihood (L) × impact (I), each 1–3, giving a score of 1–9. Residual risk is the score after the listed controls. Status: ✅ implemented in the prototype · 🔧 planned before pilot · 📄 process/documentation. Owner for all rows in the prototype: Syed Naazim Hussain (product owner). At pilot, ownership moves to the roles in `doh-rai-mapping.md` §4.

Proposed AI risk tiers (§3.3.1.2.2), to be confirmed with DDGO at pilot: navigator **Medium**, drop-off risk **Medium**, summariser **Low–Medium**, safety grader **Low**. No feature is High or Very High: none diagnoses, triages clinically or closes care.

| # | Category | Risk | L×I | Controls | Status | Residual |
|---|---|---|---|---|---|---|
| R1 | Human oversight | AI advances, closes or reassigns a case without a human | 2×3=6 | State-machine guard: AI may only enter `aiPolicy.mayEnterStates`; it can never assign an owner, close, exit or escalate. AI output is stored as an `AIProposal` that a human decides on. Unit-tested | ✅ | 1×3=3 |
| R2 | Patient safety | A patient message gives a diagnosis, a probability or false reassurance ("probably nothing") | 2×3=6 | Messages are bound to clinician-approved templates; rules-first safety grader on every outbound message, failing closed; distress keywords route to a clinician callback | ✅ grader · 🔧 template sign-off | 1×3=3 |
| R3 | Failure mode | A case silently stalls (no owner, missed hand-off, lost referral) | 3×3=9 | Ownership invariant; offer→accept hand-offs; durable SLA timers that warn at 70 % and escalate to a named human role on breach; stalled/overdue/unassigned worklist tabs | ✅ | 1×3=3 |
| R4 | Failure mode | Duplicate or missed intake of a result | 2×2=4 | Idempotent intake on the result identifier; outbox with retries; FHIR projection with referential integrity | ✅ | 1×2=2 |
| R5 | Failure mode | LLM provider unavailable or degraded | 2×2=4 | Single adapter with graceful degradation to template-only and rules-only modes; per-feature kill switch | ✅ | 1×1=1 |
| R6 | Bias / equity | Lower-quality Arabic, Urdu or Hindi messages; risk model under-prioritises some groups | 2×3=6 | Native-speaker review of the template set; eval pass rates reported per language; risk features exclude nationality and sex; rules fallback for the first 30 days of a pilot | 🔧 E9.6 | 2×2=4 |
| R7 | Explainability | Coordinators cannot see why a case is flagged high-risk | 2×2=4 | Interpretable logistic model with top-3 reasons and a suggested action; summariser claims trace back to source fields | ✅ risk reasons · 🔧 trace UI | 1×2=2 |
| R8 | Privacy | PHI leaks into model-vendor logs or application logs | 2×3=6 | Prompt hash only in `AuditLog`; summariser receives structured minimum-necessary fields; synthetic data only in the prototype; pilot needs an in-country endpoint and a DoH-approved processing agreement | ✅ hashing · 📄 pilot | 1×3=3 |
| R9 | Privacy | Messaging a patient who has not consented, or on a channel they opted out of | 2×2=4 | `ConsentRecord` scopes, including `ai_assisted_communication`; opting out routes to human-only outreach | ✅ schema · 🔧 enforcement in navigator | 1×2=2 |
| R10 | Security | Unauthorised access across organisations | 2×3=6 | JWT + role guard; org-scoped queries; helmet; input validation; audit of PHI access. Pilot: enterprise IdP with MFA, ADHICS controls | ✅ RBAC · 📄 MFA | 1×3=3 |
| R11 | Misuse / injection | Patient free text tries to steer the model (prompt injection) | 2×2=4 | Patient text is passed as quoted data, never as instructions; the grader checks output; the model has no tools that change state | ✅ design · 🔧 red-team set E9.3 | 1×2=2 |
| R12 | Misuse | Metrics used to rank or penalise individual clinicians unfairly | 1×2=2 | Metrics aggregate by organisation and stage; small-cell suppression planned | 📄 / 🔧 E8.4 | 1×1=1 |
| R13 | Model validity | Drop-off model trained on synthetic data is mistaken for a validated predictor | 2×2=4 | Stated in Limitations 2 and the model card; tier informs outreach order only; retraining on pilot data needs clinical sign-off | 📄 | 1×2=2 |

Review cadence: before pilot go-live, then quarterly or after any incident. Changes are version-controlled in this file.
