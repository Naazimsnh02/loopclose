# LoopClose — Closing the Screening-to-Care Loop

Prototype for the **Future Health Digital Innovation Challenge** (Abu Dhabi) · Population Health · Challenge 05.
Every actionable screening result becomes a **case** with an accountable owner at every hand-off, SLA clocks, human-governed escalation and evidence-gated closure — across labs, primary care, specialists and hospitals. AI is bounded: it proposes, humans decide.

> Synthetic data only. Not a medical device. See `docs/assumptions.md` and `docs/limitations.md`.

## Quickstart

```bash
pnpm install
cp .env.example .env            # add ANTHROPIC_API_KEY to enable AI features (optional; degrades gracefully)
pnpm infra:up                   # Postgres + HAPI FHIR + MailHog (HAPI takes ~60–90 s first time)
pnpm --filter @loopclose/api prisma:generate
pnpm --filter @loopclose/api prisma:migrate:dev --name init
pnpm db:seed                    # orgs, role users, AI feature flags
pnpm dev                        # api :4000 (docs at /api/docs), web :3000
```

Synthetic population, simulation and risk model (Python ≥ 3.11):

```bash
cd analytics && python -m venv .venv && . .venv/Scripts/activate && pip install -e ".[dev]"
lc-analytics synthetic && lc-analytics simulate && lc-analytics train-risk
```

## Repository map

| Path | What |
|---|---|
| `packages/shared` | Domain types, programme config schema (zod), **case state machine** + SLA calculator — pure TS, 37 tests |
| `packages/fhir` | FHIR R4 builders (Task/ServiceRequest per 360X/BSeR, Communication, Provenance, AuditEvent) + HAPI client |
| `apps/api` | NestJS: cases, SLA timers (pg-boss), escalations, referrals, consults, messaging + templates, bounded AI (navigator, summariser, risk, safety grader), metrics, audit, intake adapters, admin, demo controls; Prisma schema |
| `apps/web` | Next.js 15 (RTL-ready): coordinator worklist, case detail, clinician inbox, scheduler, patient chat, dashboard, admin, demo |
| `analytics` | Python: synthetic data, impact simulation, risk-model training (JSON export), AI eval harness |
| `config/programmes` | Colorectal FIT and breast BI-RADS pathways: states, owners, SLAs, urgency rules, closure evidence, AI policy |
| `config/templates` | Patient message templates (ar/en/ur/hi) with approval metadata and guardrails |
| `config/escalation-rules.yaml` | Escalation rules |
| `infra` | HAPI and Postgres config |
| `docs` | Architecture, ADRs, demo script, metrics definitions, integration guide, Responsible AI dossier, assumptions, limitations |

## Key design guarantees (enforced in code and tests)

- A non-terminal case **always has an owner** with the role the state requires.
- A case **closes only** with programme-valid evidence or a documented human decision.
- **AI actors can never** close, exit, or assign owners; they may enter only `patient_acknowledged` (teach-back pass) where programme policy allows.
- Every patient message is **template-bound** and passes a **safety grader** (fails closed).
- Every AI call is **audited** (prompt hash, model, tokens, outcome) and **kill-switchable**.

## Verify the loop locally

```bash
curl http://localhost:4000/health                                  # db + programmes loaded
curl -X POST http://localhost:4000/fhir/DiagnosticReport -H 'content-type: application/json' --data @scripts/sample-fit-positive.json
curl -X POST http://localhost:4000/api/auth/demo-login -H 'content-type: application/json' -d '{"email":"coordinator@demo.loopclose"}'
curl http://localhost:8080/fhir/Task?code=screening-case          # projected case Tasks in HAPI
```

Troubleshooting: HAPI needs 30–90 s on first boot; the HAPI image's Flyway is disabled in `infra/hapi/application.yaml` on purpose (it rejects Postgres 15/16). Docker Desktop must be running before `pnpm infra:up`.

## Scripts

`pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm build` · `pnpm infra:down` · `pnpm infra:reset`

## Timeline

Registration closes 10 Nov 2026 · prototype + docs due 20 Nov 2026 · evaluation 20–30 Nov · GITEX awards 7–11 Dec.
