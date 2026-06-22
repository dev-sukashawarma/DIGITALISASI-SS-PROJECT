# cPanel Deployment Checklist — Suka Shawarma SSO Suite

**Environment:** connectindo.net shared hosting (grace, IP: 103.77.106.237)  
**Apps:** 6 subdomains (portal, stok, absensi, distribusi, owner, kasir)  
**Stack:** Node.js 24.15.0 + LiteSpeed + CloudLinux  
**Last Updated:** 2026-06-20

---

## PRE-DEPLOYMENT CHECKLIST

- [ ] All 12 critical security fixes applied (commit cd8d0ef + aae79fd)
- [ ] Code review passed ✅
- [ ] Database migrations applied to remote (supabase db push)
- [ ] Git branch main is clean and pushed
- [ ] .env.local files ready for each app (see below)
- [ ] Node.js 24.15.0 available on server (`/opt/alt/alt-nodejs24/...`)

---

## STEP 1: Prepare .env.local Files

Create `.env.local` for each of the 6 apps. Store securely (upload via FileZilla, NOT git).

### Template Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (anon key from Supabase)
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
```

### Per-App .env.local Files

#### 1. Portal (`apps/portal/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
```

#### 2. Stok (`apps/stok/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
```

#### 3. Absensi (`apps/absensi/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
```

#### 4. Distribusi (`apps/distribusi/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
```

#### 5. Owner Dashboard (`apps/owner-dashboard/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
```

#### 6. POS Kasir (`apps/pos-kasir/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
```

---

## STEP 2: Create Subdomains in cPanel

For each of 6 apps, create a subdomain:

### Via cPanel → Addon Domains / Subdomains

| Subdomain | Docroot | App Directory |
|-----------|---------|---------------|
| `app.sukashawarma.com` | `/home/sukashaw/app.sukashawarma.com` | `apps/portal` |
| `stok.sukashawarma.com` | `/home/sukashaw/stok.sukashawarma.com` | `apps/stok` |
| `absensi.sukashawarma.com` | `/home/sukashaw/absensi.sukashawarma.com` | `apps/absensi` |
| `distribusi.sukashawarma.com` | `/home/sukashaw/distribusi.sukashawarma.com` | `apps/distribusi` |
| `owner.sukashawarma.com` | `/home/sukashaw/owner.sukashawarma.com` | `apps/owner-dashboard` |
| `kasir.sukashawarma.com` | `/home/sukashaw/kasir.sukashawarma.com` | `apps/pos-kasir` |

**Steps:**
1. cPanel → Addon Domains (or Subdomains)
2. Enter subdomain name (e.g., `app`, `stok`, etc.)
3. Confirm auto-generated docroot `/home/sukashaw/[subdomain].sukashawarma.com`
4. Create

**Verify DNS:**
```bash
dig +short app.sukashawarma.com @dns1.connectindo.net
# Should return: 103.77.106.237
```

---

## STEP 3: Upload .env.local Files via FileZilla

**Important:** Never echo env files to terminal or commit to git.

1. Open FileZilla, connect to `/home/sukashaw/suka-app/`
2. For each app, navigate to `apps/[app-name]/`
3. Create `.env.local` file with content from Step 1
4. Verify file exists, set permissions to `600` (rw-------)

---

## STEP 4: Install Dependencies

**Important:** Because this is a Yarn Workspace monorepo, you MUST use `yarn`, NOT `npm install`. To bypass cPanel permission limits for Node.js, export the path first.

```bash
cd /home/sukashaw/suka-app

# 1. Kenalkan jalur Node.js versi 24 ke sistem
export PATH="/opt/alt/alt-nodejs24/root/usr/bin:$PATH"

