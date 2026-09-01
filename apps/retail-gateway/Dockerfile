# apps/retail-gateway/Dockerfile
FROM node:24-bookworm-slim AS builder
WORKDIR /app

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SUPABASE_JWT_SECRET
ARG GOOGLE_ANDROID_CLIENT_ID
ARG XENDIT_SECRET_KEY
ARG XENDIT_WEBHOOK_TOKEN
ARG CRON_SECRET
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY package.json yarn.lock ./
COPY packages ./packages
COPY apps/retail-gateway/package.json ./apps/retail-gateway/package.json
RUN --mount=type=cache,id=yarn-cache-v3,sharing=locked,target=/usr/local/share/.cache/yarn/v6 \
    yarn install --frozen-lockfile --ignore-engines

COPY . .
RUN NEXT_TURBOPACK=0 yarn workspace @suka/retail-gateway build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# WAJIB di-declare ULANG di stage ini. Docker tidak membawa ARG/ENV
# lintas stage; tanpa blok ini seluruh secret jadi undefined di runtime.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SUPABASE_JWT_SECRET
ARG GOOGLE_ANDROID_CLIENT_ID
ARG XENDIT_SECRET_KEY
ARG XENDIT_WEBHOOK_TOKEN
ARG CRON_SECRET
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
    SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET \
    GOOGLE_ANDROID_CLIENT_ID=$GOOGLE_ANDROID_CLIENT_ID \
    XENDIT_SECRET_KEY=$XENDIT_SECRET_KEY \
    XENDIT_WEBHOOK_TOKEN=$XENDIT_WEBHOOK_TOKEN \
    CRON_SECRET=$CRON_SECRET

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/retail-gateway/.next ./apps/retail-gateway/.next
COPY --from=builder /app/apps/retail-gateway/public ./apps/retail-gateway/public
COPY --from=builder /app/apps/retail-gateway/package.json ./apps/retail-gateway/package.json

WORKDIR /app/apps/retail-gateway
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
