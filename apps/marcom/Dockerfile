# Stage 1: Dependencies & Build
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL and ca-certificates for Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install pnpm 11 (same major version as local dev environment)
RUN npm install -g pnpm@11

# Copy package definitions, lockfile, and Prisma schema before install
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install all dependencies but skip all lifecycle scripts to avoid ERR_PNPM_IGNORED_BUILDS
RUN pnpm install --frozen-lockfile --ignore-scripts

# Manually run prisma generate (needed before build)
RUN pnpm prisma generate

# Copy the rest of the application source code
COPY . .

# Set build environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=true

# Build Next.js application
RUN pnpm run build

# ---------------------------------------------------------------
# Stage 2: Production Runner
# ---------------------------------------------------------------
FROM node:20-slim AS runner

WORKDIR /app

# Install runtime dependencies (OpenSSL for Prisma)
RUN apt-get update -y && apt-get install -y openssl curl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3999
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=true

# Copy necessary artifacts from builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 3999

# Start Next.js server (npm works fine here, no pnpm needed at runtime)
CMD ["node", "node_modules/.bin/next", "start", "-p", "3999"]
