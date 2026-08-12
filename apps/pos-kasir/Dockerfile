# Multi-stage Dockerfile for Next.js app (@suka/pos-kasir)
# Extremely lightweight final image (~180MB) designed for low-disk VPS environments.

# --- Stage 1: Install dependencies ---
FROM node:24-bookworm-slim AS deps
WORKDIR /repo

# Install python/make if needed for some node-gyp packages, though usually not needed for these apps
# RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy manifests for yarn workspaces resolution
COPY package.json yarn.lock .npmrc tsconfig.json ./
COPY packages/auth/package.json packages/auth/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/realtime/package.json packages/realtime/package.json
COPY packages/offline-queue/package.json packages/offline-queue/package.json
COPY apps/pos-kasir/package.json apps/pos-kasir/package.json

RUN corepack enable && yarn install --frozen-lockfile --network-timeout 600000

# --- Stage 2: Build Next.js application ---
FROM node:24-bookworm-slim AS builder
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
# Safely copy local node_modules if it exists (for unhoisted packages like next.js)
COPY --from=deps /repo/apps/pos-kasir/node_module[s] ./apps/pos-kasir/node_modules/
COPY package.json yarn.lock .npmrc tsconfig.json ./
COPY packages packages
COPY apps/pos-kasir apps/pos-kasir

# NEXT_PUBLIC_* variables inlined at build time
ARG KASIR_TO_ORDER_SECRET
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SS_ORDER_ANON_KEY
ARG NEXT_PUBLIC_SS_ORDER_URL
ARG NEXT_PUBLIC_STOK_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG ORDER_SYSTEM_NOTIFY_URL
ARG ORDER_TO_KASIR_SECRET
ARG SUPABASE_ACCESS_TOKEN
ARG SUPABASE_PROJECT_ID
ARG SUPABASE_SERVICE_ROLE_KEY

ENV KASIR_TO_ORDER_SECRET=$KASIR_TO_ORDER_SECRET
ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SS_ORDER_ANON_KEY=$NEXT_PUBLIC_SS_ORDER_ANON_KEY
ENV NEXT_PUBLIC_SS_ORDER_URL=$NEXT_PUBLIC_SS_ORDER_URL
ENV NEXT_PUBLIC_STOK_URL=$NEXT_PUBLIC_STOK_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV ORDER_SYSTEM_NOTIFY_URL=$ORDER_SYSTEM_NOTIFY_URL
ENV ORDER_TO_KASIR_SECRET=$ORDER_TO_KASIR_SECRET
ENV SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN
ENV SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Prevent build process from OOM on low vCPU hosts
ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV NEXT_PRIVATE_MAX_WORKERS=1

WORKDIR /repo
RUN corepack enable && yarn workspace shawarma-kiosk build

# --- Stage 3: Ultra-lightweight Production Runner ---
FROM node:24-bookworm-slim AS runner
WORKDIR /repo/apps/pos-kasir

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /repo/node_modules /repo/node_modules
COPY --from=builder /repo/apps/pos-kasir/node_module[s] /repo/apps/pos-kasir/node_modules/
COPY --from=builder /repo/apps/pos-kasir/package.json ./package.json
COPY --from=builder /repo/apps/pos-kasir/.next ./.next
COPY --from=builder /repo/apps/pos-kasir/public ./public

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
