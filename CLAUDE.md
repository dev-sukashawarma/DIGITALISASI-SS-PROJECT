# Suka Shawarma Outlet Suite — Claude Code Project Guide

## Overview
Digitalisasi operasional 19 outlet Suka Shawarma. Stack: Supabase + Next.js (app router), TypeScript, TailwindCSS.

**Primary workspaces:**
- `apps/stok/` — Stock monitoring & ledger (stok, opname, surat jalan)
- `apps/distribusi/` — Distribution/shipping (if applicable)

## Key Architecture Decisions

### 1. Monitoring-Live Papan (June 2026)
**Purpose:** Real-time stock status board untuk SPV & manajemen (view-only, 19 outlet).

**Aesthetic:** Operasional Minimalist — tegas, high-contrast, readability-first (1920px wide TV, ditangkap 3 detik dari 2-3m).

**Data model:**
- `monitoring_view_spv` — agregat stok + status (below/warning/ok) per outlet, item
- `ledger_feed_spv` — pergerakan stok terbaru lintas outlet (create/view definer, bypass RLS)
- `stockout_forecast_spv` — prediksi habis (laju pakai 7 hari → days_left)

**Layout:**
```
Header (1 baris): stat kritis/menipis + jam + refresh
Top section: Kitchen panel (1/4 width) | Top-3 kritis (1/2 width, conditional)
Grid: 18 outlet, 3 kolom, spacious cards (340px × 280px)
```

**Kurasi info:** 
- ✅ Keep: Kitchen SPOF, Top-3 kritis, Grid status
- ❌ Removed: Recent Update feed (sidebar noise), Badge Kerugian, Prediksi Stockout (→ detail page)

**Code:** `apps/stok/src/components/monitoring/LiveMonitoringPage.tsx`

---

### 2. Stock Ledger & RLS
**Model:** `ledger_stok` signed (qty>0 inflow, <0 outflow). Tipe: terima_kiriman, pemakaian, waste, adjustment, opname_selisih, transfer_keluar/masuk, rejected_kiriman.

**RLS:** 
- `ledger_read` membatasi per `outlet_staff.outlet_id` (crew lihat outlet sendiri saja)
- View definer (`security_barrier`, tanpa `security_invoker`) bypass RLS agar SPV lihat semua outlet

**Riwayat migration:** Remote sering diverged (objek sudah ada tapi riwayat tak ter-stempel). Solusi: `migration repair --status applied/reverted` sebelum `db push`.

---

### 3. Outlet Model
**Canonical:** `outlet_staff` (1 row per user, `id` = auth.users.id). Bukan `outlet_users`; `profiles` (lama POS) kini VIEW kompat di atas `outlet_staff`. Role: admin, owner, spv, kepala_outlet, kasir, crew, kiosk.

**Multi-outlet:** `kepala_outlet` bisa membina beberapa outlet via tabel `staff_outlets` (many-to-many). `kasir`/`crew`/`kiosk` tetap 1 outlet (`outlet_staff.outlet_id`). `spv`/`admin`/`owner` akses semua outlet. Helper `accessible_outlet_ids()` meresolusi scope. Detail jobdesk & matriks akses: `docs/ROLE-JOBDESK.md`.

---

## Development Workflow

### Branching & PRs
- Feature branches: `feat/<feature-name>`
- Fixes: `fix/<issue-name>`
- Merge: PR + code review + merge commit (keep history clear)

### Database
- Migrations: `supabase/migrations/<timestamp>_<desc>.sql`
- Push: `supabase db push` (hati-hati riwayat diverged — `migration repair` dulu)
- Local: Gunakan Supabase local dev kalau tersedia

### Build & Test
- Type check: `yarn type-check` (root)
- Build: `yarn build` (root) atau `cd apps/stok && yarn build`
- No end-to-end tests yet; manual smoke tests via browser

---

## Next Features / Backlog

### 1. Monitoring-Live Detail Drill-Down (Priority)
**User story:** Dari papan monitoring-live, klik card outlet → detail page per outlet yang menampilkan actual stok breakdown per item (dengan ledger history).

