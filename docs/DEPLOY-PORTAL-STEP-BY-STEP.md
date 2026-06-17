# Deploy Portal — Step-by-Step Guide

**Target:** `app.sukashawarma.com`  
**Server:** connectindo (grace), IP `103.77.106.237`  
**Subdomain docroot:** `/home/sukashaw/app.sukashawarma.com`

---

## Step 1: Create Subdomain in cPanel

**Location:** cPanel → Addon Domains (atau Zone Editor)

1. Login ke cPanel
2. Go to **Addon Domains** 
3. Create new subdomain:
   - **Subdomain:** `portal`
   - **Domain:** `sukashawarma.com`
   - **Docroot:** Auto-creates `/home/sukashaw/app.sukashawarma.com`

4. Click **Add Domain**

Expected: Subdomain dibuat, docroot otomatis terbentuk

---

## Step 2: Upload .env.local via FileZilla

**Files to upload:**
- Lokasi lokal: `D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT\apps\portal\.env.local`
- Tujuan server: `/home/sukashaw/suka-app/apps/portal/.env.local`

**Using FileZilla:**

1. Connect ke server:
   - Host: `103.77.106.237` (atau gunakan cPanel FTP credentials)
   - User: `sukashaw` (atau FTP user)
   - Password: [cPanel password atau FTP password]

2. Navigate ke: `/home/sukashaw/suka-app/apps/portal/`

3. Upload file: `apps/portal/.env.local` dari lokal ke server

4. Verify: File `.env.local` muncul di `/home/sukashaw/suka-app/apps/portal/`

---

## Step 3: Build Portal di Server via SSH

**Command (run di terminal/SSH):**

```bash
cd /home/sukashaw/suka-app

# Install all deps (jika belum)
/opt/alt/alt-nodejs24/root/usr/bin/node /opt/alt/alt-nodejs24/root/usr/lib/node_modules/npm/bin/npm-cli.js install

# Build portal app saja
cd apps/portal
/opt/alt/alt-nodejs24/root/usr/bin/node /opt/alt/alt-nodejs24/root/usr/lib/node_modules/npm/bin/npm-cli.js run build
```

**Expected output:**
```
> portal@1.0.0 build
> next build

...
✓ Compiled successfully
✓ Route handlers compiled
```

Jika berhasil, folder `.next` akan terbuat di `apps/portal/.next`

---

## Step 4: Create server.cjs di Subdomain Docroot

**File:** `/home/sukashaw/app.sukashawarma.com/server.cjs`

**Content:**

```javascript
const { createServer } = require('http');
const appDir = '/home/sukashaw/suka-app/apps/portal';
process.chdir(appDir);
const next = require(appDir + '/node_modules/next');
const app = next({ dev: false, dir: appDir });
const handle = app.getRequestHandler();
app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000);
});
```

**Cara buat (via FileZilla atau cPanel File Manager):**

1. Create new file di `/home/sukashaw/app.sukashawarma.com/`
2. Name: `server.cjs`
3. Paste content di atas
4. Save

---

## Step 5: Setup Node.js App di cPanel

**Location:** cPanel → Select Node.js Version (atau Setup Node.js App)

1. Login cPanel
2. Scroll ke bagian **Development** → **Select Node.js Version**
3. Atau cari **Setup Node.js App**

4. Click **Create Application** atau **Add Application**

5. Fill form:
   - **Node.js Version:** `24.15.0`
   - **App Mode:** `Production` (auto set NODE_ENV)
   - **App root:** `/home/sukashaw/app.sukashawarma.com` (docroot path)
   - **Startup file:** `server.cjs`
   - **Application URL:** `https://app.sukashawarma.com/`

6. **Environment variables** (click to add):
   ```
   NEXT_PUBLIC_SUPABASE_URL = [value from .env.local]
   NEXT_PUBLIC_SUPABASE_ANON_KEY = [value from .env.local]
   ```

   ⚠️ **JANGAN** add `NODE_ENV` manual (mode Production sudah set otomatis)

7. Click **Create**

**Expected:** App status berubah menjadi "Running" (atau "Spawning")

---

## Step 6: Test via IP + Domain

**Command (di terminal lokal atau server):**

```bash
# Test via IP publik (JANGAN loopback 127.0.0.1)
curl -sk --resolve app.sukashawarma.com:443:103.77.106.237 https://app.sukashawarma.com/

# Atau
curl -sk https://app.sukashawarma.com/ -H "Host: app.sukashawarma.com"
```

**Expected:**
```
<!DOCTYPE html>
<html>
...
```

Jika dapat HTML (bukan error), berarti berhasil!

Jika error, check:
- `ps aux | grep node` — apakah Passenger spawn?
- cPanel Node app logs — ada error?

---

## Step 7: Test di Browser

1. Open browser
2. Go to: `https://app.sukashawarma.com`
3. Ignore certificate warning (self-signed, normal untuk dev)
4. Expected: Login page atau dashboard muncul
5. Check console (F12 → Console) — ada JavaScript errors?

---

## Step 8: Verify Subdomain DNS (Optional)

```bash
dig +short app.sukashawarma.com @dns1.connectindo.net
# Expected: 103.77.106.237 (atau IP server connectindo)
```

Jika kosong, add A record manual di cPanel Zone Editor.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 404 Not Found | Subdomain tidak dibuat | Create di cPanel Addon Domains |
| Connection refused | Node app tidak running | Check cPanel Node app status, verify startup file |
| .env not found | Upload ke wrong path | Verify file di `/home/sukashaw/suka-app/apps/portal/.env.local` |
| Port already in use | Another app running di port 3000 | Check `ps aux`, kill process atau use different port |
| "Cannot find module" | npm install tidak jalan | Rebuild di server: `npm install` di root dir |

---

## Ready to Deploy?

When ready:
1. Run Step 1 (cPanel subdomain)
2. Run Step 2 (FileZilla upload)
3. Run Step 3 (SSH build)
4. Run Step 4 (server.cjs)
5. Run Step 5 (cPanel Node app setup)
6. Run Step 6 (curl test)
7. Run Step 7 (browser test)

**After portal is live, we'll deploy:** stok → distribusi → owner-dashboard (same process)

---

Status: Ready for deployment  
Date: 2026-06-17
