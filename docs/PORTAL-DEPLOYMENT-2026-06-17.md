# Portal Deployment — Issues & Solutions (2026-06-17)

**Status:** ✅ LIVE on `app.sukashawarma.com`

---

## Errors Encountered & Fixes

### 1. **404 @suka/auth Not Found in npm Registry**

**Error:**
```
npm error 404 Not Found - GET https://registry.npmjs.org/@suka%2fauth
npm error 404  The requested resource '@suka/auth@*' could not be found
```

**Root Cause:**
- Server cloned repo but **`packages/auth` folder was missing** — FileZilla upload skipped it
- npm tried to find `@suka/auth` in public registry (404)
- Workspace structure broken

**Fix:**
```bash
# 1. Push local commits to origin (includes packages/auth)
git push origin main

# 2. On server: pull latest + reset to origin
git fetch origin
git pull origin main
git reset --hard origin/main

# 3. Verify packages/auth exists
ls packages/auth/package.json
# → "name": "@suka/auth" ✅
```

**Lesson:** Always use `git pull` for monorepo deploys, never manual file uploads for critical source folders.

---

### 2. **npm install Fails: node: command not found**

**Error:**
```
sh: line 1: node: command not found
npm error command sh -c node install.js
```

**Root Cause:**
- Postinstall scripts (esbuild, vitest, etc.) call `node` as shell command
- `node` not in PATH — only `/opt/alt/alt-nodejs24/root/usr/bin/node` available (CloudLinux wrapper)

**Fix:**
```bash
# Add native node to PATH
export PATH="/opt/alt/alt-nodejs24/root/usr/bin:$PATH"

# Verify
node --version  # v24.15.0

# Re-run install
npm install
```

**Lesson:** CloudLinux requires explicit PATH setup for npm postinstall scripts. Set once per terminal session.

---

### 3. **Type Error in @suka/auth/src/middleware.ts**

**Error:**
```
packages/auth/src/middleware.ts:1: Cannot find module 'next/server'
```

**Root Cause:**
- `next` is peerDependency in @suka/auth (installed in root node_modules, not nested)
- TypeScript compiler can't find `next/server` type definitions during Next.js build type-check
- Per CLAUDE.md: "Next 16 ketat → `ignoreBuildErrors: true`"

**Fix:**
```typescript
// apps/portal/next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  typescript: { ignoreBuildErrors: true },  // ← Add this
}
```

**Lesson:** With `transpilePackages`, type-check can safely ignore peerDep resolution (only compile-time needed).

---

### 4. **Build Crash: pthread_create Resource Temporarily Unavailable**

**Error:**
```
node[2384872]: pthread_create: Resource temporarily unavailable
SIGABRT at ../src/node_platform.cc:109
```

**Root Cause:**
- CloudLinux LVE (Lightweight Virtual Environment) limits NPROC (thread count)
- Next.js spawns worker threads = 1 per CPU core detected
- Server detected 32+ cores but NPROC limit hit → thread creation fails

**Fix:**
```bash
export PATH="/opt/alt/alt-nodejs24/root/usr/bin:$PATH"
export UV_THREADPOOL_SIZE=2
taskset -c 0,1 npm run build
```

- `taskset -c 0,1` — lock process to 2 CPU cores
- Next.js sees 2 cores → spawns 2 workers (not 32)
- Thread count stays within NPROC limit

**Lesson:** Shared hosting (cPanel CloudLinux) requires resource constraints on multi-threaded builds.

---

### 5. **FileZilla Upload Conflicts with git pull**

**Error:**
```
error: Your local changes would be overwritten by merge:
    apps/portal/.env.example
    apps/portal/next.config.ts
    apps/portal/package.json
    [15 untracked files]
```

**Root Cause:**
- FileZilla uploaded full `apps/portal/` folder from Windows build
- When `git pull` tried, untracked files blocked merge
- Also Windows `node_modules` had wrong binary permissions

**Fix:**
```bash
# Clean untracked files (safe: .gitignore files like .env.local protected)
git checkout -- apps/stok/next-env.d.ts package-lock.json
git clean -df

# Force server to match origin
git reset --hard origin/main
```

