# Build context MUST be the monorepo root (not this directory) — this app
# depends on yarn workspace packages (@suka/auth, @suka/design-system,
# @suka/realtime) that live at packages/*/src.
#
# Unlike admin-dashboard, this app has no custom server.cjs — it runs via
# plain `next start`.

FROM node:24-bookworm-slim

WORKDIR /repo

# --- Layer 1: manifests only, so install is cached unless deps change ---
COPY package.json yarn.lock .npmrc tsconfig.json ./
COPY packages/auth/package.json packages/auth/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/realtime/package.json packages/realtime/package.json
COPY apps/finance/package.json apps/finance/package.json

# "playwright" is a declared dependency but unused in app code (leftover
# e2e tooling) — skip its browser-binary postinstall download, it would
# waste minutes/bandwidth on a 2 vCPU VPS build for nothing.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN corepack enable && yarn install --frozen-lockfile --network-timeout 600000

# --- Layer 2: full source ---
COPY packages/auth packages/auth
COPY packages/design-system packages/design-system
COPY packages/realtime packages/realtime
COPY apps/finance apps/finance

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

# Throttle the build — Hostinger KVM 2 is only 2 vCPU.
ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV NEXT_PRIVATE_MAX_WORKERS=1

WORKDIR /repo/apps/finance
RUN yarn build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["yarn", "next", "start", "-p", "3000"]
