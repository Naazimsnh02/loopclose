# LoopClose — Full Implementation Plan

**Window:** 24 Oct → 20 Nov 2026 (27 days). Feature freeze 17 Nov · video 18 Nov · submit 19 Nov · hard deadline 20 Nov.
**Companion docs:** `../winning-plan.md` (strategy), `adr/` (decisions), `demo-script.md`, `responsible-ai/`.

Task IDs are `E<epic>.<n>`. Each task lists **Owner role**, **Week**, **Depends on**, **Done when**. Roles: **TL** tech lead/backend · **FS** full-stack · **AI** AI/ML · **CP** clinical/product · **DX** integration/DevOps/docs.

---

## 0. Conventions & ways of working

- **Repo:** pnpm monorepo. `apps/api` (NestJS), `apps/web` (Next.js), `packages/shared` (domain types + case state machine, pure TS), `packages/fhir` (FHIR R4 typed builders/client), `analytics/` (Python: synthetic data, simulation, risk model, evals), `config/` (programme pathways + message templates as YAML), `infra/` (HAPI, Postgres), `docs/`.
- **Branching:** trunk-based; short-lived branches `feat/E3.2-sla-timers`; PR + CI green + 1 review. Squash merge.
- **Commits:** Conventional Commits (`feat(api): ...`, `fix(web): ...`, `docs: ...`).
- **Definition of Done (every task):** code + tests + docs touched in same PR; no PHI-shaped real data; lint/typecheck/test green; demo path still boots via `pnpm demo`.
- **Daily:** 15-min standup; demo-script walk-through every Friday (30, 6, 13 Nov).
- **Secrets:** `.env` never committed; `.env.example` is canonical. `ANTHROPIC_API_KEY` only in api service.
- **Language rule:** every patient-facing string lives in `config/templates/` (YAML, 4 locales), never hard-coded.
- **Actor rule (enforced in code):** every state transition carries an `actor` of kind `human | system | ai`. `ai` actors cannot transition to `closed`, `declined_by_patient`, or `lost_to_follow_up`, and cannot assign owners outside their allowed set.

---

## 1. Domain model (authoritative)

### 1.1 Core entities (Postgres via Prisma; FHIR projection to HAPI)
| Entity | Purpose | FHIR projection |
|---|---|---|
| `Organization` | Tenant / provider / programme authority | `Organization` |
| `User` + `Role` | RBAC principals (coordinator, phc_clinician, specialist, specialist_scheduler, programme_manager, admin, patient) | `Practitioner`/`PractitionerRole`/`Patient` |
| `Patient` | Synthetic demographics, language, channel prefs, consent refs | `Patient`, `Consent` |
| `ScreeningResult` | Actionable result that triggers a case | `DiagnosticReport` + `Observation` |
| `Case` | The loop; current state, programme, urgency tier, owner, SLA deadline, risk tier | `Task` (code=`screening-case`) |
| `CaseEvent` | Append-only event log (transition, assignment, message, evidence, AI proposal, override) | `Provenance` + `AuditEvent` |
| `Referral` | ServiceRequest + recipient Task lifecycle (offered/accepted/declined/redirected/completed) | `ServiceRequest` + `Task` (360X/BSeR states) |
| `Consult` | Patient↔clinician or clinician↔clinician thread; outcome | `Communication` + `Encounter`(virtual) |
| `Message` | Outbound/inbound patient messages, channel, locale, template id, grader verdict, delivery status | `Communication` |
| `Appointment` | Booked slot, attended/no-show | `Appointment` |
| `Evidence` | Closure artefacts (procedure report, care plan, surveillance order, human decision) | `Procedure`/`CarePlan`/`DocumentReference` |
| `AIProposal` | Any AI output awaiting human action (summary draft, risk score, suggested action, message outside template) | `Composition` (draft) / `RiskAssessment` |
| `ConsentRecord` | Channel + data-sharing consent, opt-outs | `Consent` |
| `AuditLog` | Every PHI read/write + every AI call (prompt hash, model, version, tokens, output id, human action) | `AuditEvent` |
| `Programme` | Loaded from `config/programmes/*.yaml`: states, SLAs, owner roles, urgency rules, evidence types | `PlanDefinition` (optional) |

