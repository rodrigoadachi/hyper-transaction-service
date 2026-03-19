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
# Final image is caddy:alpine serving the Vite SPA static build.
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
# Serve the static Vite build via caddy:alpine — no Node.js needed at runtime.
# Caddy handles SPA routing, gzip, cache headers, and security headers.
# TLS termination is done externally by Traefik (local) or ALB (AWS).
FROM caddy:alpine AS runner

# Copy Caddyfile (SPA routing, cache headers, security headers)
COPY apps/web/Caddyfile /etc/caddy/Caddyfile

# Copy Vite build output to Caddy's default file root
COPY --from=builder /app/apps/web/dist /srv

EXPOSE 80

# Caddy handles signals (SIGTERM/SIGINT) correctly for graceful shutdown
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
