# Multi-stage Dockerfile for Next.js app (@suka/manager)
# Extremely lightweight final image (~180MB) designed for low-disk VPS environments.

# --- Stage 1: Install dependencies ---
FROM node:24-bookworm-slim AS builder
WORKDIR /repo

# Install python/make if needed for some node-gyp packages, though usually not needed for these apps
# RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy manifests for yarn workspaces resolution
COPY package.json yarn.lock .npmrc tsconfig.json ./
COPY packages/auth/package.json packages/auth/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/realtime/package.json packages/realtime/package.json
COPY packages/offline-queue/package.json packages/offline-queue/package.json
COPY apps/manager/package.json apps/manager/package.json

RUN --mount=type=cache,target=/usr/local/share/.cache/yarn/v6 corepack enable && (yarn install --frozen-lockfile --network-timeout 600000 || (yarn cache clean --all && yarn install --frozen-lockfile --network-timeout 600000))

# Copy source code
COPY packages packages
COPY apps/manager apps/manager

# NEXT_PUBLIC_* variables inlined at build time
ARG FIREBASE_SERVICE_ACCOUNT
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG SUPABASE_ACCESS_TOKEN
ARG SUPABASE_PROJECT_ID
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SUPABASE_URL

ENV FIREBASE_SERVICE_ACCOUNT=$FIREBASE_SERVICE_ACCOUNT
ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN
ENV SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV SUPABASE_URL=$SUPABASE_URL

# Prevent build process from OOM on low vCPU hosts
ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV NEXT_PRIVATE_MAX_WORKERS=1

WORKDIR /repo
RUN corepack enable && yarn workspace manager build

# --- Stage 3: Ultra-lightweight Production Runner ---
FROM node:24-bookworm-slim AS runner
WORKDIR /repo

ENV NODE_ENV=production
ENV PORT=3000
# server.js standalone membaca HOSTNAME; tanpa 0.0.0.0 ia bisa bind ke
# localhost saja dan tak terjangkau dari luar container.
ENV HOSTNAME=0.0.0.0

# next.config.ts memakai output:'standalone' — Next sudah men-trace modul yang
# benar-benar dipakai runtime ke .next/standalone (termasuk node_modules-nya
# sendiri). Menyalin /repo/node_modules utuh seperti sebelumnya menggandakannya
# DAN ikut membawa devDependencies (typescript, eslint, @types, tailwind) yang
# nol gunanya saat runtime.
# Layout standalone mengikuti struktur monorepo: server.js ada di apps/manager/.
COPY --from=builder /repo/apps/manager/.next/standalone ./
COPY --from=builder /repo/apps/manager/.next/static ./apps/manager/.next/static
COPY --from=builder /repo/apps/manager/public ./apps/manager/public

EXPOSE 3000

CMD ["node", "apps/manager/server.js"]