**Route:** `/stok/monitoring-live/[outlet-id]`  
**Components:** DetailOutletMonitoring (TBD)  
**Data:** fetchItemDetail + ledger history  

### 2. Transfer Antar-Outlet Suggestion
Automated: outlet A surplus + outlet B kritis pada item sama → suggest transfer.

### 3. Waste & Shrinkage Dashboard
Laporan waste/rejected/opname negatif per outlet, per kategori, trends.

---

## Common Commands

```bash
# Root
yarn dev                    # Start all apps
yarn type-check            # Type check all workspaces
yarn build                 # Build all apps

# Stok app
cd apps/stok
yarn dev                   # http://localhost:3001
yarn build
yarn type-check

# Supabase
supabase db push           # Push local migrations to remote
supabase migration list    # Check migration status
supabase migration repair  # Fix diverged riwayat
```

---

## Deployment — cPanel + CloudLinux Node Selector + LiteSpeed

Server produksi: shared hosting **connectindo** (`grace`, IP publik **103.77.106.237**, NS connectindo.net), LiteSpeed + CloudLinux Node Selector. Dipilih shared server Indonesia demi **latency** (Vercel kena limit redeploy). **1 subdomain = 1 Node app.**

### Status
- ✅ `distribusi.sukashawarma.com` — LIVE (2026-06-12)
- ⏳ `stok.sukashawarma.com` — subdomain + Node app dibuat, app belum di-build/deploy

### Prasyarat (sekali setup)
- Monorepo di-`git clone` ke `/home/sukashaw/suka-app` (repo public: `github.com/dev-sukashawarma/DIGITALISASI-SS-PROJECT`).
- **node/npm asli** (bypass wrapper CloudLinux): `/opt/alt/alt-nodejs24/root/usr/bin/node` + `/opt/alt/alt-nodejs24/root/usr/lib/node_modules/npm/bin/npm-cli.js`.

### Langkah deploy per app
1. cPanel → buat **Subdomain** (docroot otomatis `/home/sukashaw/<sub>.sukashawarma.com`, di home level — normal di host ini).
2. cPanel → **Setup Node.js App**: Node `24.15.0`, mode `Production`, app root = subdomain folder, startup file `server.cjs`. JANGAN tambah env `NODE_ENV` manual (mode Production sudah set; manual bikin duplikat korup).
3. Upload `apps/<app>/.env.local` ke `suka-app/apps/<app>/` via FileZilla (berisi service role keys — jangan echo di terminal).
4. Install deps (bypass wrapper, pakai `.npmrc` nested default — JANGAN override hoisted):
   ```bash
   cd /home/sukashaw/suka-app && /opt/alt/alt-nodejs24/root/usr/bin/node /opt/alt/alt-nodejs24/root/usr/lib/node_modules/npm/bin/npm-cli.js install
   ```
5. Build app:
   ```bash
   cd /home/sukashaw/suka-app/apps/<app> && /opt/alt/alt-nodejs24/root/usr/bin/node /opt/alt/alt-nodejs24/root/usr/lib/node_modules/npm/bin/npm-cli.js run build
   ```
6. Buat `server.cjs` di **docroot subdomain** (CommonJS, absolute-path ke build — hindari konflik node_modules symlink CloudLinux):
   ```js
   const { createServer } = require('http');
   const appDir = '/home/sukashaw/suka-app/apps/<app>';
   process.chdir(appDir);
   const next = require(appDir + '/node_modules/next');
   const app = next({ dev: false, dir: appDir });
   const handle = app.getRequestHandler();
   app.prepare().then(() => createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000));
   ```
7. Panel Node app: startup file `server.cjs`, env `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **SAVE → RESTART**.
8. DNS: cek `dig +short <sub>.sukashawarma.com @dns1.connectindo.net`. Kalau kosong, tambah A record `<sub>` → `103.77.106.237` di cPanel **Zone Editor** (kadang tidak auto-dibuat).

### Gotcha penting
- **TEST via IP publik, BUKAN `127.0.0.1`** — loopback di server ini SELALU balik cPanel defaultwebpage (false negative). Pakai: `curl -sk --resolve <domain>:443:103.77.106.237 https://<domain>/`. Passenger spawn on-demand → `ps` kosong saat idle itu normal.
- **`type: module`** di package.json → startup HARUS `.cjs` (bukan `.js`).
- **Type error build** (Next 16 ketat) → `next.config.js`: `typescript.ignoreBuildErrors: true`. Key `eslint` tidak didukung Next 16. ⚠️ Edit `next.config.js` di server ke-overwrite saat `git pull` — fix permanen harus commit ke repo.
- **`@suka/*` 404 ke registry** = wrapper npm CloudLinux membajak node_modules ke venv. Selalu pakai npm asli `/opt/alt/...`.

