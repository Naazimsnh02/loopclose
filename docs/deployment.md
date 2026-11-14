# Hosted sandbox deployment

The hosted sandbox has three parts:

| Part | Where | Why |
|---|---|---|
| Web (`apps/web`, Next.js) | **Vercel** | Static and SSR pages only; talks to the API over HTTPS. |
| API (`apps/api`, NestJS) | **Render / Railway / Fly.io** (Docker) | Long-running process: pg-boss workers, SLA and risk cron jobs, in-memory demo clock. Does not fit Vercel serverless functions. Run **one instance**. |
| Postgres 16 | Neon, Supabase, Render or Railway Postgres | Use the **direct** (non-pooled) connection string; pg-boss needs session features that transaction poolers break. |
| HAPI FHIR (optional) | Skip for the sandbox | Only the outbox projector writes to it. Without it the app works fully; projection jobs just retry and log. |

## 1. Database

Create the database, then migrate and seed it **from your machine** (the synthetic population in `analytics/output/` is not in git):

```bash
export DATABASE_URL="postgresql://…direct-connection…"
pnpm --filter @loopclose/api prisma:migrate
pnpm --filter @loopclose/api seed
pnpm --filter @loopclose/api seed:synthetic   # needs analytics/output/*.ndjson locally
```

## 2. API (Render example)

New **Web Service** → this repo → **Docker**, Dockerfile path `apps/api/Dockerfile`, Docker context = repo root. Health check path `/health`.

| Variable | Value |
|---|---|
| `DATABASE_URL` | the direct connection string |
| `JWT_SECRET` | a long random string |
| `CORS_ORIGIN` | `https://<your-vercel-domain>` |
| `DEMO_MODE` | `true` (persona login, draft templates) |
| `DEMO_SANDBOX` | `true` (demo controls in a production build; synthetic data only) |
| `FHIR_BASE_URL` | leave unset, or your HAPI URL |
| `ANTHROPIC_API_KEY` | leave empty (navigator and grader are rules-based) |

The container runs `prisma migrate deploy` on start. `PORT` is read automatically.

## 3. Web (Vercel)

Import the repo → **Root Directory** `apps/web` (framework auto-detected as Next.js, pnpm from the lockfile).

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-api-host>` (no trailing slash, no `/api`) |

Redeploy the web app whenever the API URL changes; `NEXT_PUBLIC_*` is baked in at build time.

## 4. Smoke test

1. Open the Vercel URL → persona list loads (proves CORS + `DEMO_MODE`).
2. Sign in as Mariam → worklist shows ~80 cases.
3. `/demo` → **Push result** → appears in the worklist (proves demo controls + intake).
4. `/patient` → send result → teach-back reply (proves navigator).

Free tiers sleep when idle; open the API URL a minute before a live demo.
