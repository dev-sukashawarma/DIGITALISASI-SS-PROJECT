# Multi-stage Dockerfile for Next.js app (@suka/stok)
# Built from the monorepo root so shared @suka packages resolve correctly.

# --- Stage 1: Install dependencies & build ---
FROM node:24-bookworm-slim AS builder
WORKDIR /repo

# Copy manifests for yarn workspaces resolution
COPY package.json yarn.lock .npmrc* tsconfig.json ./
COPY packages/auth/package.json packages/auth/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/realtime/package.json packages/realtime/package.json
COPY packages/offline-queue/package.json packages/offline-queue/package.json
COPY apps/stok/package.json apps/stok/package.json

RUN --mount=type=cache,id=yarn-cache-v3,sharing=locked,target=/usr/local/share/.cache/yarn/v6 corepack enable && (yarn install --frozen-lockfile --network-timeout 600000 || (yarn cache clean --all && yarn install --frozen-lockfile --network-timeout 600000))

# Copy source code
COPY packages packages
COPY apps/stok apps/stok

# NEXT_PUBLIC_* variables inlined at build time
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG SUPABASE_SERVICE_ROLE_KEY

ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Prevent build process from OOM on low vCPU hosts
ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV NEXT_PRIVATE_MAX_WORKERS=1

WORKDIR /repo
RUN NEXT_TURBOPACK=0 corepack enable && NEXT_TURBOPACK=0 yarn workspace @suka/stok build

# --- Stage 2: Ultra-lightweight Production Runner ---
FROM node:24-bookworm-slim AS runner
WORKDIR /repo/apps/stok

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Keep runtime environment explicit for middleware and server rendering
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG SUPABASE_SERVICE_ROLE_KEY

ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

COPY --from=builder /repo/node_modules /repo/node_modules
COPY --from=builder /repo/apps/stok/node_module[s] /repo/apps/stok/node_modules/
COPY --from=builder /repo/apps/stok/package.json ./package.json
COPY --from=builder /repo/apps/stok/.next ./.next
COPY --from=builder /repo/apps/stok/public ./public

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
