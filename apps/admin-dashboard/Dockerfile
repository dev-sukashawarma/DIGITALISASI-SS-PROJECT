# Multi-stage Dockerfile for Next.js app (@suka/admin-dashboard)
# Extremely lightweight final image (~180MB) designed for low-disk VPS environments.

# --- Stage 1: Build Next.js application ---
FROM node:24-bookworm-slim AS builder
WORKDIR /repo

# Copy manifests for yarn workspaces resolution
COPY package.json yarn.lock .npmrc tsconfig.json ./
COPY packages/auth/package.json packages/auth/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/realtime/package.json packages/realtime/package.json
COPY packages/offline-queue/package.json packages/offline-queue/package.json
COPY apps/admin-dashboard/package.json apps/admin-dashboard/package.json

# Install dependencies (cached by BuildKit)
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn/v6 corepack enable && (yarn install --frozen-lockfile --network-timeout 600000 || (yarn cache clean --all && yarn install --frozen-lockfile --network-timeout 600000))

# Copy source code
COPY packages packages
COPY apps/admin-dashboard apps/admin-dashboard

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

# Build the application
RUN corepack enable && yarn workspace @suka/admin-dashboard build

# --- Stage 2: Ultra-lightweight Production Runner ---
FROM node:24-bookworm-slim AS runner
WORKDIR /repo/apps/admin-dashboard

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /repo/node_modules /repo/node_modules
COPY --from=builder /repo/apps/admin-dashboard/node_modules /repo/apps/admin-dashboard/node_modules/
COPY --from=builder /repo/apps/admin-dashboard/package.json ./package.json
COPY --from=builder /repo/apps/admin-dashboard/.next ./.next
COPY --from=builder /repo/apps/admin-dashboard/public ./public

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