### 1.2 Case state machine (from `config/programmes/colorectal-fit.yaml`)
`result_issued → patient_notified → patient_acknowledged → consult_done → referral_sent → referral_accepted → appointment_booked → confirmatory_done → treatment_or_surveillance → closed`
Side exits: `declined_by_patient`, `lost_to_follow_up` (human-only). Loops: `appointment_booked → appointment_booked` (no-show rebook), `referral_sent → referral_sent` (redirect after decline).
Invariants (tested in `packages/shared`): owner never null in non-terminal states; `closed` requires evidence or human decision; AI cannot close/exit; every transition emits an event with actor + reason.

### 1.3 Urgency tiers
`routine` (default), `priority` (e.g., FIT + age>70 or anaemia flag), `urgent` (BI-RADS 5, FIT + alarm symptoms). Tier selects SLA set and escalation target; urgent SLAs are in hours.

---

## 2. Epics & tasks

### E0 — Repo, tooling, environments (DX, TL) — W1
- **E0.1** Monorepo scaffold (pnpm workspaces, tsconfig base, eslint/prettier, husky+lint-staged). *Done when:* `pnpm -r typecheck && pnpm -r test` green on empty skeleton.
- **E0.2** Docker Compose: `postgres` (app db + hapi db), `hapi` (HAPI FHIR JPA R4 on Postgres), `api`, `web`, optional `pgadmin`. Healthchecks + depends_on. *Done when:* `docker compose up` yields HAPI `/fhir/metadata` 200.
- **E0.3** `pnpm demo` / `make demo`: up infra → migrate → seed → open web. *Done when:* clean clone to running UI < 10 min.
- **E0.4** GitHub Actions CI: install, lint, typecheck, unit tests, api e2e with Postgres service, web build, python tests. *Done when:* badge green on main.
- **E0.5** `.env.example`, secrets policy, README quickstart. *Done when:* a new teammate boots without asking questions.
- **E0.6** Observability baseline: pino structured logs, request ids, OpenTelemetry SDK with console/OTLP exporter toggle. *Done when:* a case transition shows a trace with spans api→db→hapi.
- **E0.7** Hosted environment on Azure Container Apps (UAE North) or equivalent; TLS; seeded demo data; basic uptime check. **W3.** *Done when:* judges' URL works from a clean device.

### E1 — Shared domain & state machine (TL) — W1
- **E1.1** Types: `Case`, `CaseState`, `Actor`, `Transition`, `Evidence`, `UrgencyTier`, `Programme` config schema (zod).
- **E1.2** Programme loader: parse+validate `config/programmes/*.yaml` → typed `ProgrammeDefinition`.
- **E1.3** Pure `transition(case, event, programme)` function returning new case + emitted events, or typed error. Implements invariants §1.2.
- **E1.4** SLA calculator: `deadlineFor(state, tier, programme, enteredAt, calendar)` with business-day support (UAE week Mon–Fri, configurable holidays).
- **E1.5** Test suite ≥ 30 cases: happy path, every invariant violation, urgent tier, no-show loop, decline/redirect loop, AI-forbidden transitions, idempotency.
- **E1.6** Breast programme YAML proving config-only generality (different states names mapped to canonical stages, different SLAs, urgent default for BI-RADS 5).

### E2 — Persistence, FHIR projection, auth (TL, DX) — W1–W2
- **E2.1** Prisma schema for §1.1; migrations; seed script skeleton.
- **E2.2** Event store: append-only `CaseEvent` with optimistic concurrency (`case.version`). Projections rebuildable from events (`pnpm rebuild-projections`).
- **E2.3** `packages/fhir`: typed builders for Patient, DiagnosticReport, Observation, ServiceRequest, Task, Communication, Appointment, Consent, Procedure, CarePlan, Composition, AuditEvent, Provenance, MeasureReport; thin HAPI client (create/update/search, transaction bundles, retries).
- **E2.4** FHIR projector: on each domain event, upsert corresponding FHIR resources in HAPI (outbox pattern via pg-boss job so API never blocks on HAPI).
- **E2.5** Auth: JWT (dev issuer) with seeded users per role & org; `@Roles()` guard; org scoping on every query; break-glass flag logged. Keycloak/Azure AD B2C adapter documented as production path.
- **E2.6** Audit interceptor: logs every PHI read/write (who, what, which patient, purpose) → `AuditLog` + FHIR `AuditEvent`.