---

## Notes

- **Monitoring-live design rationale:** Papan TV lebar perlu readability & speed (3 detik ditangkap), bukan density informasi maksimal. Sidebar feed dihapus → detail page. Top-3 & Kitchen highlight SPOF & prioritas.
- **RLS complexity:** View definer adalah solusi agar SPV lihat semua outlet. Hindari query langsung ke `ledger_stok` / `stok_balance` untuk cross-outlet reports.
- **Data freshness:** Last updated timestamp per outlet di monitoring_view_spv; papan warning kalau data >15 mnt (deprecated fitur, cek ulang kalau dipakai).

---

## Session 2026-06-15: Dashboard & Auth Fixes (apps/stok)

### ✅ Completed
1. **Tailwind v4 syntax** — `@import "tailwindcss"` + `@theme` palet `suka-*`, hindari v3 directives
2. **Dashboard route** — `/dashboard` sekarang render `MonitoringPage` (crew/SPV role-based), bukan launcher hub
3. **QueryClientProvider** — kembalikan yang hilang saat refactor launcher (bikin infinite loading)
4. **Casing fix** — `Providers.tsx` untuk Linux case-sensitive deploy
5. **Embed disambiguation** — `outlets!outlet_staff_outlet_id_fkey(...)` di monitoring_view_crew query
6. **Logout button** — "Keluar" di CrewDashboard header, call `signOut()` + redirect `/`
7. **Permintaan link** — aksi cepat "Permintaan Bahan" di CrewDashboard (entry point yg hilang)
8. **Outlet staff seeding** — insert Andi Empang (crew) ke outlet_staff table untuk testing

### ✅ Session 2026-06-15 (Continuation): Type-check & Hydration Fixes

**Problems solved:**
1. **Syntax error di monitoring.ts** — fixed duplicate `const supabase` (line 9 & 66), added missing client init to `fetchItemDetail` + `fetchOutletItemsDetail`
2. **Type-check failures (228→69→0):**
   - `apps/stok/tsconfig.json` — added `"baseUrl": "."` to fix `@/*` path resolution, added `"types": ["vitest/globals", "@testing-library/jest-dom"]`
   - `apps/stok/package.json` — install missing test deps (`vitest`, `jsdom`, `@testing-library/*`)
   - `useLedger.ts` / `useOpname.ts` — widened `outletId` param to `string | null | undefined`
   - `ledger/new` & `opname/new` pages — added guard for staff with no `outlet_id`
   - `packages/auth` — added `ref_photo_url` field to `OutletStaffProfile` type & `getOutletStaff()` query
   - `PermintaanForm.tsx` — removed unused `useBahanBaku` import
   - `packages/offline-queue` — removed unused `maxRetries`/`retryDelay` destructure
   - `StatusBadge.test.tsx` — updated test to match current "Operasional Minimalist" component design

3. **Hydration mismatch di CrewDashboard** — moved all `new Date()` / `Date.now()` calculations ke `useEffect` (client-only render) untuk hindari server/client mismatch
4. **Hardcoded "Aris S." di header** — replaced dengan actual crew name dari `outletStaff.name` (sekarang tampil "Crew: Andi Empang")

**Test status:** All 65 tests pass, `yarn type-check` clean (0 errors)

### ✅ Completed (Overall)
- Dashboard `/dashboard` render crew monitoring data tanpa "Connection unstable" error
- Login via SSO works, crew name displays correctly
- All type errors resolved
- Tests running & passing

### 📝 Next Steps
1. ✅ Type-check complete
2. ✅ Tests passing
3. Manual smoke test via browser ✅
4. Push commits ke GitHub & redeploy `stok.sukashawarma.com`

