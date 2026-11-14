# Winning Plan — Closing the Screening-to-Care Loop (Challenge 05, Population Health)

**Prepared:** 24 Oct 2026 · **Prototype due:** 20 Nov 2026 (27 days) · **Companion to:** `screening-to-care-brief.md`

---

## 0. The one-paragraph thesis

Build **a closed-loop results-management platform, not a chatbot**. The product is a FHIR-native *case engine* that treats every actionable screening result as a case with a state machine, a named accountable owner at every step, SLA clocks, human-governed escalation, and evidence-gated closure — operating *across* organisations (lab → screening programme → primary care → specialist → hospital). AI is layered on top in exactly three bounded roles (patient navigator, hand-off summariser, drop-off risk), each of which can *propose* but never *decide*. The demo proves impact with a transparent before/after simulation grounded in published Abu Dhabi and international follow-up failure rates, and the deployment story is specific to Abu Dhabi: IFHAS, Malaffi, DoH Responsible AI Standard, ADHICS.

Why this wins: the judges say "Impact first. Then proof that it works." Most teams will ship an LLM that explains results. We ship the *system of record for accountability* that health systems actually lack, with the LLM as a feature inside it. That is what a DoH/ADPHC evaluator recognises as deployable.

---

## 1. What the research tells us (and how we use it)