### E3 — Case engine service, SLA & escalation (TL) — W2
- **E3.1** `CasesModule`: create-from-result, get, list (filters: state, owner, overdue, unassigned, rejected, stalled, tier, programme, org), transition endpoint (validates via shared machine), assign/offer/accept owner endpoints, timeline endpoint.
- **E3.2** SLA timers with **pg-boss**: on every state entry schedule `sla.warn` (amber at 70%) and `sla.breach` jobs; cancel on exit; survive restarts. *Done when:* kill api mid-timer, restart, breach still fires.
- **E3.3** Escalation rules engine (YAML-driven): on breach / decline / no-show / risk-red / non-response → create `EscalationItem` with target role/org, reason, suggested action; notify (in-app + email stub).
- **E3.4** Ownership hand-off: offer→accept with timeout → auto-escalate to programme coordinator; reject with reason codes.
- **E3.5** Closure endpoint: requires evidence upload (type-checked against programme allowed types) or human decision with reason; rejects AI actor; records `Provenance`.
- **E3.6** Side exits: `declined_by_patient` (informed refusal documented), `lost_to_follow_up` (requires outreach protocol exhausted: ≥3 attempts across ≥2 channels + phone task done).
- **E3.7** Stalled detection: no event for N days (per state) → `stalled` flag → worklist.

### E4 — Referral & consult (TL, FS) — W2
- **E4.1** Referral lifecycle per 360X/BSeR: `offered → accepted | declined(reason) | redirected → in_progress → completed | cancelled`. `ServiceRequest.status` by initiator, `Task.status` by recipient.
- **E4.2** Continuity packet: bundle of result, history summary, meds, prior screens, what patient was told, patient prefs; attached to referral; versioned.
- **E4.3** Consult threads: patient→clinician async question; clinician→clinician eConsult with structured outcome (advice, accept referral, needs visit) and time-to-response metric.
- **E4.4** Scheduling stub: slot search + book `Appointment`; attended/no-show marking; rebook flow re-enters `appointment_booked` with no-show counter.

### E5 — Patient communications & Navigator (AI, CP, FS) — W2–W3
- **E5.1** Template library: `config/templates/messages/<programme>/<stage>.yaml` with `ar`, `en`, `ur`, `hi`; variables; reading-level target; approval metadata (approver, date, version). First 12 templates per programme.
- **E5.2** Channel abstraction: `web_chat` (real), `whatsapp` (simulated adapter with Twilio sandbox optional), `sms` (simulated), `email` (simulated). Delivery statuses; failure injection for demo.
- **E5.3** Consent & preferences: channel opt-in/out, language, quiet hours; Navigator must honour.
- **E5.4** Navigator agent (Anthropic SDK, `claude-sonnet-5-5`): system prompt + tools (`get_case_context`, `send_template_message`, `ask_teach_back`, `grade_teach_back`, `propose_booking`, `escalate_to_human`, `log_distress`). Template-bound by default; free-text only to *rephrase* an approved template within guardrails.
- **E5.5** Teach-back: one question per stage; grader (`claude-haiku-5-5`) returns pass / re-explain / human; pass → `patient_acknowledged` **only if** programme policy `ai_may_acknowledge: true`, else proposal.
- **E5.6** Safety grader: pre-send policy check on every outbound message (no diagnosis, no probabilities, urgency not undermined, correct locale, reading level, no PHI of others, no hallucinated appointments). Blocks + logs + routes to human on fail.
- **E5.7** Non-response & distress detection → escalation (E3.3). Prompt-injection hardening: patient free text is data, never instructions; test set in E9.
- **E5.8** Patient web chat UI (mobile-first, RTL, 4 locales), message history, booking confirmation, "talk to a person" always visible.

### E6 — Hand-off summariser & drop-off risk (AI) — W3
- **E6.1** Summariser: builds `Composition` draft from structured FHIR only; each sentence carries source resource refs; clinician edit/approve UI; faithfulness check (every claim must map to a ref; unmapped → flagged).
- **E6.2** Risk features service: computes feature vector per case nightly + on event (time since notification w/o ack, channel failures, prior no-shows, distance flag, language mismatch, age band, pending referral age, weekday).
- **E6.3** Risk model: trained in `analytics/risk_model` (logistic regression / small GBM on synthetic data) → exported as JSON coefficients + calibration → scored in TS; top-3 reasons; tiers green/amber/red with thresholds in config.
- **E6.4** Suggested actions per reason (call, alternate channel, transport support, slot change) as proposals; coordinator accepts/dismisses; outcome logged for future learning.
- **E6.5** Rules fallback for first 30 days of pilot (documented), toggle in config.