# 2. Hapus sisa cache/folder lama (wajib untuk clean install)
rm -rf node_modules apps/*/node_modules packages/*/node_modules .next apps/*/.next package-lock.json

# 3. Jalankan yarn install via npx
npx yarn install
```

**Expected:** Installs monorepo dependencies (root + all apps).  
**Time:** ~2-3 minutes

---

## STEP 5: Build Each App

For each of 6 apps, build Next.js output using the provided deploy script (safest method):

```bash
cd /home/sukashaw/suka-app

# Build satu aplikasi
./deploy.sh portal

# ATAU build semua aplikasi secara berurutan
./deploy.sh all
```

**If build error "Type error":**
- Check `next.config.mjs` for `typescript: { ignoreBuildErrors: true }` (should be set for Next 15/16)
- Verify `.env.local` has all NEXT_PUBLIC_* vars
- If building manually without the script, make sure to `export PATH="/opt/alt/alt-nodejs24/root/usr/bin:$PATH"` first.

---

## STEP 6: Create server.cjs in Each Docroot

For each subdomain docroot, create `server.cjs` (CommonJS, required for type: module).

### Template

```javascript
// /home/sukashaw/[subdomain].sukashawarma.com/server.cjs

const { createServer } = require('http');
const appDir = '/home/sukashaw/suka-app/apps/[APP_NAME]';

process.chdir(appDir);

const next = require('module').createRequire(appDir + '/package.json')('next');
const app = next({ dev: false, dir: appDir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000);
});
```

### Per-App server.cjs

#### Portal (`/home/sukashaw/app.sukashawarma.com/server.cjs`)
```javascript
const { createServer } = require('http');
const appDir = '/home/sukashaw/suka-app/apps/portal';
process.chdir(appDir);
const next = require('module').createRequire(appDir + '/package.json')('next');
const app = next({ dev: false, dir: appDir });
const handle = app.getRequestHandler();
app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000);
});
```

#### Stok (`/home/sukashaw/stok.sukashawarma.com/server.cjs`)
```javascript
const { createServer } = require('http');
const appDir = '/home/sukashaw/suka-app/apps/stok';
process.chdir(appDir);
const next = require('module').createRequire(appDir + '/package.json')('next');
const app = next({ dev: false, dir: appDir });
const handle = app.getRequestHandler();
app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000);
});
```

**Repeat for:** `absensi`, `distribusi`, `owner-dashboard`, `pos-kasir` (change `appDir` path)

---

## STEP 7: Setup Node.js Apps in cPanel

### Via cPanel → Node.js App Manager

For each subdomain:

1. **cPanel → Node.js App Manager**
2. **Create Application:**
   - Node.js version: `24.15.0`
   - Application root: `/home/sukashaw/[subdomain].sukashawarma.com`
   - Application startup file: `server.cjs`
   - Application URL: https://[subdomain].sukashawarma.com/
   - Application mode: **Production** ✅
   - **Do NOT** manually add `NODE_ENV=production` (already set by "Production" mode)

3. **Environment Variables (SAVE after each):**
   - `NEXT_PUBLIC_SUPABASE_URL`: [value from .env.local]
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: [value from .env.local]
   - `NEXT_PUBLIC_PORTAL_URL`: `https://app.sukashawarma.com`
   - `NEXT_PUBLIC_COOKIE_DOMAIN`: `.sukashawarma.com`

4. **Save → Restart**

**Repeat for all 6 apps.**

**⚠️ CRITICAL:** Do NOT add `NODE_ENV=production` manually. Panel's "Production" mode sets it automatically. Duplicates break cookie handling.

---

## STEP 8: Verify DNS Records

Ensure A records exist for each subdomain:

```bash
# Via cPanel Zone Editor or command line:
dig +short app.sukashawarma.com @dns1.connectindo.net
dig +short stok.sukashawarma.com @dns1.connectindo.net
dig +short absensi.sukashawarma.com @dns1.connectindo.net
dig +short distribusi.sukashawarma.com @dns1.connectindo.net
dig +short owner.sukashawarma.com @dns1.connectindo.net
dig +short kasir.sukashawarma.com @dns1.connectindo.net

# All should return: 103.77.106.237
```

If any return empty, add A record in cPanel Zone Editor:
- Record: `[subdomain]`
- Type: `A`
- Points to: `103.77.106.237`

---

## STEP 9: Test Via IP (NOT localhost)

⚠️ **CRITICAL:** Always test via IP address, NOT `127.0.0.1`. Loopback will return cPanel default page (false negative).

```bash
# Test Portal
curl -sk --resolve app.sukashawarma.com:443:103.77.106.237 \
  https://app.sukashawarma.com/

# Should return: HTML login page (200 OK)

# Test Stok
curl -sk --resolve stok.sukashawarma.com:443:103.77.106.237 \
  https://stok.sukashawarma.com/

# Should return: Redirect to portal (302) or 401 Unauthorized
```

**Expected responses:**
- Portal `/`: 200 OK (login page HTML)
- Portal `/launcher`: 302 redirect to `/` (not authenticated)
- Stok `/`: 302 redirect to portal (SSO guard)
- Stok `/monitoring-live`: 302 redirect to portal (unauthenticated)

**If "cPanel default page" appears:**
- App not started yet (Passenger spawn on-demand)
- Check Node.js app status in cPanel
- Wait 30 seconds, retry

---

## STEP 10: Test SSO Flow

### Login Flow

1. Navigate to `https://app.sukashawarma.com` (portal)
2. **Login page** loads ✅
3. Enter credentials (test user):
   - Email: (test account from Supabase)
   - Password: (test password)
4. **Launcher page** shows (role-based app cards) ✅
5. Click **Stok** card → Redirects to `https://stok.sukashawarma.com` 🔗
6. **Stok loads without re-login** (SSO cookie works) ✅

### Role-Based Access

1. Login as `crew` role → Launcher shows only **Absensi** ✅
2. Try direct URL: `https://stok.sukashawarma.com` → Redirect to portal ✅
3. Login as `spv` role → Launcher shows **Absensi, Stok, Distribusi** ✅
4. Login as `admin` role → Launcher shows **All 5 apps** ✅

### Cross-Domain Cookie Sharing

1. Login at portal → Cookie domain: `.sukashawarma.com` ✅
2. Navigate to stok → Cookie shared (no re-auth) ✅
3. Open browser dev tools → Cookies tab → Verify `sb-***` cookie has domain `.sukashawarma.com` ✅

### Staff Status Enforcement

1. Mark test user as `on_leave` in Supabase
2. Try to login at portal → Login fails or redirects to `/` ✅
3. Mark user as `inactive` → Same behavior ✅
4. Revert to `active` → Login works ✅

---

## STEP 11: Monitor & Troubleshoot

### Check Node Process Status

```bash
ps aux | grep node
# Should show Node.js process for each app (or empty if idle)
```

**Normal:** Passenger spawns on-demand. Process not visible until request arrives.

### Check cPanel Error Logs

```bash
# Node.js error logs
tail -50 /home/sukashaw/logs/node.log

# App-specific (if available)
ls -la /home/sukashaw/[subdomain].sukashawarma.com/logs/
```

### Check Network

```bash
# Verify SSL certificate (auto-provisioned by cPanel)
curl -vI https://app.sukashawarma.com/
# Should show: SSL certificate OK

# Check response headers
curl -sI https://app.sukashawarma.com/ | grep -i set-cookie
# Should show: Cookie domain = .sukashawarma.com
```

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| "cPanel default page" | App not started | Wait 30s, check Node.js app status |
| "Cannot find module '@suka/auth'" | Build missing | Run `npm run build` in app dir |
| "Cookie domain localhost" | NEXT_PUBLIC_COOKIE_DOMAIN empty | Set to `.sukashawarma.com` in Node app env |
| "Redirect loop" | Portal config wrong | Verify `NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com` |
| "Middleware takes long" | RPC query slow | Check Supabase RPC performance |
| "SSL certificate error" | cPanel provisioning | Wait 10 min, retry (Let's Encrypt propagation) |
| `Module not found` saat Build | Dependensi baru belum terinstal di server | Buka terminal cPanel di root `/home/sukashaw/suka-app`, jalankan `export PATH="/opt/alt/alt-nodejs24/root/usr/bin:$PATH"` lalu `npx yarn install` |

---

## STEP 12: Post-Deployment Verification

- [ ] All 6 apps respond (HTTP 200 or redirects)
- [ ] Portal login page loads
- [ ] SSO login works (portal → launcher → apps)
- [ ] Role-based access enforced (crew sees only absensi, etc.)
- [ ] Cookies have domain `.sukashawarma.com`
- [ ] Direct URL access to apps redirects to portal
- [ ] Inactive/on_leave staff cannot login
- [ ] HTTPS certificates valid
- [ ] No console errors in browser dev tools

---

## STEP 13: Enable Monitoring (Optional)

### cPanel Uptime Monitor

Set up uptime monitoring for production health:

1. cPanel → Monitoring
2. Add check:
   - URL: `https://app.sukashawarma.com`
   - Interval: 5 minutes
   - Action on failure: Email alert

---

## ROLLBACK PLAN (if deployment fails)

1. **Revert to previous build:**
   ```bash
   cd /home/sukashaw/suka-app
   git checkout HEAD~1  # Revert last commit
   npm run build  # Rebuild all apps
   # Restart Node.js apps in cPanel
   ```

2. **Kill hung processes:**
   ```bash
   pkill -f "node.*server.cjs"
   # Then restart apps in cPanel
   ```

3. **Clear cPanel cache:**
   - cPanel → Clear Cache

---

## PERFORMANCE — Optimasi Perpindahan Portal → App

### Env optimasi auth (wajib untuk performa, opsional untuk fungsi)
- `SUPABASE_JWT_SECRET` — JWT Secret dari Supabase Dashboard (Project Settings → API).
  Membuat middleware memverifikasi token secara lokal (0 round-trip auth) alih-alih
  memanggil `getUser()` tiap request. Bila tidak di-set, app tetap jalan (fallback
  `getUser()`), hanya lebih lambat. Set di panel Node app tiap subdomain (stok,
  distribusi, absensi, owner) → SAVE → RESTART. Jangan commit nilainya.

### Anti cold-start
Passenger spawn on-demand → klik pertama ke app idle harus spawn Node (lambat).
Dua lapis pencegahan:
1. **PassengerMinInstances 1** — di `.htaccess` docroot tiap subdomain tambahkan
   `PassengerMinInstances 1` agar minimal 1 instance tetap hidup.
2. **Cron keepalive** — `scripts/keepalive.sh` ping tiap subdomain tiap 5 menit
   (cron: `*/5 * * * * /home/sukashaw/suka-app/scripts/keepalive.sh >/dev/null 2>&1`).
   Test via IP publik (`--resolve`), bukan loopback.

---

## SUCCESS CRITERIA

✅ Deployment is successful when:

1. All 6 apps respond over HTTPS
2. Portal login → Launcher → Apps flow works seamlessly
3. No re-authentication between portal and apps
4. Role-based access enforced (crew/kasir/spv/admin see correct apps)
5. Staff status (active/inactive/on_leave) enforced
6. Browser dev tools show `.sukashawarma.com` cookie
7. No errors in cPanel Node.js logs
8. No errors in browser console

---

## CONTACTS & ESCALATION

- **cPanel Support:** connectindo.net support portal
- **Supabase:** Check project status at https://supabase.com/dashboard
- **SSL Certificates:** Auto-renewed by cPanel (Let's Encrypt)

---

**Deployment Date:** ___________  
**Deployed By:** ___________  
**Status:** [ ] LIVE [ ] TESTING [ ] ROLLED BACK