### 1.1 The problem is quantified — and Abu Dhabi has its own number
- Abu Dhabi AHS clinics, 2015–16 cohort (Emirati nationals 40–75): only **23.5%** of eligible people were FIT/gFOBT-screened, and of positive tests only **30.5%** completed follow-up colonoscopy; **36.3%** of non-completers had been referred to gastroenterology but never attended. The programme's own standard targets referral + colonoscopy within **31 days for >90%**. ([PMC8343888](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8343888/))
- Internationally: 6.8–62% of lab results and 1–35.7% of radiology results lack follow-up; ~8% of abnormal EHR-notified outpatient results have no follow-up at 4 weeks ([Joint Commission](https://digitalassets.jointcommission.org/api/public/content/77c6421712dc463eae4b2398f9bf01a5)). AHRQ's closed-loop lab found baseline loop-closure often **<60%**, worst for colonoscopy ([AHRQ](https://www.ahrq.gov/patient-safety/resources/learning-lab/closed-loop-long-desc.html)).
- A 2024 12-site VA stepped-wedge trial on missed CRC/lung results found improvements only at low-baseline sites, not overall ([PSNet](https://psnet.ahrq.gov/issue/virtual-breakthrough-series-collaborative-missed-test-results-stepped-wedge-cluster)) — i.e., *process redesign without infrastructure doesn't stick*. That is our argument for a system, not a QI campaign.

**Use:** Lead the pitch with the Abu Dhabi 30.5% figure. Make "positive FIT → completed colonoscopy within 31 days" the hero metric. Cite the VA trial as the reason tooling matters.

### 1.2 Standards have converged on *Task-on-ServiceRequest* for closed-loop referral
- IHE **360X** and HL7 **BSeR** both model the referral as a `ServiceRequest` (status owned by the *initiator*) with a `Task` whose `focus` is that request (status owned by the *recipient/owner*), with harmonised business states (requested → accepted/declined → in-progress → completed/cancelled). ([360X IG](https://oncprojectracking.healthit.gov/wiki/spaces/TechLab360X/pages/18776122/360X+Implementation+Guide), [BSeR workflow](http://hl7.org/fhir/us/bser/WorkflowManagementResources.html))
- FHIR R4 is what the regional HIEs speak in practice (vendor integrators report FHIR R4 + HL7 v2 for Malaffi; Riayati has published FHIR interfaces) ([careup](https://www.careup.ai/blog/malaffi-nabidh-hie-integration-hms-uae), [MOHAP](https://mohap.gov.ae/en/riayati/about-numr)). Treat Malaffi's exact API surface as unconfirmed until we get the spec — design an adapter, not a dependency.

**Use:** Our case engine's state machine is *explicitly* a superset of the 360X/BSeR referral states, so a judge from an interoperability background sees we did not invent a proprietary workflow. Every case is persisted as real FHIR resources (`DiagnosticReport`, `ServiceRequest`, `Task`, `Communication`, `Appointment`, `Consent`, `AuditEvent`, `Provenance`).

### 1.3 Regulatory expectations in Abu Dhabi are concrete
- DoH **Responsible AI Standard V1 (2025)** applies to all licensed entities that develop, procure or deploy AI; requires a formal governance structure, security/privacy by design, and points to **ADHICS** for cybersecurity ([DoH PDF](https://www.doh.gov.ae/-/media/Feature/Resources/Standards/2025/Responsible-AI-Standard-V1.ashx)). Health AI processing Abu Dhabi patient data needs DoH authorisation ([Latham & Watkins](https://www.lw.com/en/insights/ai-in-the-uae-understanding-the-regulatory-landscape-and-key-authorities)).
- Federal **ICT Health Law** (Art. 16) restricts use of health data to health purposes; written consent needed otherwise ([L&W](https://lw.com/thoughtLeadership/lw-new-uae-law-regulates-healthcare-data)).
- **IFHAS** (DoH standard V10, 2025) mandates service specs *and data-reporting requirements* for the periodic screening programme; results flow into Malaffi ([DoH IFHAS standard](https://www.doh.gov.ae/-/media/EE758C3B77314BC394F2479AEF803AA2.ashx), [ADPHC](https://www.adphc.gov.ae/en/Public-Health-Programs/IFHAS)). UAE is moving toward nationwide mandatory cancer screening ([Khaleej Times](https://www.khaleejtimes.com/uae/uae-moves-towards-nationwide-mandatory-early-cancer-screening-says-minister)) — more positives, more loops to close.

**Use:** Ship a *Responsible AI dossier* (model card, risk classification, human-oversight map, DPIA-lite, incident process) mapped to the DoH standard's headings. Position the metrics module as *IFHAS data-reporting-ready*. This directly addresses criteria 4 and 5.

### 1.4 AI trend: from "explain the result" to governed agents — with evidence caveats
- Epic is shipping results-explanation to patients (Memorial Hermann, Sept 2026) and agent platforms (HIMSS26); incidental-findings follow-up agents report 69% early lung cancer detection vs 46% baseline at one site ([Fierce](https://www.fiercehealthcare.com/ai-and-machine-learning/himss26-epic-expands-ai-roadmap-previews-factory-build-and-orchestrate-ai), [Memorial Hermann](https://memorialhermann.org/about-us/newsroom/press-releases/epics-ai-tool-helps-patients-understand-test-results)). Only ~3% of systems have agents in live workflows; 43% piloting ([Kore.ai](https://www.kore.ai/blog/ai-agents-in-healthcare-12-real-world-use-cases-2026)).
- LLM plain-language summaries improve readability 2–6 grade levels but needed professional review in up to 80% of outputs in some settings; harmful factual errors 0–10% ([PMC12920046](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12920046/)). Arabic simplification pipelines are feasible but early ([PubMed 42546532](https://pubmed.ncbi.nlm.nih.gov/42546532/)); multilingual quality varies by language ([AI-MIRACLE](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11433331/)). RCTs are only now starting ([oncOPAL](https://clinicaltrials.gov/study/NCT07519811)).

**Use:** Our AI stance = *clinician-approved templates + LLM personalisation, with a safety grader and teach-back check, and a documented Arabic-quality review*. We say openly that patient-facing free generation is gated, and that is the mature answer. We differentiate from Epic on the **cross-organisational** part (Epic closes loops inside one EHR; the brief's pain is *between* providers), which is exactly what an HIE-connected emirate can do and a US IDN cannot.

---

## 2. Scoring strategy — criterion by criterion

| Criterion | What we show | Artefact |
|---|---|---|
| 1. Health impact & clinical relevance | Positive-FIT → colonoscopy loop closure; time-to-care; unresolved results; anchored to Abu Dhabi baseline (30.5%) | Impact simulation report; clinical-pathway doc reviewed by a clinician on team/advisor |
| 2. Technical depth & architecture | FHIR-native event-sourced case engine; 360X/BSeR-aligned state machine; SLA/escalation engine; integration adapters; multi-tenant cross-org ownership | Architecture doc, ADRs, OpenAPI + FHIR CapabilityStatement |
| 3. Working solution & demo quality | Four role-based UIs working end-to-end on a seeded Synthea population; scripted 7-min video + live sandbox | Deployed URL, demo video, seeded scenarios |
| 4. Responsible AI, safety, governance | AI never closes/decides; approval gates; audit; consent; red-team results; DoH RAI Standard mapping; ADHICS posture | Responsible AI dossier, model card, eval report |
| 5. Scalability & deployment readiness | Containerised, cloud-region-portable (Azure UAE North given Microsoft is a co-creator), stateless services, FHIR Subscriptions, HL7v2 adapter, Malaffi integration design | Deployment guide, load test, integration plan |
| 6. Commercial viability & path to pilot | Named pilot shape (one programme × one network), pricing, 12-month roadmap, regulatory pathway | Pilot plan + business model one-pager |

---

## 3. Product definition

**Working name:** *LoopClose* (alt: *Khatwa* — "the step"; decide in W1, not important).

**Scope for the prototype (two programmes, one engine):**
1. **Colorectal — positive FIT → colonoscopy → histology → treatment/surveillance.** Primary. Best Abu Dhabi evidence, clear SLA (31 days), high drop-off, cross-provider (PHC → GI → hospital).
2. **Breast — BI-RADS 4/5 screening mammogram → diagnostic imaging → biopsy → MDT.** Secondary, configured not coded, to prove the engine is programme-agnostic (different SLAs, different owner roles, urgent-tier handling).

**Personas:** Patient (Arabic/English/Urdu/Hindi); screening-programme coordinator; referring PHC clinician; receiving specialist (GI / breast radiology); programme manager (metrics); admin/auditor.

**Out of scope (state it):** result interpretation/diagnosis by AI; direct EHR write-back in prototype; real patient data; real WhatsApp delivery (simulated channel; Twilio sandbox optional).

---

## 4. Requirement → capability mapping

| Brief requirement | How LoopClose satisfies it |
|---|---|
| 1. End-to-end case visibility | Every actionable `DiagnosticReport` auto-opens a Case; stages persisted as FHIR `Task` lifecycle + event log; timeline view per case; programme-level funnel |
| 2. Clear ownership & timely progression | `Task.owner` is mandatory at every state; hand-off = *offer → accept* (no silent transfers); SLA clocks per transition with amber/red thresholds; worklist tabs: Overdue / Unassigned / Rejected / Stalled |
| 3. Patient-centred communication | Navigator sends clinician-approved, language/culture-adapted explanation; teach-back question; acknowledgement captured as `Communication` with status; non-response detection; reassurance tone guidelines; channel preference from `Consent` |
| 4. Cross-provider consultation & coordination | Consult inbox (patient→clinician async, clinician→clinician eConsult); referral as `ServiceRequest` + `Task` with accept/decline/redirect; auto-generated hand-off summary attached as `Composition`; continuity packet travels with the case |
| 5. Safe, human-governed escalation | Rules + risk score → escalation queue; urgent tier (e.g., BI-RADS 5, FIT + alarm symptoms) routed to on-call role with time-boxed acknowledgement; closure requires evidence artefact (procedure report / treatment plan / surveillance order) **or** an authorised clinician's recorded decision with reason; AI is structurally unable to transition to `closed` |
| 6. Closure & impact measures | Metrics service computes: time-to-notification, -acknowledgement, -consult, -confirmatory test, -appointment, -treatment; referral acceptance & appointment completion rates; open actionable results by age; drop-off reason taxonomy; teach-back pass rate; patient confidence (PREM micro-survey); all exportable (IFHAS-style CSV + FHIR `MeasureReport`) |

---

## 5. Architecture

### 5.1 Logical view
```
                 ┌────────────────────────────── Channels ──────────────────────────────┐
                 │  Patient chat (web, WhatsApp-style)   SMS   Email   Patient portal     │
                 └───────────────────────────────┬──────────────────────────────────────┘
                                                 │
┌───────────────┐   ┌───────────────────────────┴──────────────────────────┐   ┌─────────────────┐
│ Coordinator   │   │                 API Gateway / AuthZ (RBAC, tenant)    │   │ Metrics &       │
│ worklist      │◄──┤                                                       ├──►│ dashboard       │
│ Clinician     │   │  Case Service    SLA/Escalation    Consult/Referral   │   │ (MeasureReport, │
│ consult inbox │   │  (state machine, (durable timers,  (ServiceRequest +  │   │  IFHAS export)  │
│ Admin/audit   │   │   event-sourced)  rules)            Task, accept/decl)│   └─────────────────┘
└───────────────┘   │                                                       │
                    │  AI Services (bounded, propose-only):                 │
                    │   • Navigator (explain / teach-back / booking assist) │
                    │   • Hand-off summariser (Composition draft + trace)   │
                    │   • Drop-off risk (interpretable model + reasons)     │
                    │   • Safety grader (pre-send policy check)             │
                    └───────────────┬───────────────────────┬───────────────┘
                                    │                       │
                      ┌─────────────┴──────────┐   ┌────────┴─────────────────────┐
                      │ FHIR R4 store (HAPI)   │   │ Integration adapters          │
                      │ + Postgres event log   │   │  FHIR Subscriptions (inbound  │
                      │ + AuditEvent/Provenance│   │  DiagnosticReport), HL7v2 ORU │
                      └────────────────────────┘   │  → FHIR, Malaffi/EMR stubs,   │
                                                   │  scheduling (Appointment) stub │
                                                   └───────────────────────────────┘
```

### 5.2 Key design decisions (write these as ADRs)
1. **FHIR-native persistence.** Cases are projections over FHIR resources, not a parallel schema. Judges can query the HAPI server directly. Case ≈ `Task` (type=case) with child `Task`s per stage; referral per 360X/BSeR.
2. **Event-sourced case engine.** Every transition is an immutable event (who/what/when/why/evidence). This *is* the audit trail and powers the metrics without ETL.
3. **Durable timers for SLAs** (Temporal.io, or a Postgres-backed scheduler such as pg-boss if time is short). SLA breach → event → escalation rule → queue item + notification. No cron hacks.
4. **Ownership invariant.** The engine rejects any state where `owner` is null. Hand-off is a two-phase offer/accept with timeout → auto-escalation to programme coordinator (never to AI).
5. **Closure invariant.** `closed` requires `evidence[]` non-empty with allowed types *or* `humanDecision{actor, role, reason}`; enforced in code and covered by tests.
6. **AI as proposer.** All AI outputs are `draft` resources pending human action, except Navigator *template-bound* messages approved in advance by the programme clinical lead. Free-text LLM output to patients passes a safety grader and, for anything outside the template library, requires clinician approval.
7. **Multi-tenant cross-org model.** Organisations are first-class (`Organization`); cases span orgs; each org sees only its own and shared-case data; the programme (ADPHC-like role) sees the whole loop. This is the "across providers" requirement most teams will miss.
8. **Model-agnostic LLM adapter.** Default Claude (`claude-sonnet-5-5` for Navigator/summariser; `claude-haiku-5-5` for classification/grading); interface allows Azure-hosted models for data-residency pilots.

### 5.3 Case state machine (colorectal; configurable per programme)

| State | Entered when | Owner (role) | SLA to next | Escalation if breached |
|---|---|---|---|---|
| `result_issued` | Actionable `DiagnosticReport` received (FIT positive) | Screening programme coordinator | Notify ≤ 2 business days | Coordinator lead |
| `patient_notified` | `Communication` sent (channel per consent) | Coordinator | Ack ≤ 3 days | Re-attempt via alt channel → phone task |
| `patient_acknowledged` | Teach-back passed or human confirmation | Referring PHC clinician | Consult ≤ 5 days | PHC lead |
| `consult_done` | Encounter/eConsult recorded | PHC clinician | Referral issued ≤ 2 days | PHC lead |
| `referral_sent` | `ServiceRequest` + `Task` offered to GI | PHC (initiator) + GI (pending) | Accept/decline ≤ 3 days | Programme coordinator; redirect option |
| `referral_accepted` | GI accepts `Task` | GI scheduler | Appointment booked ≤ 5 days | GI lead |
| `appointment_booked` | `Appointment` booked | GI | Attended ≤ 31 days from result | No-show → re-book task + risk re-score |
| `confirmatory_done` | Colonoscopy `Procedure` + report | GI clinician | Result communicated ≤ 7 days | GI lead |
| `treatment_or_surveillance` | `CarePlan` / surveillance `ServiceRequest` | Treating clinician | — | — |
| `closed` | Evidence or authorised human decision | — | — | — |
| `declined_by_patient` / `lost_to_follow_up` | Documented informed refusal or exhausted outreach protocol | Coordinator (human sign-off) | — | Review list |

Urgent tier (e.g., BI-RADS 5, FIT positive with alarm symptoms flagged by referrer): SLAs compressed, on-call owner, acknowledgement timer in hours. SLA values above are placeholders to be confirmed by the clinical lead against the IFHAS/DoH programme standards.

### 5.4 AI components — specification

**A. Patient Navigator**
- Inputs: result type, risk tier, patient language/literacy preference, programme-approved message templates, booking slots (stub).
- Behaviour: explains what the result *means and does not mean* (a positive FIT is not a cancer diagnosis), urgency, next steps; asks one teach-back question ("In your own words, what is the next step?"); grades the answer (pass / re-explain / hand to human); offers booking; detects non-response and distress keywords → human.
- Guardrails: template-bound by default; no prognosis, no interpretation beyond template; cannot change case state except `patient_acknowledged` **when teach-back passes and coordinator policy allows**, otherwise proposes; safety grader runs on every outbound message (no diagnosis, no probabilities, no reassurance that contradicts urgency, correct language, target reading level).
- Languages: Arabic (MSA with Gulf-register review), English, Urdu, Hindi. Native-speaker review of the template set, logged in the eval report.

**B. Hand-off summariser**
- Generates a `Composition` draft for referral/eConsult from structured FHIR (result, history, meds, prior screening, patient preferences, what the patient has already been told). Clinician edits/approves. Faithfulness eval: every statement must trace to a source resource (we show the trace in the UI).

**C. Drop-off risk**
- Interpretable model (logistic/GBM with SHAP-style reasons) over features: time since notification without ack, channel failures, prior no-shows, distance/transport flag, language mismatch, age band, weekday, referral pending age. Output: risk tier + top-3 reasons → suggested action (call, alternate channel, transport support, slot change).
- Honesty: trained on synthetic data in the prototype; we present the *pipeline, features, calibration method and retraining plan*, and state the limitation. Rules cover the first 30 days of any pilot.

**D. Evaluation harness (ship it)**
- Golden set: 60 scenarios × 4 languages; rubric scored by clinician + native speakers; red-team set (prompt injection via patient free text, requests for diagnosis, distress, wrong-patient confusion). Report pass rates, failure modes, and what the guardrails caught.

### 5.5 Governance & security (map to DoH RAI Standard + ADHICS headings)
- RBAC with org-scoped permissions; break-glass logged.
- `Consent` resource drives channel + data-sharing; opt-out honoured by the Navigator.
- `AuditEvent` for every read/write of PHI and every AI invocation (prompt hash, model, version, output id, human action).
- AI risk classification (Navigator = moderate-risk patient-facing; summariser = low-risk clinician-assist; risk model = decision-support) with a human-oversight map.
- Incident process (72-hour DoH reporting posture), model versioning, drift-monitoring hooks, kill-switch per AI feature.
- Data residency design: deployable in-country (Azure UAE North / on-prem); no PHI to a model vendor in pilot without a DoH-approved processing agreement; prototype uses synthetic data only.

---

## 6. Impact simulation (the "proof" layer)

Build a small discrete-event simulation (Python) rather than hand-waved numbers:
- Population: ~5,000 synthetic eligible adults (Synthea, UAE-ish demographics/languages), FIT positivity ~5–7%, BI-RADS 4/5 rate ~2–3% of screens.
- **Baseline arm** parameters from literature: 30.5% colonoscopy completion after positive FIT (Abu Dhabi 2015–16); notification failure ~7%; referral-to-appointment loss ~36%; no-show ~20%.
- **LoopClose arm:** apply *conservative, cited* effect sizes (outreach + navigation + reminder uplift ranges from AHRQ closed-loop pilots and patient-navigation literature), run 1,000 Monte-Carlo replications, report medians + intervals, and a sensitivity table showing which assumptions matter most.
- Outputs feed the dashboard "Before / After" view and a one-page impact brief. State plainly: synthetic simulation, not clinical evidence; it defines the pilot's measurement plan.

---

## 7. Demo (7 minutes, scripted, recorded + live sandbox)

1. **0:00** Problem in one line + the Abu Dhabi 30.5% number.
2. **0:40** Lab pushes a positive FIT (`DiagnosticReport` via FHIR Subscription) → case appears, owner assigned, SLA clock starts.
3. **1:30** Patient (Arabic) receives explanation; teach-back fails → re-explain → passes → acknowledged. Show safety-grader log.
4. **2:45** PHC clinician consult inbox: AI hand-off summary draft → edit → referral `ServiceRequest` offered to GI.
5. **3:30** GI declines (wrong site) → auto-escalation to coordinator → redirect → accepted → booked.
6. **4:15** Second patient stops responding → drop-off risk red with reasons → coordinator calls → rebook. Show worklist tabs.
7. **5:00** Try to close a case with no evidence → engine refuses; attach colonoscopy report → closed. Show audit trail.
8. **5:45** Dashboard: funnel, times, open results, drop-off reasons; before/after simulation.
9. **6:30** Deployment story: Malaffi/EMR adapters, DoH RAI dossier, pilot shape.

---

## 8. Technology stack (bias to boring and demonstrable)

- **FHIR server:** HAPI FHIR JPA (Docker) · **DB:** PostgreSQL · **Timers:** Temporal.io (or pg-boss fallback)
- **Backend:** TypeScript (NestJS) or Python (FastAPI) — pick the team's strongest; one language for services + adapters
- **Frontend:** Next.js + Tailwind + shadcn/ui; RTL support for Arabic/Urdu from day one
- **AI:** Claude API via adapter; prompt + template library versioned in repo; eval harness in Python
- **Risk model:** scikit-learn/LightGBM + SHAP
- **Synthetic data:** Synthea (FHIR R4 export) + custom generator for FIT/mammogram results and a UAE language/demographic mix
- **Infra:** Docker Compose for judges (`make demo` boots everything with seeded data); Azure Container Apps (UAE North) for hosted demo; GitHub Actions CI with tests
- **Observability:** structured logs, OpenTelemetry traces (shows maturity cheaply)

---

## 9. Team & 27-day delivery plan

Roles (5): **Tech lead/backend** (case engine, FHIR), **Full-stack** (UIs), **AI/ML** (Navigator, summariser, risk, evals), **Clinical/product** (pathways, SLAs, templates, Arabic review, impact model), **Integration/DevOps + docs** (adapters, deployment, documentation, video). Recruit a clinician advisor (GP or GI) for two review sessions if nobody on the team is clinical.

| Week | Dates | Deliverables | Exit criteria |
|---|---|---|---|
| **W1 — Foundations** | 24–30 Oct | Repo, CI, Docker Compose, HAPI + Postgres; case engine with state machine + ownership/closure invariants + tests; Synthea pipeline + FIT/mammo generators; pathway spec & SLA table signed off by clinical lead; UI skeletons with RTL; register team on Hack2skill | `make demo` boots; API creates/transitions cases; 20+ engine tests green |
| **W2 — Loop works end-to-end** | 31 Oct–6 Nov | SLA timers + escalation queue; referral offer/accept/decline; consult inbox; coordinator worklist (Overdue/Unassigned/Rejected/Stalled); Navigator v1 (templates, 4 languages, teach-back, grader); FHIR Subscription inbound adapter | Demo steps 2–5 runnable manually |
| **W3 — AI, metrics, proof** | 7–13 Nov | Hand-off summariser with trace; risk model + reasons; metrics service + dashboard + `MeasureReport`/CSV export; simulation + impact brief; eval harness + red-team run; audit/consent UI; HL7v2 ORU adapter stub; hosted deployment | Full demo path runnable; eval report draft; first full documentation draft |
| **W4 — Harden & submit** | 14–20 Nov | Feature freeze **17 Nov**; bug bash; Arabic/Urdu/Hindi template review; load test; video recorded **18 Nov**; docs finalised (architecture, ADRs, API, model card, RAI dossier, assumptions, limitations, pilot plan); submit **19 Nov** (24h buffer) | Submission uploaded; sandbox credentials tested from a clean machine |

Daily 15-min standup; demo-driven development (the demo script is the backlog's spine).

---

## 10. Submission package (what "technical documentation" should contain)

1. `README` — 2-min quickstart, demo credentials, video link
2. **Solution overview** — problem, users, journeys, screenshots
3. **Architecture** — diagrams, ADRs (the 8 above), data model (FHIR profiles used), state-machine spec, SLA/escalation rules, API (OpenAPI) + FHIR `CapabilityStatement`
4. **AI & Responsible AI dossier** — model card per AI feature, risk classification, human-oversight map, guardrails, eval + red-team report, language-quality review, DoH Responsible AI Standard & ADHICS mapping table, incident/kill-switch process, data-flow + residency diagram
5. **Impact brief** — simulation method, parameters with citations, results, sensitivity, pilot measurement plan (primary: % positive-FIT closed within 31 days; secondaries per brief §6)
6. **Integration & deployment guide** — Malaffi/EMR/LIS adapter design, HL7v2/FHIR mappings, scheduling integration, infra, security posture, scaling notes, load test
7. **Assumptions** and **Limitations** — explicit lists; see §12
8. **Pilot & commercial plan** — see §11
9. **Test report** — unit/integration/e2e coverage summary

---

## 11. Path to pilot & commercial model (Abu Dhabi-specific)

- **Pilot shape:** one programme (IFHAS colorectal FIT) × one provider network (e.g., a PureHealth/SEHA ambulatory cluster or a private network) × 6 months; LoopClose receives results via Malaffi/LIS feed, runs the loop, and reports IFHAS indicators back. Pre-registered primary outcome: positive-FIT → colonoscopy ≤31 days (baseline vs pilot). Secondary: notification time, acknowledgement rate, referral acceptance, no-show, patient understanding/confidence.
- **Stakeholders:** ADPHC (programme owner), DoH (RAI authorisation, ADHICS), Malaffi (data feed), provider network (clinical owner), Microsoft/Inception/MBZUAI (challenge co-creators — relevant to the "readiness assessment" pathway).
- **Regulatory pathway:** DoH AI authorisation + ADHICS compliance; data processing agreement; in-country hosting; patient consent flows aligned to the ICT Health Law.
- **Pricing:** platform fee per programme per year + per-actionable-case fee (aligns revenue with loops closed, not messages sent); outcome-linked tier (bonus on loop-closure uplift) for public payers. Payer logic: each avoided late-stage CRC costs materially more than the per-case fee — put a cautious, cited range in the brief, not a hero number.
- **Expansion:** breast → cervical → lung (new national screening scope) → non-cancer actionable results (HbA1c, eGFR); cross-emirate via Riayati/NABIDH; licensing to EMR vendors as a FHIR module.

---

## 12. Assumptions & limitations (seed list — keep updating)

**Assumptions**
- Actionable results can be delivered to the platform as FHIR R4 `DiagnosticReport` (or HL7v2 ORU mapped by adapter); Malaffi/LIS feeds exist or can be established for a pilot.
- Programme clinical leads will own and approve the message-template library and SLA table.
- Patients have a reachable mobile channel and consent to messaging; alternative outreach (phone) exists for those who don't.
- Scheduling systems can expose slots or accept booking requests (stubbed in prototype).

**Limitations**
- Synthetic data only; no clinical validation; impact figures are simulation outputs under cited assumptions, not measured outcomes.
- Risk model trained on synthetic data demonstrates the pipeline, not predictive validity.
- LLM output quality in Arabic/Urdu/Hindi reviewed on a template set, not at scale; free-text generation remains gated.
- No live Malaffi/EMR/WhatsApp integration in prototype; adapters are designed and stub-tested.
- Not a medical-device claim; the platform does not interpret results or make clinical decisions.

---

## 13. Risks to the plan & mitigations

| Risk | Mitigation |
|---|---|
| Scope creep (two programmes, four UIs, three AI features) | Demo script = backlog; breast programme is config only; freeze 17 Nov |
| Temporal/HAPI setup eats W1 | Fallback: pg-boss timers; HAPI via official Docker image; spike on day 1 |
| LLM Arabic quality embarrassing in demo | Template-bound messages; native-speaker review; grader; show the gating as a feature |
| Judges can't run it | Hosted sandbox + Docker Compose + video; test from a clean machine |
| "Just another chatbot" perception | Lead with case engine, ownership/closure invariants, cross-org model, standards alignment; AI appears at minute 2, not minute 0 |
| Clinical credibility | Clinician advisor sign-off on pathways/SLAs/templates, named in docs |

---

## 14. What makes this not a hackathon project

- A real **system-of-record design** (event-sourced, FHIR-native, invariants enforced in code and tests), aligned to 360X/BSeR rather than invented.
- **Cross-organisational ownership** modelled explicitly — the actual gap the brief describes.
- **Governance as product**: closure/ownership invariants, consent-driven channels, audit of every AI call, DoH Responsible AI Standard mapping, kill-switches.
- **Evaluation shipped**, including red-team and language review, with honest limitations.
- **Measurement built in** (IFHAS-ready indicators, `MeasureReport`) and a pre-specified pilot outcome.
- **Operational maturity**: one-command boot, CI, observability, hosted sandbox, scripted demo, 24-hour submission buffer.

---

## 15. Immediate next actions (this week)

1. Confirm team of 5 + clinician advisor; register on Hack2skill (closes 10 Nov — do it now).
2. Day-1 spikes: HAPI + Temporal in Compose; Synthea export; Claude adapter hello-world in Arabic.
3. Clinical lead drafts colorectal + breast pathway/SLA tables and the first 12 message templates × 4 languages.
4. Tech lead writes ADR-1..3 and the state-machine test suite before UI work starts.
5. Download the DoH Responsible AI Standard V1 and IFHAS V10 PDFs directly (the RAI link failed automated fetch on a certificate error) and build the mapping-table skeleton.

---

## Sources
- Abu Dhabi CRC screening 2015–16: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8343888/
- IFHAS standard (DoH V10, 2025): https://www.doh.gov.ae/-/media/EE758C3B77314BC394F2479AEF803AA2.ashx · ADPHC IFHAS: https://www.adphc.gov.ae/en/Public-Health-Programs/IFHAS · Results into Malaffi: https://www.doh.gov.ae/en/news/abu-dhabi-public-health-centre-calls-on-thiqa-cardholders-to-benefit-from-the-ifhas-programme
- Nationwide cancer screening direction: https://www.khaleejtimes.com/uae/uae-moves-towards-nationwide-mandatory-early-cancer-screening-says-minister
- DoH Responsible AI Standard V1: https://www.doh.gov.ae/-/media/Feature/Resources/Standards/2025/Responsible-AI-Standard-V1.ashx · UAE AI regulatory landscape: https://www.lw.com/en/insights/ai-in-the-uae-understanding-the-regulatory-landscape-and-key-authorities · ICT Health Law: https://lw.com/thoughtLeadership/lw-new-uae-law-regulates-healthcare-data
- 360X IG: https://oncprojectracking.healthit.gov/wiki/spaces/TechLab360X/pages/18776122/360X+Implementation+Guide · BSeR workflow: http://hl7.org/fhir/us/bser/WorkflowManagementResources.html
- Malaffi/Riayati: https://mohap.gov.ae/en/riayati/about-numr · https://www.wam.ae/en/article/hszrgcsy-uae-health-authorities-announce-successful · https://www.careup.ai/blog/malaffi-nabidh-hie-integration-hms-uae
- Follow-up failure evidence: https://digitalassets.jointcommission.org/api/public/content/77c6421712dc463eae4b2398f9bf01a5 · https://www.ahrq.gov/patient-safety/resources/learning-lab/closed-loop-long-desc.html · https://psnet.ahrq.gov/issue/virtual-breakthrough-series-collaborative-missed-test-results-stepped-wedge-cluster
- LLM patient-communication evidence: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12920046/ · https://pubmed.ncbi.nlm.nih.gov/42546532/ · https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11433331/ · https://clinicaltrials.gov/study/NCT07519811
- Market/EHR trend: https://www.fiercehealthcare.com/ai-and-machine-learning/himss26-epic-expands-ai-roadmap-previews-factory-build-and-orchestrate-ai · https://memorialhermann.org/about-us/newsroom/press-releases/epics-ai-tool-helps-patients-understand-test-results · https://www.kore.ai/blog/ai-agents-in-healthcare-12-real-world-use-cases-2026
- Challenge page: https://hack2skill.com/event/futurehealthchallenge/ · https://www.wam.ae/en/article/c2r7j8n-future-health-launches-global-challenge-move
