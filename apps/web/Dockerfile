# =============================================================================
# Hyper Finance — Web Dockerfile
# Build context: monorepo/ (run from repo root)
#   docker build -f apps/web/Dockerfile . -t hyper-web
#
# IMPORTANT:
#   This Dockerfile depends on workspace packages and Turbo metadata that exist
#   only at the monorepo root. It will fail if the Docker build context is set
#   to apps/web only (for example, an EasyPanel build path of /apps/web).
#
# Uses Turborepo prune --docker to isolate '@hyper/web' + its local deps (@hyper/ui,
# @hyper/typescript-config, etc.) and maximise Docker layer caching.
# Final image is node:24-alpine serving the Vite SPA static build.
# Traefik (docker-compose / AWS ALB) provides TLS termination externally.
# =============================================================================

# ─── Stage 1: base ───────────────────────────────────────────────────────────
FROM node:24-alpine AS base

RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && npm install -g turbo --prefer-online

WORKDIR /app

# ─── Stage 2: pruner ─────────────────────────────────────────────────────────
# Trim the monorepo to the '@hyper/web' scope — includes @hyper/ui, @hyper/ui deps, etc.
FROM base AS pruner

COPY . .
RUN turbo prune @hyper/web --docker

# ─── Stage 3: installer ──────────────────────────────────────────────────────
# Install dependencies from the pruned package.json tree only.
# Layer is cached until package.json / pnpm-lock.yaml changes.
FROM base AS installer

COPY --from=pruner /app/out/json .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

# ─── Stage 4: builder ────────────────────────────────────────────────────────
# Build the React SPA with Vite.
# turbo run build --filter=@hyper/web also builds @hyper/ui first (dependsOn: ["^build"])
FROM base AS builder

COPY --from=installer /app .
COPY --from=pruner /app/out/full .

# Build web (and @hyper/ui as a dependency, respecting turbo pipeline)
RUN turbo run build --filter=@hyper/web

# ─── Stage 5: runner ─────────────────────────────────────────────────────────
# Serve the static Vite build via a tiny Node.js server to avoid an extra
# runtime image dependency during EasyPanel deploys.
FROM node:24-alpine AS runner

ENV NODE_ENV=production
ENV WEB_PORT=3000

WORKDIR /app

# Copy static build output and the lightweight runtime server
COPY --from=builder /app/apps/web/dist ./dist
COPY apps/web/server.mjs ./server.mjs

EXPOSE 3000

CMD ["node", "server.mjs"]
