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

# Install all dependencies WITH lifecycle scripts
# pnpm 11 respects "pnpm.onlyBuiltDependencies" in package.json (already contains prisma & friends)
# This ensures Prisma engine binaries (.so.node) are downloaded properly for Linux
RUN pnpm install --frozen-lockfile

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
FROM node:22-slim AS runner

WORKDIR /app

# Install runtime dependencies
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

CMD ["node", "node_modules/.bin/next", "start", "-p", "3999"]