### E7 — Coordinator, clinician, admin UIs (FS) — W2–W3
- **E7.1** App shell: auth, role switcher (demo), org context, i18n (en/ar UI chrome), RTL, accessible components (shadcn/ui).
- **E7.2** Coordinator worklist: tabs Overdue / Unassigned / Rejected / Stalled / At-risk / All; filters; bulk assign; SLA countdown chips; risk badges with reasons.
- **E7.3** Case detail: timeline (events), state diagram with current node, owner panel (offer/accept), SLA panel, messages, referral, consults, evidence, AI proposals inbox, close action with evidence gate, audit tab.
- **E7.4** Clinician consult inbox: pending eConsults, patient questions, referrals to accept/decline/redirect, summariser drafts to approve, continuity packet viewer.
- **E7.5** Specialist scheduler view: accepted referrals awaiting booking; slot booking; no-show handling.
- **E7.6** Programme manager dashboard (E8).
- **E7.7** Admin: users/roles/orgs, programme config viewer, template library with approval status, AI feature kill-switches, audit search, consent overview.
- **E7.8** Result intake simulator page (demo tool): push a FIT/mammogram result to the FHIR Subscription endpoint; inject channel failures; fast-forward clock for SLA demo.

### E8 — Metrics & reporting (TL, FS, CP) — W3
- **E8.1** Metric definitions doc (numerator/denominator/windows) for: time to notification, acknowledgement, consult, confirmatory test, appointment, treatment; referral acceptance rate; appointment completion; treatment start; open actionable results by age bucket; drop-off reasons; documented closure rate; teach-back pass rate; patient confidence (PREM 2-question micro-survey); SLA compliance by stage/org.
- **E8.2** Metrics service computing from event store (SQL views / materialised views refreshed by job).
- **E8.3** Dashboard: funnel, stage time distributions, SLA heatmap by org, open-results ageing, drop-off reason breakdown, before/after panel (E10), filters by programme/org/period. Follow `dataviz` guidance (consistent palette, accessible).
- **E8.4** Exports: CSV (IFHAS-style indicator layout), FHIR `MeasureReport` bundle, JSON API.

### E9 — AI evaluation & red team (AI, CP) — W3
- **E9.1** Golden set: 60 scenarios × 4 locales (result types, tiers, literacy levels, distress, questions out of scope).
- **E9.2** Rubric: accuracy vs template, urgency preserved, no diagnosis, tone/reassurance, locale correctness, reading level; scored by clinician + native speakers (2 per locale) + LLM-judge for regression.
- **E9.3** Red-team set: prompt injection in patient text, requests for diagnosis/prognosis, wrong-patient confusion, attempts to get the agent to close/cancel, abusive input, emergency symptoms. Expected: block/escalate.
- **E9.4** Summariser faithfulness eval (claim→source mapping rate; hallucination rate).
- **E9.5** Risk model report: calibration curve, discrimination on synthetic holdout, feature importance, stated limitation.
- **E9.6** `analytics/evals` runner producing `docs/responsible-ai/eval-report.md` with tables; run in CI nightly (non-blocking).

### E10 — Synthetic data & impact simulation (AI, CP, DX) — W1 (data), W3 (sim)
- **E10.1** Synthea pipeline: generate ~5,000 adults FHIR R4; post-process demographics to UAE mix (nationality, languages ar/en/ur/hi, age bands 18–75); strip US-specific artefacts.
- **E10.2** Result generators: FIT (positivity 5–7%), mammogram BI-RADS distribution (4/5 ≈ 2–3%), alarm-symptom flags, prior no-show history, distance/transport flag.
- **E10.3** Seeder: loads patients/results into app DB + HAPI; creates 8 scripted demo cases in known states (see `demo-script.md`), plus ~300 background cases across states/tiers/orgs for realistic dashboards.
- **E10.4** Discrete-event simulation (`analytics/simulation`, SimPy): baseline vs LoopClose arms; parameters file with citations; 1,000 replications; outputs medians/intervals + sensitivity (tornado) → `docs/impact-brief.md` + JSON consumed by dashboard before/after panel.
- **E10.5** Clock control for demo: `DEMO_CLOCK_OFFSET` lets the intake simulator fast-forward SLA breaches deterministically.

### E11 — Integration adapters (DX, TL) — W2–W3
- **E11.1** Inbound FHIR: `POST /fhir/DiagnosticReport` + HAPI Subscription (rest-hook) → result intake → case creation; idempotent on `identifier`.
- **E11.2** HL7 v2 ORU^R01 → FHIR DiagnosticReport mapper (node-hl7 or hand parser); sample messages; tests.
- **E11.3** Malaffi/EMR adapter interface (`ResultSource`, `PatientDemographicsSource`, `SchedulingSink`, `DocumentSink`) with stub implementations + mapping notes for Malaffi (FHIR R4 vs HL7v2 options) → `docs/integration-guide.md`.
- **E11.4** Outbound notifications: in-app, email stub (MailHog in compose), WhatsApp simulated adapter with optional Twilio sandbox behind flag.
- **E11.5** Webhook/API docs: OpenAPI generated from Nest decorators; FHIR `CapabilityStatement` published.

