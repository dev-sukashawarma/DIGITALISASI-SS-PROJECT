# Build context HARUS root repo (bukan apps/admin-dashboard) karena monorepo
# yarn workspace butuh package.json + yarn.lock + packages/* di root.
# Di Coolify: Base Directory = "/" , Dockerfile Location = "apps/admin-dashboard/Dockerfile"

FROM node:24-slim AS base
WORKDIR /repo

# 1) Copy manifest dulu (cache layer install kalau source berubah tapi deps tidak)
COPY package.json yarn.lock ./
COPY packages ./packages
COPY apps/admin-dashboard/package.json ./apps/admin-dashboard/package.json

RUN corepack enable && yarn install --frozen-lockfile --network-timeout 600000

# 2) Copy source lengkap, lalu build khusus admin-dashboard
COPY apps/admin-dashboard ./apps/admin-dashboard

WORKDIR /repo/apps/admin-dashboard

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

RUN yarn build

EXPOSE 3000
CMD ["yarn", "start", "-p", "3000"]
