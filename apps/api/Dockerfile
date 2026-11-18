# Multi-stage build for the API. Context = repo root.
FROM node:22-alpine AS base
# Prisma's query engine needs OpenSSL, which the alpine image does not ship.
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@11.11.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/fhir/package.json packages/fhir/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @loopclose/api...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY config ./config
RUN pnpm --filter @loopclose/shared build && pnpm --filter @loopclose/fhir build \
 && pnpm --filter @loopclose/api prisma:generate && pnpm --filter @loopclose/api build

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
# Risk model coefficients (synthetic-trained); the service falls back to rules if absent.
COPY analytics/output/risk_model.json ./analytics/output/risk_model.json
# Config paths resolve relative to apps/api (../../config, ../../analytics).
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
