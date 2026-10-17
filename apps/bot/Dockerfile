# syntax=docker/dockerfile:1
# Build from the repository root. Runtime secrets are injected by Coolify.
FROM node:24-bookworm-slim AS builder
WORKDIR /repo

ENV NEXT_TELEMETRY_DISABLED=1
ENV RAYON_NUM_THREADS=1

# Keep dependency installation cached across application source changes.
COPY package.json yarn.lock .npmrc tsconfig.json ./
COPY packages/auth/package.json packages/auth/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY apps/bot/package.json apps/bot/package.json

RUN --mount=type=cache,id=suka-bot-yarn-v1,sharing=locked,target=/usr/local/share/.cache/yarn/v6 \
    corepack enable && yarn install --frozen-lockfile --network-timeout 600000

# Only these shared packages are imported by Bot.
COPY packages/auth packages/auth
COPY packages/design-system packages/design-system
COPY apps/bot apps/bot

# Only public values are needed at build time. Supabase service-role, Hermes,
# and Telegram secrets must be configured as runtime variables in Coolify.
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL

# Preserve Webpack and TypeScript caches between builds of this application.
RUN --mount=type=cache,id=suka-bot-next-webpack-v1,sharing=locked,target=/repo/apps/bot/.next/cache \
    yarn workspace @suka/bot build && mkdir -p apps/bot/public

FROM node:24-bookworm-slim AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Tracing preserves the monorepo layout, including the two shared packages.
# Build caches, dev dependencies, and unrelated workspaces stay in the builder.
COPY --from=builder --chown=node:node /repo/apps/bot/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/bot/.next/static ./apps/bot/.next/static
COPY --from=builder --chown=node:node /repo/apps/bot/public ./apps/bot/public

USER node
EXPOSE 3000
CMD ["node", "apps/bot/server.js"]
