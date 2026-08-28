# Standalone production image for Suka Monitor.
# The build context contains only this app and the shared auth package.

FROM node:24-bookworm-slim AS builder
WORKDIR /repo

COPY package.json yarn.lock .npmrc tsconfig.json ./
COPY packages/auth/package.json packages/auth/package.json
COPY apps/monitoring/package.json apps/monitoring/package.json

RUN corepack enable && yarn install --frozen-lockfile --network-timeout 600000

COPY packages/auth packages/auth
COPY apps/monitoring apps/monitoring

ARG NEXT_PUBLIC_COOKIE_DOMAIN
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL

ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV NEXT_PRIVATE_MAX_WORKERS=1

RUN corepack enable && yarn workspace @suka/monitoring build && mkdir -p apps/monitoring/public

FROM node:24-bookworm-slim AS runner
WORKDIR /repo/apps/monitoring

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /repo/node_modules /repo/node_modules
COPY --from=builder /repo/apps/monitoring/node_modules /repo/apps/monitoring/node_modules
COPY --from=builder /repo/apps/monitoring/package.json ./package.json
COPY --from=builder /repo/apps/monitoring/.next ./.next
COPY --from=builder /repo/apps/monitoring/public ./public

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
