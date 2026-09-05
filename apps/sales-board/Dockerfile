# Multi-stage Dockerfile for Next.js app (@suka/sales-board)
# Pola identik dengan 12 app lain yang di-orchestrate Coolify.

# --- Stage 1: Build ---
FROM node:24-bookworm-slim AS builder
WORKDIR /repo

COPY package.json yarn.lock .npmrc tsconfig.json ./
COPY packages/auth/package.json packages/auth/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/realtime/package.json packages/realtime/package.json
COPY packages/offline-queue/package.json packages/offline-queue/package.json
COPY apps/sales-board/package.json apps/sales-board/package.json

RUN --mount=type=cache,id=yarn-cache-v3,sharing=locked,target=/usr/local/share/.cache/yarn/v6 corepack enable && (yarn install --frozen-lockfile --network-timeout 600000 || (yarn cache clean --all && yarn install --frozen-lockfile --network-timeout 600000))

COPY packages packages
COPY apps/sales-board apps/sales-board

ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL

ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV NEXT_PRIVATE_MAX_WORKERS=1

WORKDIR /repo
RUN NEXT_TURBOPACK=0 corepack enable && NEXT_TURBOPACK=0 yarn workspace @suka/sales-board build && mkdir -p apps/sales-board/public

# --- Stage 2: Runner ---
FROM node:24-bookworm-slim AS runner
WORKDIR /repo/apps/sales-board

ENV NODE_ENV=production
ENV PORT=3000

# WAJIB: stage runner adalah environment BARU -- ARG/ENV stage builder TIDAK ikut.
# Route Handler /api/board membaca kedua var ini saat RUNTIME. Kalau tidak
# di-declare ulang di sini, produksi mati dengan "supabaseKey is required"
# (insiden 2026-08-13, 9 Dockerfile).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG SUPABASE_SERVICE_ROLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

COPY --from=builder /repo/node_modules /repo/node_modules
COPY --from=builder /repo/apps/sales-board/node_module[s] /repo/apps/sales-board/node_modules/
COPY --from=builder /repo/apps/sales-board/package.json ./package.json
COPY --from=builder /repo/apps/sales-board/.next ./.next
COPY --from=builder /repo/apps/sales-board/public ./public

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
