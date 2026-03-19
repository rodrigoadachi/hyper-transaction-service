# =============================================================================
# Hyper Finance — API Dockerfile
# Build context: monorepo/ (run from repo root)
#   docker build -f monorepo/apps/api/Dockerfile monorepo/ -t hyper-api
#
# Uses Turborepo prune (--docker flag) to:
#   1. isolate exactly the workspace packages needed by 'api'
#   2. maximise Docker layer cache — deps layer built before source layer
# =============================================================================

# ─── Stage 1: base ───────────────────────────────────────────────────────────
# Shared base for all stages: Node 24 Alpine + pnpm via corepack
FROM node:24-alpine AS base

# libc6-compat: needed for some native binary packages on musl (Alpine)
RUN apk add --no-cache libc6-compat \
  && corepack enable \
  # Install turbo globally so all derived stages can run `turbo prune / build`
  && npm install -g turbo --prefer-online

WORKDIR /app

# ─── Stage 2: pruner ─────────────────────────────────────────────────────────
# Prune the monorepo to include ONLY what 'api' needs.
# Output:
#   out/json/   — package.json files only (no source)  → used in installer
#   out/full/   — full workspace trimmed to api scope  → used in builder
#   out/pnpm-lock.yaml — pruned lockfile
FROM base AS pruner

COPY . .
RUN turbo prune api --docker

# ─── Stage 3: installer ──────────────────────────────────────────────────────
# Install dependencies using ONLY the package.json tree (no source).
# This is a separate stage so Docker caches this layer — it only re-runs
# when package.json or the lockfile changes, not when source changes.
FROM base AS installer

# Copy pruned package.json structure + lockfile
COPY --from=pruner /app/out/json .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

# ─── Stage 4: builder ────────────────────────────────────────────────────────
# Compile TypeScript → dist/
FROM base AS builder

# Start from the installed workspace (node_modules present)
COPY --from=installer /app .

# Overlay with full source files (package.json + src + config)
COPY --from=pruner /app/out/full .

# Build only the api package (nest build → dist/)
RUN pnpm --filter api run build

# ─── Stage 5: runner ─────────────────────────────────────────────────────────
# Minimal production image — preserve pnpm workspace symlink layout so the
# app-level node_modules entries keep resolving into the root .pnpm store.
FROM node:24-alpine AS runner

RUN apk add --no-cache libc6-compat \
  # Non-root user for least-privilege execution
  && addgroup --system --gid 1001 hyper \
  && adduser --system --uid 1001 --ingroup hyper --no-create-home hyper

WORKDIR /app

# Copy the root pnpm store / shared dependencies first.
COPY --from=builder /app/node_modules ./node_modules

# Preserve the package directory structure used by pnpm symlinks.
COPY --from=builder /app/apps/api ./apps/api

USER hyper

EXPOSE 3333

# Health check — ALB also performs external health checks on /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3333/health || exit 1

WORKDIR /app/apps/api

CMD ["node", "dist/main"]
