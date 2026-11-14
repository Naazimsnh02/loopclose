# Demo script (7 minutes) — E14.1

Everything below is clickable in the running app. Scenarios are created live from **Demo controls** (`/demo`), not pre-seeded, so the run is the same every time after a reset. Record with captions on; subtitle the Arabic segment.

## Before you record (2 minutes)

1. Sign in as **Platform Admin** → `/demo` → **Reset** (clears pushed patients and chat, puts the clock to real time, restores channels and AI switches).
2. Open a second browser profile (or incognito) signed in as **Mariam (Coordinator)**. Most of the demo runs as Mariam; switch to Admin only for the governance beat.
3. Window at 1600×1000 or larger; browser zoom 100%.

## Run of show

| t | Beat | Who / screen | What to click | What to say |
|---|---|---|---|---|
| 0:00 | **Problem** | Slides | — | In Abu Dhabi only 30.5% of positive-FIT patients completed colonoscopy (2015–16). The loop breaks *between* organisations: lab → programme → primary care → specialist. Nobody owns the gap. |
| 0:40 | **A result arrives** | Mariam → `/demo` | *A new screening result arrives*: Bowel · FIT, **العربية**, Priority · anaemia → **Push result** | It came through the same FHIR `DiagnosticReport` intake a real lab would use. A case opened with a named owner and an SLA clock. |
| 1:00 | **Worklist** | Log → *Open case*, then back to **Worklist** | Point at the new row: owner, SLA chip, tier, risk pill | Every positive result is a case with one accountable person and a deadline, never just a row in a lab system. |
| 1:30 | **Patient told, in Arabic** | Log → *Patient chat* | **Send result & start navigator** | The explanation comes from a clinician-approved template, checked by the safety grader before sending. It ends with a teach-back question. |
| 1:55 | **Teach-back fails, then passes** | Phone mock-up | Quick reply **Unsure** → navigator re-explains → **Correct teach-back** | The navigator never diagnoses. It checks understanding. Right panel: each decision, which words matched, and that it passed the safety check. |
| 2:30 | **Human decides** | Right panel | **Confirm** on *Patient understood the next step* | AI proposes, people decide. Confirming moves the case to *Acknowledged* and hands it to the primary-care clinician with the lightest load. The navigator cannot do that itself. |
| 2:55 | **Safety hand-offs** | Pick an Urdu patient in the list → start → quick reply **Distress** (or **Wants a person**) | — | Distress, emergencies and "I want a person" always go to a human, with the reason and a suggested action. The escalation appears in the panel and the worklist. |
| 3:30 | **Unreachable patient** | `/demo` → push Breast · BI-RADS, اردو, Urgent → **Make channels fail** → log *Patient chat* → **Send result & start navigator** | — | Web chat fails, SMS fallback fails, so a coordinator is told to phone. Urgent tier means urgent escalation. Nothing silently disappears. |
| 4:05 | **Loops that usually break** | `/demo` → **Decline a referral**, then **Simulate a no-show** → *Open case* | Case detail: escalations card, timeline | The clinic has no capacity: the referral comes back to the coordinator to redirect instead of vanishing. A missed appointment keeps the case open and goes back to the scheduler. |
| 4:40 | **Time passes** | `/demo` → **+1 week** | Toast: *N new SLA breaches escalated* → **Worklist** / **Dashboard** | Every overdue step escalates to the owner's lead. This is the loop closing itself. |
| 5:05 | **Closure needs evidence** | Any case at *Confirmatory done* → **Close with evidence** | Show the evidence-type choice, then cancel | A case can only close with evidence (colonoscopy or histology report, care plan) or a documented human decision. Every step is in the audit timeline. |
| 5:30 | **Dashboard** | `/dashboard` | Funnel, stage times, ageing, escalation queue | Programme view of where patients get stuck, per organisation. |
| 5:55 | **Governance** | Admin → `/admin` | *AI controls*: switch **Patient navigator** off (enter reason), then show *Audit trail*, *Programmes & SLAs*, *Content approvals*. Switch it back on. | Each AI feature has a kill switch with a reason, kept in the audit trail. With it off, patient replies go straight to the coordinator. All patient-facing content shows as draft until a clinical lead and native-speaker reviewers sign off. |
| 6:30 | **Deployment** | Slides | — | FHIR R4 / HL7 adapters, Malaffi integration design, DoH Responsible AI mapping, pilot shape. |

## If something goes wrong

- **A step fails mid-take:** `/demo` → **Reset**, then start the run again from 0:40.
- **The navigator doesn't reply:** check `/admin` → the *Patient navigator* switch is on.
- **The hosted site is down:** use the pre-recorded video, or run it locally (`make demo`).

## Not in this demo (be honest if asked)

- The hand-off summariser has an API (`POST /api/ai/summaries/:caseId`) but no screen yet.
- No real WhatsApp/SMS provider; channels are simulated.
- No language model is configured. The navigator and safety grader are rules-based by design. An LLM, if enabled, only adds to the grader's checks.
