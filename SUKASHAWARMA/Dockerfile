# Multi-stage Dockerfile for SUKASHAWARMA (Astro Static Site)
# Built via GitHub Actions and published to GHCR

# --- Stage 1: Build Astro static application ---
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Copy package manifests for isolated install
COPY SUKASHAWARMA/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY SUKASHAWARMA/ ./

# Build static output to /app/dist
RUN npm run build

# --- Stage 2: Ultra-lightweight Production Web Server ---
FROM nginx:alpine AS runner

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy built site from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy optimized nginx configuration
COPY SUKASHAWARMA/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
