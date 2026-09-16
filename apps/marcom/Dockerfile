# Multi-stage Dockerfile for Next.js app (apps/marcom)
# Built from repository root (context: .) via GitHub Actions

# --- Stage 1: Build Next.js application ---
FROM node:22-slim AS builder

WORKDIR /repo

# Install OpenSSL and ca-certificates for Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install pnpm pinned to exact version
RUN npm install -g pnpm@11.3.0

# Copy package manifests, lockfile, and prisma schema
COPY apps/marcom/package.json apps/marcom/pnpm-lock.yaml* apps/marcom/pnpm-workspace.yaml* ./apps/marcom/
COPY apps/marcom/prisma ./apps/marcom/prisma/

WORKDIR /repo/apps/marcom
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm prisma generate

# Copy source code
WORKDIR /repo
COPY apps/marcom ./apps/marcom

# Build-time environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ARG NEXT_PUBLIC_PORTAL_URL
ARG DATABASE_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Prevent build process from OOM
ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV NEXT_PRIVATE_MAX_WORKERS=1

WORKDIR /repo/apps/marcom
RUN pnpm run build

# --- Stage 2: Ultra-lightweight Production Runner ---
FROM node:22-slim AS runner

WORKDIR /app

# Install runtime dependencies for Prisma & health checks
RUN apt-get update -y && apt-get install -y openssl curl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3999
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Runtime environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ARG NEXT_PUBLIC_PORTAL_URL
ARG DATABASE_URL
ARG CRON_SECRET

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV DATABASE_URL=$DATABASE_URL
ENV CRON_SECRET=$CRON_SECRET

# Copy artifacts from builder
COPY --from=builder /repo/apps/marcom/package.json ./package.json
COPY --from=builder /repo/apps/marcom/node_modules ./node_modules
COPY --from=builder /repo/apps/marcom/prisma ./prisma
COPY --from=builder /repo/apps/marcom/.next ./.next
COPY --from=builder /repo/apps/marcom/public ./public

EXPOSE 3999

CMD ["npx", "next", "start", "-p", "3999"]
