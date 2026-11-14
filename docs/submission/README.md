# Submission package (E14)

Hack2skill template: `docs/[PUB] Future Health Digital Innovation Challenge _ Submission Template.pptx` (15 slides, 16:9). Starred slides are mandatory. Deadline **20 Nov 2026**; our internal freeze 17 Nov, deck final 18 Nov, submit 19 Nov.

**Built deck:** `LoopClose_Submission_Deck.pptx` (+ `.pdf`), generated from the official template by `build_deck.py` (`python build_deck.py "<template>.pptx" LoopClose_Submission_Deck.pptx`). Edit content in the script and rebuild; don't hand-edit the output.

## Slide → source map

| # | Template slide | Mandatory | Content source in repo | Owner | Status |
|---|---|---|---|---|---|
| 1 | Cover: Team Name / Team Size / Problem Statement | ✱ | Team Name: **Syed Naazim Hussain** · Team Size: 1 · Problem Statement: "Challenge 05 — Population Health: Closing the Screening-to-Care Loop" (product: LoopClose) | SNH | ✅ content ready |
| 2 | Team members table (name, country, role, organization, age confirmation) | ✱ | Syed Naazim Hussain · India · Founder & Developer · Individual · 18+ (33) — see `team-capability.md` | SNH | ✅ content ready |
| 3 | Team capability summary (≤1,000 characters) | ✱ | `team-capability.md` (≈930 chars) | SNH | ✅ draft |
| 4 | Architecture or workflow diagram | ✱ | `docs/architecture.md` diagram (C4 context + container) + state-machine figure; export PNG | SNH | ✅ v1 in deck |
| 5 | Target users and intended outcome | ✱ | `winning-plan.md` §users; brief §3 patient/clinician/coordinator outcomes | SNH | ✅ v1 in deck |
| 6 | How will success be measured? | ✱ | `docs/metrics-definitions.md` + simulation before/after (`analytics/output/impact.json`) | SNH | ✅ v1 in deck |
| 7 | Evidence supporting the approach (citations, benchmarks, prior testing) | ✱ | `winning-plan.md` sources (Abu Dhabi 30.5% completion PMC8343888; Casalino 2009; closed-loop/navigation literature; IHE 360X/BSeR); eval report | SNH | ✅ v1 in deck |
| 8 | Data sources and legal right to use them (source, type, owner, sensitivity, permissions, personal data?) | ✱ | `docs/responsible-ai/datasheet-synthetic.md`: synthetic only, generator in repo (ours), Synthea if used (Apache-2.0), LOINC (free licence), no personal data | SNH | ✅ v1 in deck |
| 9 | Risks and safeguards (privacy, security, bias, explainability, misuse, human oversight, failure modes) | ✱ | `docs/responsible-ai/doh-rai-mapping.md`, `risk-register.md`, ADR-006, `limitations.md` | SNH | ✅ v1 in deck |
| 10 | Hardware requirements | optional | "None — software only; standard cloud compute. No wearables/devices." | — | ✅ v1 in deck |
| 11 | Path to pilot and scale (stakeholders, integration, regulatory, timeline, sustainability) | ✱ | `winning-plan.md` pilot/commercial section; `docs/integration-guide.md`; DoH RAI/ADHICS posture; pricing | SNH | ✅ v1 in deck |
| 12 | Pre-existing IP and third-party materials (ownership, licences, OSS, restrictions) | ✱ | `third-party.md` — generated from `pnpm licenses list` + pip; HAPI FHIR (Apache-2.0), Postgres (PostgreSQL licence), NestJS/Next/Prisma (MIT/Apache), pptx template © organiser; LOINC terms; Anthropic API ToS; our code ownership statement | SNH | ✅ v1 in deck |
| 13 | Conflict of interest declaration | ✱ | Each member declares relationships with organisers (Hack2skill, DoH, M42, partners, judges) — default "None" | SNH | ✅ v1 in deck |
| 14 | Additional slide | optional | Demo QR/link + video link + repo link + "AI proposes, humans decide" guarantees | SNH | ✅ v1 in deck |
| 15 | Closing (template graphic) | — | leave as is | — | ☐ |

## Other deliverables listed by the challenge
- Working prototype (hosted URL + `docker compose` bundle) — E14.3
- Technical documentation — `docs/` export to PDF (architecture, integration guide, metrics, RAI dossier, ADRs)
- Assumptions — `docs/assumptions.md` · Limitations — `docs/limitations.md`
- Demo video (≤7 min) — `docs/demo-script.md`

## Process notes
- Fill the template in place (keep organiser layouts/branding); use `python <pptx-skill>/scripts/slide_text.py` to check for leftover placeholder text before upload.
- Slide 3 has a hard 1,000-character cap — verify with `wc -m`.
- Slide 2 "age confirmation" suggests an 18+ eligibility rule — confirm in Hack2skill T&Cs and have every member confirm in writing.
