# DoH Responsible AI Standard → LoopClose controls

**Source:** Department of Health Abu Dhabi, *Responsible Artificial Intelligence (AI) Standard*, Ref. DoH/ST/DDGO/RAI/V1/2025, V1, published/effective Oct 2025, owner Data and Digital Governance Office (DDGO). Available from the Department of Health Abu Dhabi (not redistributed in this repository). Related references the Standard cites: AI Policy Standard (Jun 2025), AI Risk Management Protocol V1.0 (Jul 2025), ADHICS Standard (May 2024).

Scope (§1.2): applies to all DoH-licensed entities developing, procuring or deploying AI systems — clinical, administrative or operational — across the whole lifecycle. LoopClose falls in scope as an administrative/operational AI-enabled platform with patient-facing communication.

Legend — **Status**: ✅ implemented in scaffold · 🔧 planned (task id) · 📄 documentation/process commitment · ⛔ out of scope for prototype (pilot requirement, stated in limitations).

## §3.1 Core Foundations

| Clause | Requirement (abridged) | LoopClose control | Status |
|---|---|---|---|
| 3.1.1.1.1 | Co-design with clinicians, patients, technologists | Programme config, templates, SLA table owned by clinical leads (config not code); clinician + native-speaker review of templates (E16, E9.6); patient PREM micro-survey | 🔧 E16 / 📄 |
| 3.1.1.1.2 | Account for personal factors; tailored, equitable interventions | Locale (ar/en/ur/hi), channel preference, transport/language barriers as explicit risk features with suggested actions; urgency tiers | ✅ types/config · 🔧 E6.4 |
| 3.1.1.1.3 | Integrate into existing workflows | FHIR R4/HL7 v2 intake, HIE subscription, EMR-agnostic adapters; worklists for existing roles | ✅ intake · 🔧 E11 |
| 3.1.1.2.1 | Human-in-the-loop / on-the-loop | AI only proposes; `AIProposal` requires human `decide`; AI actors cannot close/exit/assign owners (state machine) | ✅ shared machine + tests |
| 3.1.1.2.2 | Clear escalation protocols by risk level | `config/escalation-rules.yaml` (SLA warn/breach, non-response, distress, risk-red, urgent tier) → named human roles; AI never escalation target | ✅ config · 🔧 E3.3 |
| 3.1.2.1.1 | Reliable under infrastructure failure / adversarial threats | Durable timers (pg-boss), retries, idempotent intake; prompt-injection wrapping of patient text as data; red-team set | ✅ design · 🔧 E9.3 |
| 3.1.2.1.2 | Graceful degradation & fallback | LLM unavailable → template-only messaging; no risk model → rules; grader fails closed | ✅ LlmClient / RiskService |
| 3.1.2.1.3 | Safety testing & failure-mode analysis before deployment | Golden set (60×4 locales), red team, FMEA table in `incident-and-rollback.md` | 🔧 E9 |
| 3.1.2.1.4 | Continuous post-deployment monitoring, alerts, manual review | Grader block rate, escalation rate, teach-back pass rate, drift metrics → dashboard; threshold alerts | 🔧 E8.3 / `monitoring-and-drift.md` |
| 3.1.2.2.1–2 | Feedback mechanisms, automated + human loops | Human decisions on proposals logged as labels; clinician edits to summaries diffed; patient PREM | ✅ schema · 🔧 E9.5 |
| 3.1.3.1.1–2 | Validation against benchmarks, diverse datasets | Eval report: pass rates per locale, per scenario class; risk calibration (AUC, Brier) | 🔧 E9 |
| 3.1.3.1.3–4 | Post-deployment monitoring; decline triggers review | Model version pinned per feature; drift thresholds → kill-switch runbook | 🔧 E12 |
| 3.1.3.1.5 | Documentation of validation retained for audit | `eval-report.md` generated and versioned in repo | 🔧 E9.7 |
| 3.1.4.1.1 | Formal security/privacy governance | Named AI owner per feature (model cards); risk register | 📄 |
| 3.1.4.1.2 | Layered defences, threat modelling, secure SDLC | Threat model doc (E12.4); helmet, rate limits, input validation; CI lint/test; dependency audit | 🔧 E12.4 / E15 |
| 3.1.4.2.1–3 | RBAC, MFA, least privilege, access logging | `@Roles()` guard, org-scoped queries, `AuditLog` for PHI access; MFA via enterprise IdP at pilot (demo uses seeded JWT) | ✅ RBAC/audit · ⛔ MFA (pilot) |
| 3.1.4.3.1–2 | Secure code review, vulnerability scanning, kept up to date | CI with lint/typecheck/test; `pnpm audit`/`pip-audit` step; Dependabot | 🔧 E15.5 |
| 3.1.4.4.1 | Privacy by design, minimum necessary data, purpose-specific | Consent scopes (`ConsentRecord`), continuity packet filtered by scope; summariser receives structured fields only | ✅ schema · 🔧 E4.4 |
| 3.1.4.4.2 | Encryption at rest/in transit, pseudonymisation; **production data not used to train** | TLS + managed DB encryption at pilot; prompt hashing (no raw prompt logs); risk model trained on synthetic data only; retraining on pilot data only under governance | ✅ hashing · 📄 |
| 3.1.4.4.3 | Anonymisation / differential privacy / federated learning where applicable | Metrics aggregated with small-cell suppression; de-identified exports; DP/federation noted as roadmap | 🔧 E8.4 / 📄 |
| 3.1.4.5.1 | Compute & storage within UAE; remote access from UAE | Deployment design: Azure UAE North (or equivalent), in-country LLM endpoint via `LlmClient` adapter | 📄 ADR-008 / integration-guide |
| 3.1.4.5.2–3 | Segmented networks, IDS, centralised logging | Pilot infra design; structured logs (pino) ready for SIEM | 📄 |
| 3.1.4.6 | Physical security | Cloud provider controls (pilot) | ⛔ prototype |
| 3.1.5.1.1–3 | Representative data, representativeness audits, traceable bias mitigation | Synthetic population mixes locale/age/sex/barriers; eval pass rates reported per locale and subgroup; limitation stated honestly | 🔧 E9.6 / E10 |
| 3.1.6.1.1–2 | Inform stakeholders when AI contributes; plain-language summaries | Patient messages disclose automated assistance and that a person is available; UI badges on AI proposals | 🔧 E5.8 / E7.3 |
| 3.1.6.1.3 | Right to opt out; clear consent | `ai_assisted_communication` consent scope; opt-out routes to human-only outreach | ✅ schema · 🔧 E5.x |
| 3.1.6.2.1–3 | Document data sources, model logic; end-to-end traceability logs | Model cards; datasheet for synthetic data; `AuditLog` of every AI call (prompt hash, model, tokens, outcome); event-sourced case log | ✅ audit · 📄 |
| 3.1.6.3.1–3 | Role-specific explanations | Clinician: summary with claim→source trace; coordinator: risk top-3 reasons + suggested action; patient: plain-language template + teach-back | ✅ design · 🔧 E6 |
| 3.1.7.1.1–3 | Designated owners; monitoring/review/reporting roles; logged decisions | Model card "Owner" field; proposal decisions logged with user id; version-controlled docs | ✅/📄 |
| 3.1.7.2.1–3 | Human oversight/override; clinicians retain authority; audit trails | Closure and exits human-only; override = reject proposal; audit tab | ✅ |
| 3.1.8 | Sustainability: energy-efficient, modular | Small model (Haiku) for grading/classification; rules-first grader avoids LLM calls; interpretable LR instead of large models; modular adapters | ✅ design |