### E12 — Governance, security, Responsible AI (DX, CP, AI) — W2–W4
- **E12.1** RBAC matrix doc + tests per endpoint.
- **E12.2** Consent model + enforcement tests (opt-out → Navigator silent; data-sharing scope → referral packet filtering).
- **E12.3** AI call audit (prompt hash, model id, version, latency, tokens, output id, downstream human action) + per-feature kill-switch (admin UI + env).
- **E12.4** Security baseline: helmet, rate limits, input validation (zod/class-validator), dependency audit in CI, secrets scanning, TLS in hosted env, encrypted at rest (managed Postgres).
- **E12.5** Responsible AI dossier: model cards (Navigator, Summariser, Risk, Grader), risk classification, human-oversight map, DoH Responsible AI Standard mapping table, ADHICS posture statement, data-flow + residency diagram, DPIA-lite, incident & rollback runbook, monitoring/drift plan.
- **E12.6** Threat model (STRIDE-lite) for patient channel + AI boundary.

### E13 — Documentation (DX, all) — W3–W4
- **E13.1** `README` quickstart + demo credentials + video link.
- **E13.2** Solution overview with screenshots & journeys.
- **E13.3** Architecture doc + 8 ADRs + state machine spec + SLA/escalation rules + data model + FHIR profile mapping.
- **E13.4** API docs (OpenAPI) + CapabilityStatement.
- **E13.5** Impact brief (from E10.4).
- **E13.6** Integration & deployment guide; scaling notes; load test results (k6: 200 concurrent coordinators, 10k cases).
- **E13.7** Assumptions & Limitations (explicit, numbered).
- **E13.8** Pilot & commercial plan.
- **E13.9** Test report (coverage, e2e scenarios, eval summary).

### E14 — Demo & submission (CP, DX, all) — W4
- **E14.1** Demo script finalised (`demo-script.md`), seeded scenario IDs frozen.
- **E14.2** 7-min video recorded 18 Nov (screen + voice; captions; Arabic segment shown with subtitles).
- **E14.3** Judge sandbox: role accounts, reset-to-seed button, guided tour banner.
- **E14.4** Submission checklist on Hack2skill: prototype link, repo access, video, documentation PDF bundle (export docs → single PDF), assumptions, limitations. Submit 19 Nov; verify receipt.
- **E14.5** Fallback: offline video + Compose bundle if hosted env fails.
- **E14.6** Fill the official submission deck (`docs/[PUB] … Submission Template.pptx`, 15 slides; map in `docs/submission/README.md`). Mandatory: cover, team table (incl. age confirmation), capability summary ≤1,000 chars, architecture diagram, target users/outcomes, success measures, evidence, data sources & legal right, risks & safeguards, path to pilot/scale, pre-existing IP & third-party licences, conflict-of-interest declaration. Hardware slide = "none". Draft W3, final 18 Nov.
- **E14.7** Supporting drafts: `docs/submission/team-capability.md`, `docs/responsible-ai/datasheet-synthetic.md`, `docs/submission/third-party.md` (from `pnpm licenses list` + `pip list`), `docs/responsible-ai/risk-register.md`.

### E15 — Quality: testing & load (TL, DX) — continuous
- **E15.1** Unit: shared machine ≥ 95% coverage; api services ≥ 80%.
- **E15.2** API e2e (Supertest) for the demo path end-to-end against Postgres + HAPI in CI.
- **E15.3** Web e2e (Playwright): coordinator worklist → case → close; patient chat flow (ar + en).
- **E15.4** Load: k6 scripts; targets p95 < 300 ms for worklist with 10k cases.
- **E15.5** Chaos: restart api during SLA timers; HAPI down → outbox retries; LLM timeout → graceful degradation (template-only mode).

