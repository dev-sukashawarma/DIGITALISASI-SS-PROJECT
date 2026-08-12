const fs = require('fs');
const path = require('path');

const appsDir = path.join(__dirname, '../apps');
const apps = fs.readdirSync(appsDir).filter(f => fs.statSync(path.join(appsDir, f)).isDirectory() && f !== 'graphify-out');

const getEnvs = (appPath) => {
  const envFiles = ['.env', '.env.local', '.env.example'];
  let envs = [];
  for (const ef of envFiles) {
    const efp = path.join(appPath, ef);
    if (fs.existsSync(efp)) {
      const content = fs.readFileSync(efp, 'utf8');
      const vars = content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => l.split('=')[0]);
      envs.push(...vars);
    }
  }
  envs = [...new Set(envs)];
  
  // Always ensure these standard Supabase / routing vars exist if not found, since they are commonly needed
  const standardVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_PORTAL_URL',
    'NEXT_PUBLIC_COOKIE_DOMAIN',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  for (const v of standardVars) {
    if (!envs.includes(v)) envs.push(v);
  }
  
  return envs.sort();
};

for (const app of apps) {
  const appPath = path.join(appsDir, app);
  
  // Skip non-Next.js apps if any (manager is next, pos-kasir is next, all seem next)
  const pkgPath = path.join(appPath, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const isNext = pkg.dependencies && pkg.dependencies.next;
  if (!isNext) {
     console.log(`Skipping ${app} (not Next.js)`);
     continue;
  }
  const packageName = pkg.name;

  const envs = getEnvs(appPath);
  
  const argsBlock = envs.map(e => `ARG ${e}`).join('\n');
  const envsBlock = envs.map(e => `ENV ${e}=$${e}`).join('\n');
  
  // Use node_modules/.bin/next for the runner to avoid relying on global or script aliases
  const dockerfileContent = `# Multi-stage Dockerfile for Next.js app (@suka/${app})
# Extremely lightweight final image (~180MB) designed for low-disk VPS environments.

# --- Stage 1: Install dependencies ---
FROM node:24-bookworm-slim AS deps
WORKDIR /repo

# Install python/make if needed for some node-gyp packages, though usually not needed for these apps
# RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy manifests for yarn workspaces resolution
COPY package.json yarn.lock .npmrc tsconfig.json ./
COPY packages/auth/package.json packages/auth/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/realtime/package.json packages/realtime/package.json
COPY packages/offline-queue/package.json packages/offline-queue/package.json
COPY apps/${app}/package.json apps/${app}/package.json

RUN corepack enable && yarn install --frozen-lockfile --network-timeout 600000

# --- Stage 2: Build Next.js application ---
FROM node:24-bookworm-slim AS builder
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
# Safely copy local node_modules if it exists (for unhoisted packages like next.js)
COPY --from=deps /repo/apps/${app}/node_module[s] ./apps/${app}/node_modules/
COPY package.json yarn.lock tsconfig.json ./
COPY packages packages
COPY apps/${app} apps/${app}

# NEXT_PUBLIC_* variables inlined at build time
${argsBlock}

${envsBlock}

# Prevent build process from OOM on low vCPU hosts
ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV NEXT_PRIVATE_MAX_WORKERS=1

WORKDIR /repo
RUN corepack enable && yarn workspace ${packageName} build

# --- Stage 3: Ultra-lightweight Production Runner ---
FROM node:24-bookworm-slim AS runner
WORKDIR /repo/apps/${app}

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /repo/node_modules /repo/node_modules
COPY --from=builder /repo/apps/${app}/node_module[s] /repo/apps/${app}/node_modules/
COPY --from=builder /repo/apps/${app}/package.json ./package.json
COPY --from=builder /repo/apps/${app}/.next ./.next
COPY --from=builder /repo/apps/${app}/public ./public

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
`;

  fs.writeFileSync(path.join(appPath, 'Dockerfile'), dockerfileContent);
  console.log(`Generated Dockerfile for ${app}`);
}

console.log("All Dockerfiles generated successfully.");