**Lesson:** Never upload entire app folders via FileZilla to shared hosting. Use git for source, only upload `.env.local` files.

---

## Deployment Process — Portal

### Prerequisites
- Git repo cloned to `/home/sukashaw/suka-app`
- cPanel access
- `.env.local` with Supabase credentials

### Step-by-Step Deployment

#### 1. Ensure Latest Code on Server
```bash
cd /home/sukashaw/suka-app
git pull origin main
git reset --hard origin/main
```

#### 2. Setup Node Environment
```bash
export PATH="/opt/alt/alt-nodejs24/root/usr/bin:$PATH"
export UV_THREADPOOL_SIZE=2
```

#### 3. Install Dependencies
```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
npm install
# Should complete with "added 5173 packages" ✅
```

#### 4. Upload .env.local (if not present)
Via FileZilla to `/home/sukashaw/suka-app/apps/portal/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

#### 5. Build Portal App
```bash
cd apps/portal
export PATH="/opt/alt/alt-nodejs24/root/usr/bin:$PATH"
export UV_THREADPOOL_SIZE=2
taskset -c 0,1 npm run build
```

Expected output:
```
✓ Compiled successfully
✓ Generating static pages (5/5)
✓ Finalizing page optimization
Route (app)  Size  First Load JS
...
```

#### 6. Create server.cjs
```bash
cat > /home/sukashaw/app.sukashawarma.com/server.cjs << 'EOF'
const { createServer } = require('http');
const appDir = '/home/sukashaw/suka-app/apps/portal';
process.chdir(appDir);
const next = require(appDir + '/node_modules/next');
const app = next({ dev: false, dir: appDir });
const handle = app.getRequestHandler();
app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000);
});
EOF
```

#### 7. Setup in cPanel Node.js App
**cPanel → Setup Node.js App → Create Application:**
- **Node version:** 24.15.0
- **Mode:** Production
- **App root:** `/home/sukashaw/app.sukashawarma.com`
- **Startup file:** `server.cjs`
- **Env vars:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ⚠️ **DO NOT** add `NODE_ENV` (Production mode sets it)

Click **CREATE** → status shows "Running"

#### 8. Verify Live
```bash
curl -sk --resolve app.sukashawarma.com:443:103.77.106.237 https://app.sukashawarma.com/
```

Expected: HTML response with login page ("SUKA SHAWARMA — Portal")

```html
<title>Suka Shawarma — Portal</title>
<h1>SUKA SHAWARMA</h1>
<h2>Masuk Sistem</h2>
```

---

## Deployment Results

### Portal: ✅ LIVE

| Aspect | Status | Details |
|--------|--------|---------|
| **Domain** | ✅ LIVE | `app.sukashawarma.com` |
| **Node** | ✅ v24.15.0 | cPanel Node Selector |
| **Build** | ✅ Success | Compiled in 15.2s |
| **Routes** | ✅ 2 static + 1 dynamic | `/`, `/launcher`, Middleware |
| **Size** | ✅ Small | First Load JS 196kB |
| **Test** | ✅ HTML response | Login page loads |

---

## Key Takeaways

1. **Monorepo on Shared Hosting:** Use git exclusively, never FileZilla for source code
2. **CloudLinux npm:** Always set `export PATH="/opt/alt/.../bin:$PATH"` for postinstall scripts
3. **Build Resource Limits:** Use `taskset -c 0,1` to constrain multi-threaded builds
4. **Next.js Type Errors:** With `transpilePackages`, set `ignoreBuildErrors: true` safe
5. **Workspace Resolution:** Ensure all workspace packages (auth, design-system, etc.) are git-committed and pulled to server

---

## Next: Deploy Remaining Apps

Same process for:
- **stok.sukashawarma.com** (rebuild + restart)
- **distribusi.sukashawarma.com** (rebuild + restart)
- **owner-dashboard.sukashawarma.com** (new deployment)

**Deployment date:** 2026-06-17  
**Portal live time:** ~10:36 UTC+7

---

**Last updated:** 2026-06-17
