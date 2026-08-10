# Build context MUST be the monorepo root (not this directory) — this app
# depends on npm workspace packages (@suka/auth, @suka/design-system,
# @suka/realtime) that live at packages/*/src and are resolved via npm
# workspace symlinks in the root node_modules.
#
# Runtime uses server.cjs (same entrypoint as the cPanel production deploy)
# instead of `next start` on a `standalone` build — see
# apps/admin-dashboard/next.config.js for why `output: 'standalone'` is
# banned in this repo (it silently disables middleware.ts auth enforcement).

FROM node:24-bookworm-slim

WORKDIR /repo

# --- Layer 1: manifests only, so install is cached unless deps change ---
# package-lock.json is gitignored in this repo (yarn.lock is the tracked
# lockfile) — use yarn, not npm, or Coolify's git-cloned context won't have it.
COPY package.json yarn.lock .npmrc ./
COPY packages/auth/package.json packages/auth/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/realtime/package.json packages/realtime/package.json
COPY apps/admin-dashboard/package.json apps/admin-dashboard/package.json

RUN corepack enable && yarn install --frozen-lockfile --network-timeout 600000

# --- Layer 2: full source ---
COPY packages/auth packages/auth
COPY packages/design-system packages/design-system
COPY packages/realtime packages/realtime
COPY apps/admin-dashboard apps/admin-dashboard

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time —
# they MUST be passed as --build-arg, a runtime-only env var is too late.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ARG SUPABASE_SERVICE_ROLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Throttle the build — Hostinger KVM 2 is only 2 vCPU, and this repo has a
# documented history of OOM/EAGAIN during unthrottled Next builds on
# constrained hosts (see apps/admin-dashboard/package.json "build:cpanel").
ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV NEXT_PRIVATE_MAX_WORKERS=1

WORKDIR /repo/apps/admin-dashboard
RUN yarn build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.cjs"]