### E16 — Clinical content (CP) — W1–W3
- **E16.1** Colorectal pathway + SLA table validated vs IFHAS/DoH programme standard; breast pathway likewise.
- **E16.2** Urgency rules (alarm symptoms, BI-RADS 5) and evidence types per programme.
- **E16.3** Message templates ×12 ×4 locales with reading-level checks and native-speaker review log.
- **E16.4** Drop-off reason taxonomy (patient, provider, system, access, communication) used across UI and metrics.
- **E16.5** PREM micro-survey (2 questions: understanding, confidence) wording ×4 locales.
- **E16.6** Clinician advisor review sessions (W1 end, W3 end) with sign-off recorded in docs.

---

## 3. Week-by-week schedule

| Week | Focus | Must-ship (exit gate) |
|---|---|---|
| **W1 · 24–30 Oct** | E0, E1, E2.1–2.3, E10.1–10.2, E16.1–16.2, E7.1 shell | `pnpm demo` boots; machine tests green; Synthea data generated; pathways signed off |
| **W2 · 31 Oct–6 Nov** | E2.4–2.6, E3, E4, E5.1–5.5, E7.2–7.4, E11.1 | Demo steps 2–5 runnable; SLA breach survives restart; referral decline→redirect works |
| **W3 · 7–13 Nov** | E5.6–5.8, E6, E7.5–7.8, E8, E9, E10.3–10.5, E11.2–11.5, E12.3–12.5, E0.7 | Full demo path on hosted env; eval report v1; dashboard with before/after; docs draft |
| **W4 · 14–20 Nov** | E12.1–12.2, E12.6, E13, E14, E15.3–15.5 | Freeze 17 · video 18 · submit 19 · buffer 20 |

Critical path: E1 → E3 → E4/E5 → E7.3 → E14. Parallel tracks: data (E10), clinical content (E16), AI (E5/E6/E9), docs (E13).

---

## 4. API surface (v1, summary)

```
POST   /api/results                      intake (FHIR DiagnosticReport or HL7v2 via adapter)
GET    /api/cases?state&owner&overdue&unassigned&rejected&stalled&tier&programme&org
GET    /api/cases/:id                    + /timeline + /fhir (projection links)
POST   /api/cases/:id/transition         {to, actor, reason, evidence?}
POST   /api/cases/:id/owner/offer|accept|reject
POST   /api/cases/:id/close              {evidence[] | humanDecision}
POST   /api/cases/:id/exit               {kind: declined_by_patient|lost_to_follow_up, justification}
POST   /api/referrals                    ; POST /api/referrals/:id/accept|decline|redirect|complete
POST   /api/consults                     ; POST /api/consults/:id/messages ; /outcome
POST   /api/messages/outbound            (goes through grader) ; POST /api/messages/inbound (webhook)
POST   /api/navigator/:caseId/run        (agent turn)
POST   /api/ai/summaries/:caseId         → draft ; POST /api/ai/summaries/:id/approve
GET    /api/risk/:caseId                 ; POST /api/risk/recompute
GET    /api/escalations                  ; POST /api/escalations/:id/resolve
GET    /api/metrics/*                    ; GET /api/metrics/export.csv ; /measure-report
GET    /api/audit?patientId&actor&range
POST   /api/admin/ai-features/:name/toggle
POST   /api/demo/reset | /demo/clock     (demo only, disabled in prod)
```

---

## 5. Risks & controls (delivery)

| Risk | Control |
|---|---|
| HAPI startup slow / flaky in CI | Pin image; CI uses HAPI only in e2e job; unit tests mock FHIR client |
| LLM latency in demo | Cache Navigator turns for scripted cases; template-only fallback mode |
| Arabic/Urdu rendering issues | RTL from day one; test fonts (Noto Naskh/Nastaliq); native review |
| Scope overrun in UI | Case detail first, polish last; breast programme is config-only |
| Team member unavailable | Every epic has a backup owner; docs continuously updated |

---

## 6. Submission checklist (19 Nov)

- [ ] Hosted URL live, judge accounts tested from clean device
- [ ] Repo access granted (read-only) with README quickstart verified from clean clone
- [ ] 7-min video uploaded (+ backup link)
- [ ] Documentation PDF bundle: overview, architecture, ADRs, API, RAI dossier, impact brief, integration/deployment, assumptions, limitations, pilot plan, test report
- [ ] Assumptions & Limitations sections explicitly present in submission form
- [ ] Official PPTX template fully filled; `slide_text.py` shows no leftover placeholders; slide 3 ≤ 1,000 chars
- [ ] Team table complete with age confirmation; conflict-of-interest declarations collected from every member
- [ ] Third-party/IP slide matches actual dependency licences
- [ ] Team info, contact, consent to T&Cs
- [ ] Receipt confirmation saved
