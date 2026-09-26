# Stage 1: Dependencies & Build
FROM node:22-slim AS builder

WORKDIR /app

# Install OpenSSL and ca-certificates for Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install pnpm pinned to exact same version as local dev
RUN npm install -g pnpm@11.3.0

# Copy package definitions, lockfile, and Prisma schema before install
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies, skip lifecycle scripts to avoid ERR_PNPM_IGNORED_BUILDS
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --no-frozen-lockfile --ignore-scripts

# Explicitly generate Prisma client and download Linux engine binary
RUN pnpm prisma generate

# Copy the rest of the application source code
COPY . .

# Build-time environment variables
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Set build environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=true

# Build Next.js application
RUN pnpm run build

# ---------------------------------------------------------------
# Stage 2: Production Runner
# ---------------------------------------------------------------
FROM node:22-slim AS runner

WORKDIR /app

# Install runtime dependencies
RUN apt-get update -y && apt-get install -y openssl curl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3999
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=true

# Secret server-only WAJIB di stage runner: Docker tak membawa ARG/ENV lintas
# stage, dan Server Action membacanya di RUNTIME (lihat CLAUDE.md "Gotcha
# kritikal #1"). Tanpa ini marcom dulu jalan hanya berkat kunci literal di
# src/lib/supabase-pos.ts -- yang membocorkan service role key ke repo publik.
ARG SUPABASE_SERVICE_ROLE_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Copy necessary artifacts from builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 3999

CMD ["sh", "-c", "npx prisma migrate deploy; npx next start -p 3999"]
