# Project Brief: Closing the Screening-to-Care Loop

**Event:** Future Health Digital Innovation Challenge (Future Health – A Global Initiative by Abu Dhabi, run on Hack2skill)
**Challenge:** Population Health · Challenge 05
**Source:** https://hack2skill.com/event/futurehealthchallenge/

## Key dates
- Registration closes: **10 Nov 2026**
- Working prototype + technical documentation, assumptions and limitations due: **20 Nov 2026**
- Expert panel evaluation: 20–30 Nov 2026
- Top 3 present and receive awards at GITEX: 7–11 Dec 2026
- Prizes (top 3 across all 10 challenges): USD 50k / 35k / 20k, plus a possible readiness assessment and a pathway beyond the challenge
- Teams: individuals or up to 5 people

## Problem statement
How can low-friction approaches make sure every actionable screening result leads to:
timely communication → quick patient-to-clinician or clinician-to-clinician consultation → confirmation and follow-up → a clear owner → a completed referral → documented closure, across providers and care settings?

## Why it matters (pain points from the brief)
- The care journey crosses labs, screening programs, primary care, specialists, hospitals and patient-facing channels.
- Results are communicated inconsistently, and consultation between patients and clinicians, or between clinicians, is hard to access quickly.
- Referrals often don't turn into booked appointments, and patients move between providers.
- Who owns the next step is unclear, especially when a case moves between organizations.
- Data on ownership, referral status, patient acknowledgement, consultation outcome, escalation and closure evidence is scattered or missing.
- A result can be recorded with no clear view of whether care actually happened, where it stalled, or who is still accountable.
- Patients face avoidable anxiety and a confusing system. Diagnosis and treatment are delayed, and the benefit of early detection is lost.

## Objective
Make sure every actionable screening result is communicated, confirmed and turned into timely care, with effective consultation and referral pathways, a clear owner and documented closure at each step.

## Required capabilities (the solution should...)
1. **End-to-end case visibility.** Track each actionable result through every stage: issued → patient notified → acknowledged → confirmatory test → referral → appointment → treatment or surveillance → documented closure.
2. **Clear ownership and timely progression.** Keep an accountable owner at every hand-off, support agreed service levels (SLAs), and surface overdue, rejected or unassigned cases.
3. **Patient-centered communication and reassurance.** Explain results, urgency and next steps clearly, in culturally and linguistically appropriate language, through suitable channels. Confirm the patient understood, and help them feel safely guided.
4. **Cross-provider consultation and coordination.** Support quick patient-to-clinician and clinician-to-clinician consultation, coordinated referral hand-offs, referral acceptance, continuity of information and consistent follow-up.
5. **Safe, human-governed escalation.** Get clinically urgent or unusual cases to qualified staff quickly. A case closes only when the required evidence, or an authorized human decision, is documented.
6. **Closure and patient-impact measures.** Show improvement in one or more of these: time to notification, confirmation, consultation and care; referral and appointment completion; treatment start; number of unresolved actionable results; reasons for delay or drop-off; documented closure; patient understanding, reassurance and confidence.

## Judging criteria
"Impact first. Then proof that it works."
1. Health impact and clinical relevance
2. Technical depth and architecture
3. Working solution and demonstration quality
4. Responsible AI, safety and data governance
5. Scalability and deployment readiness
6. Commercial viability and path to pilot

## Submission must include
- A working prototype
- Technical documentation
- Assumptions
- Limitations

## Suggested build direction (our notes, not part of the brief)
- **Core:** a closed-loop case tracker. Model each screening result as a case with stages (a state machine), an owner, SLA timers, an escalation queue and closure evidence.
- **Data:** synthetic patients and results (e.g. from Synthea, an open-source synthetic patient generator, in FHIR R4, the standard health-data exchange format, using its ServiceRequest, Task, Communication, Appointment and DiagnosticReport records). Pick 1–2 screening programs to demo, such as diabetes/HbA1c, colorectal FIT, cervical or breast cancer.
- **AI ideas (with a human always deciding):**
  - A patient agent that explains results in Arabic, English, Urdu or Hindi, checks understanding with a teach-back question, books appointments and spots patients who stop responding.
  - A drop-off risk score that escalates likely stalls before they become overdue.
  - Auto-generated summaries for clinician-to-clinician hand-offs and referrals.
- **Views:** a coordinator worklist (overdue, unassigned, rejected), a clinician consult inbox, a patient-facing app or WhatsApp-style chat, and a metrics dashboard.
- **Impact demo:** simulate a "before" baseline against the "after" flow, comparing time to care, open results and drop-off reasons.
- **Responsible AI:** audit log, role-based access, consent records, a rule that the AI can never close a case on its own, and documented limitations.
- **Deployment story:** FHIR-based integration with Abu Dhabi's health information exchange (Malaffi) and EMR systems, a pilot with one screening program at one provider network, and a per-case or per-program pricing model.