## §3.2 Data Management

| Clause | Requirement | LoopClose control | Status |
|---|---|---|---|
| 3.2.1.1–3 | Validated sources with provenance; privacy safeguards; dataset mapped to a defined AI task | Prototype: synthetic data only (generator + seed documented). Pilot: results from LIS/HIE with `Provenance` resources; each dataset → one declared task | ✅ synthetic · 📄 |
| 3.2.1.4–7 | Third-party, open data licences, no scraping, consent-bound use | Synthea (Apache-2.0) if used; no scraping; consent scopes | 📄 datasheet |
| 3.2.2.1–3 | Report attribute use (feature/proxy/label), limitations, purpose mismatch | Risk model card lists every feature and its role; limitations section | 🔧 model-card-risk |
| 3.2.3.1–3 | Clinically validated, representative, quality-monitored data | Pilot requirement; prototype states no clinical validity | 📄 limitations |
| 3.2.4.1–2 | Dataset versioning, immutable archive, linkage to models | `risk_model.json` carries `version`, `trainedAt`, seed; synthetic dataset seed recorded | ✅ export fields |
| 3.2.5.1–3 | Metadata, datasheets/data cards | `docs/responsible-ai/datasheet-synthetic.md` | 🔧 E12.5 |

## §3.3 Risk Management

| Clause | Requirement | LoopClose control | Status |
|---|---|---|---|
| 3.3.1.1.1–3 | Risk assessment for all AI systems; risk register; risk owners | `risk-register.md` per feature with owner | 🔧 E12.5 |
| 3.3.1.2.1–2 | Ratings, controls, residual risk, treatment plans | Residual-risk column in register | 🔧 |
| 3.3.1.2.2.1–4 | Tiering: Very High (prohibited) / High (conformity assessment with DDGO) / Medium / Low | Proposed classification: Navigator = **Medium** (patient-facing, template-bound, human escalation); Summariser = **Low–Medium** (clinician-reviewed draft); Risk model = **Medium** (influences outreach prioritisation, never closure); Grader = **Low** (safety control). To be confirmed with DDGO at pilot | 📄 risk-classification.md |
| 3.3.1.3.1–2 | Monitor treatment plans and controls | Quarterly review cadence in monitoring doc | 📄 |
| 3.3.1.4.1 | Communicate risk assessment to stakeholders incl. DoH | Dossier is the artefact | 📄 |

## §3.4 AI Literacy

| Clause | Requirement | LoopClose control | Status |
|---|---|---|---|
| 3.4.1.1.1–3 | Role-tailored training incl. override protocols, case studies | Role guides in `docs/user-guides/` (coordinator, clinician, admin) with "when to override AI" sections | 🔧 E13 |
| 3.4.1.2.1–4 | Guidance on integrating AI; critical assessment of outputs; literacy metrics | UI shows confidence/reasons; admin dashboard tracks proposal accept/reject rates as a literacy proxy | 🔧 E7.7 |

## §4 Roles → LoopClose team mapping (fill names before submission)

| Standard role | LoopClose |
|---|---|
| Product Owner | <name> — accountable for model cards, risk register |
| Digital Governance Specialist | <name> — risk classification, monitoring/reporting |
| Data Users / Data Scientist | <name> — datasheets, eval report, fairness analysis |
| Legal Affairs | advisor TBD — licences, data-sharing, consent |

## Gaps acknowledged for the prototype
MFA/IdP, UAE-hosted infrastructure, physical security, clinical validation of data and model, DDGO conformity assessment — all are pilot-phase requirements and are listed in `docs/limitations.md`.
