# Pre-existing IP and third-party materials

## Ownership
- All LoopClose source code, configuration (programme state machines, SLA tables, escalation rules, message templates), the synthetic data generator and its outputs, the simulation model and the documentation were written by Syed Naazim Hussain for this challenge. Development started on 24 Oct 2026. No pre-existing proprietary IP of any employer or third party is incorporated.
- No component carries a licence that restricts commercial use or forces the LoopClose code itself to be released (no GPL/AGPL in the shipped dependency tree).

## Runtime services (Docker images, unmodified)
| Component | Version | Licence |
|---|---|---|
| HAPI FHIR JPA server | 8.0.0 | Apache-2.0 |
| PostgreSQL | 16 (alpine) | PostgreSQL Licence (permissive) |
| MailHog (dev email sink, demo only) | 1.0.1 | MIT |

## Direct application dependencies (from installed `package.json` licence fields, 14 Nov 2026)
| Area | Packages | Licence |
|---|---|---|
| API framework | @nestjs/common, core, config, jwt, platform-express, swagger · nestjs-pino · pino · pino-http · helmet · class-validator · class-transformer | MIT |
| Data & jobs | @prisma/client 6 · reflect-metadata · rxjs | Apache-2.0 |
| | pg-boss 10 · zod · yaml | MIT / MIT / ISC |
| Web | next 15 · react 19 · react-dom · @radix-ui/* · motion · sonner · clsx · tailwind-merge · date-fns | MIT |
| | class-variance-authority | Apache-2.0 |
| | lucide-react (icons) | ISC |
| AI | @anthropic-ai/sdk | MIT (SDK). API use is governed by Anthropic's commercial terms |
| Analytics (Python) | numpy, pandas, scikit-learn | BSD-3-Clause |
| | simpy, pydantic, typer, pyyaml | MIT |

Full transitive production tree (`pnpm licenses list --prod`): 238 MIT, 18 Apache-2.0, 12 ISC, 5 BSD-3-Clause, 2 BSD-2-Clause, 1 0BSD, 1 Python-2.0 (argparse), 1 MIT OR CC0-1.0, 1 CC-BY-4.0 (caniuse-lite browser data, attribution kept in package) and 1 Apache-2.0 AND LGPL-3.0-or-later (libvips binary bundled with `sharp`, used by Next.js image optimisation; dynamically linked and unmodified, which LGPL permits).

## Content, standards and terminologies
| Material | Owner | Use | Terms |
|---|---|---|---|
| LOINC codes 29771-3, 72137-3 | Regenstrief Institute | Code identifiers for FIT and BI-RADS results | LOINC licence (free, attribution) |
| BI-RADS assessment categories | American College of Radiology | Category numbers (4, 5) only; no atlas content reproduced | Referenced, not copied |
| HL7 FHIR R4, IHE 360X, HL7 BSeR | HL7 International / IHE | Implemented against public specifications | Open specifications (CC0 / public) |
| DoH Responsible AI Standard V1 (2025) | Department of Health Abu Dhabi | Mapping reference, cited | Public document |
| Published statistics (PMC8343888, Joint Commission, AHRQ) | respective authors | Simulation parameters, cited | Aggregate figures with citation |
| Submission template | Future Health / Hack2skill | Used as provided | © organisers |

## Restrictions
- No real patient data is used. A pilot requires DoH authorisation, a data processing agreement and in-country hosting.
- The Anthropic API (or any other LLM provider) must not receive PHI without a DoH-approved processing agreement. Until then the adapter can run in template-only mode.