---

## Session 2026-06-17: Distribusi Hardening — Plan (brainstorm + grill-with-docs)

**Status:** Plan tertulis & committed. **Belum dieksekusi** — akan dilanjut di sesi baru.

### Hasil
1. **Audit `apps/distribusi`** vs playbook stok — hampir kembar dengan kondisi stok pra-fix: 61 type errors (tsconfig tanpa `baseUrl`), auth pakai `createClient` lokal (tak set cookie domain → SSO bug laten), ~10 date render rawan hydration, no test infra.
2. **🔑 Kontradiksi arsitektur di-resolve (grill-with-docs):** `output: 'export'` (ADR-005) bentrok dengan kenyataan distribusi LIVE sebagai **Node server** + pakai `middleware.ts` (yang static export matikan diam-diam). → **ADR-008 dibuat (supersede ADR-005)**: Node server resmi, premis "cPanel shared tak bisa Node.js" gugur (ada CloudLinux Node Selector). `output:'export'` = regresi tak sengaja (commit `cdd2fae`).
3. **Docs diupdate:** ADR-008 (baru), ADR-005 (Superseded), `NOTES-STATIC-VS-SSR.md` (banner outdated), `CONTEXT.md` (term Hosting app).

### Artefak (untuk sesi lanjut)
- **Spec:** `docs/superpowers/specs/2026-06-15-distribusi-hardening-design.md`
- **Plan (5 tasks, eksekusi-ready):** `docs/superpowers/plans/2026-06-17-distribusi-hardening.md`
- **ADR:** `docs/adr/0008-pivot-nodejs-server-cloudlinux-node-selector.md`

### 📝 Next Steps (sesi baru)
1. Eksekusi plan distribusi (Task 1→5), pakai `superpowers:subagent-driven-development` atau `executing-plans`.
2. Plan ini = **referensi saat re-upload distribusi ke production** (distribusi yang LIVE sekarang = baseline, jangan diutak-atik langsung).
3. Pertimbangkan terapkan playbook hardening yang sama ke `apps/absensi` & `apps/owner-dashboard` (kemungkinan punya tsconfig/auth issue serupa).

---

## Session 2026-06-17: Permintaan Bahan RLS & Approval Fixes (apps/stok)

**Status:** Completed.

### Hasil
1. **Penyebab Utama RLS SPV:** SPV Pusat memiliki data di `outlet_staff` dengan `role: 'kepala_outlet'` (bukan `'spv'`), dan `outlet_id` di kitchen. Saat memanggil RPC dari Server Action, client-side session Supabase mengalami kegagalan RLS karena `auth.uid() = null` jika dipanggil dari service role, atau gagal authorization check `is_kitchen_staff` jika dipanggil dengan regular user.
2. **Perbaikan Database / Migration:**
   - Membuat RPC versi bypass/layanan: `buat_permintaan_svc`, `approve_permintaan_svc`, dan `tolak_permintaan_svc` di `supabase/migrations/20260617140000_permintaan_svc_rpcs.sql`.
   - RPC ini didefinisikan sebagai `SECURITY DEFINER` dan mem-bypass pengecekan `auth.uid()` di sisi PostgreSQL, mendelegasikan validasi keamanan ke application layer (Server Actions/Middleware).
3. **Resolusi Migration History Drift**:
   - Ditemukan duplikasi timestamp migration (17 pasang file migrasi lokal) yang memblokir `supabase db push`.
   - Menggabungkan/merge semua migrasi duplikat tersebut ke dalam satu file tunggal per timestamp sehingga status migrasi sinkron sempurna.
   - Sukses menerapkan seluruh sisa migrasi ke database remote via `supabase db push`.
4. **Pembaruan Next.js Server Actions**:
   - Memperbarui `apps/stok/src/app/actions/permintaan.ts` untuk menggunakan RPC `_svc` baru.
   - Mengambil session ID (`currentUserId`) secara dinamis di server-side menggunakan Next.js `cookies()` dan `@suka/auth` client.

---

**Last updated:** 2026-06-17  
**Owner:** Dev Suka Shawarma
