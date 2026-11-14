# Multi-stage build for the API. Context = repo root.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/fhir/package.json packages/fhir/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @loopclose/api...

FROM deps AS build
COPY packages ./packages
COPY apps/api ./apps/api
COPY config ./config
RUN pnpm --filter @loopclose/shared build && pnpm --filter @loopclose/fhir build \
 && pnpm --filter @loopclose/api prisma:generate && pnpm --filter @loopclose/api build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @loopclose/api prisma:migrate && node apps/api/dist/main.js"]
