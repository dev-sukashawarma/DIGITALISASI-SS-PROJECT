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

**RLS (per 2026-07-12, migration `20260712000000`):**
- **`ledger_read`** — satu policy tunggal untuk SELECT: `outlet_id IN (SELECT accessible_outlet_ids())`. Berlaku untuk SEMUA role. Role privileged (`admin`, `spv`, `kitchen`, `owner`, `admin_finance`, `admin_hr`) dapat akses semua outlet. `leader`/`korlap` lewat `staff_outlets`. `crew`/`kiosk`/dll lewat `outlet_staff.outlet_id` tunggal.
- **`ledger_insert`** — hanya bisa insert ke outlet sendiri (`outlet_staff.outlet_id`).
- **`ledger_service_insert`** — service_role bisa insert ke mana saja (untuk trigger/RPC).
- Jangan pakai `.single()` saat query `ledger_stok` — gunakan `.maybeSingle()` atau handle `null` agar tidak crash saat RLS memblokir atau data tidak ditemukan.

**View:** `ledger_transaksi_ringkas` — agregasi per transaksi (join ref_order_id/ref_opname_id/ref_shipment_id/ref_transfer_id). Ikut RLS `ledger_stok` (bukan security definer). Di-query via `useLedgerTransaksiList` hook.

**Riwayat migration:** Remote sering diverged (objek sudah ada tapi riwayat tak ter-stempel). Solusi: `migration repair --status applied/reverted` sebelum `db push`.

---

### 3. Outlet Model
**Canonical:** `outlet_staff` (1 row per user, `id` = auth.users.id). Bukan `outlet_users`; `profiles` (lama POS) kini VIEW kompat di atas `outlet_staff`. Role: admin, owner, spv, leader, kasir, crew, kiosk, kitchen, mitra, staff_pusat.

**Multi-outlet:** `leader`/`korlap` bisa membina beberapa outlet via tabel `staff_outlets` (many-to-many). `kasir`/`crew`/`kiosk`/`mitra` tetap 1 outlet (`outlet_staff.outlet_id`). `spv`/`admin`/`owner`/`kitchen`/`admin_finance`/`admin_hr` akses **semua outlet** via `accessible_outlet_ids()`. Helper ini adalah satu-satunya sumber scope untuk RLS — selalu gunakan ini, jangan hardcode outlet list. Detail jobdesk & matriks akses: `docs/ROLE-JOBDESK.md`.

**Role khusus:**
- `kitchen` — Staff Gudang Pusat/Dapur. **Akses SPV-level**: bisa lihat monitoring & ledger semua outlet (diperlukan untuk koordinasi distribusi bahan baku). Fisik berada di lokasi yang sama dengan Gudang Pusat, tetapi secara sistem tetap harus request bahan ke Gudang Pusat.
- `mitra` — partner/investor 1 outlet; read-only; lihat Owner Dashboard scope 1 outlet (server-enforced via `accessible_outlet_ids()` + scoped views).
- `staff_pusat` — staff kantor pusat; auto-assign ke outlet dummy "Kantor Pusat"; akses `absensi` app.
- `korlap` — koordinator lapangan; akses semua outlet **non-Bogor** (regional) via `accessible_outlet_ids()`. Bisa juga punya outlet spesifik via `staff_outlets`.

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

---

## Apps Breakdown

### `apps/absensi` — Face Recognition + Attendance Kiosk (M1)
**Purpose:** Real-time attendance tracking dengan face recognition (1:N identification) + liveness detection. Kiosk mode di outlet, dashboard admin SPV/leader.

**Key components:**
- **Face enrollment** (`/dashboard/enroll`) — SPV/leader register crew wajah (3-angle capture: center, left, right)
- **Kiosk mode** (`/kiosk/[outlet_id]`) — crew clock in/out via face recognition + liveness challenge
- **Crew dashboard** (`/dashboard/kru`) — view personal attendance history
- **SPV/Leader dashboard** — manage staff, view attendance recap, checklist

**Alur pendaftaran crew:**
1. **Manajemen Kru** (`/dashboard/manajemen-kru`) — SPV/leader create akun crew baru
   - Input: nama, username, password sementara, role (crew/kasir/spv/leader)
   - Backend: call edge function `create-staff` → sign up di Supabase Auth + insert `outlet_staff` record
2. **Enrollment Wajah** (`/dashboard/enroll`) — Crew self-enroll atau SPV enroll crew
   - Consent: checkbox "Persetujuan UU PDP" (privacy consent, audit-tracked)
   - Capture: 3-angle autofocus (center facing → left turn → right turn)
   - Backend: average descriptor (face embedding) + upload ref photo to storage (`face-refs/{outlet_id}/{staff_id}.jpg`) + update `outlet_staff.face_descriptor` & `enrolled_at`
3. **Ready to Clock** — Crew bisa absen di kiosk

**Access control:**
- Enrollment page (`/dashboard/enroll`) — **SPV/Leader only** (role-based nav + layout redirect + **page-level guard** for defense-in-depth)
- Crew dashboard — crew view personal data only (RLS per `outlet_staff.outlet_id`)

**Face recognition tech:**
- Client-side: `@vladmandic/human` v3.3.6 (face.js) for detection + descriptor extraction
- Similarity: cosine similarity (dot product / L2 norm) with threshold 0.25
- Liveness: gesture detection (head turn, head up/down) to prevent photo spoofing

**Data model:**
- `outlet_staff`: added `face_descriptor` (float32[128]), `ref_photo_url`, `enrolled_at`, `consent_at`, `consent_by` columns
- Storage bucket: `face-refs/{outlet_id}/{staff_id}.jpg` (reference photo, access via RLS)

**Issues & fixes (Session 2026-06-22):**
- ✅ Fixed identify.ts return contract: now always returns object (never null), sentinel fallback {id:"unknown"} when no match
- ✅ Removed enrollment access risk: page-level role guard added to `/dashboard/enroll`
- ✅ Test precision improved: similarity assertions now ±0.005 tolerance (was too loose)
- ✅ Test env: changed from jsdom to node (pure math, no DOM needed)

**Next improvements (backlog):**
- [ ] Password generation: replace hardcoded "sukashawarma123" with random generation + force password change on first login
- [ ] Re-enrollment approval: SPV/leader approval workflow for crew wanting to update wajah
- [ ] Quality check on capture: blur/brightness detection before saving descriptor
- [ ] Reset enrollment: crew can retry if enrollment quality poor, permission-gated by leader
- [ ] Privacy audit trail: version policy hash, not just timestamp
- [ ] Email verification: optional on account create (for password reset capability)
- [ ] Onboarding: alert on dashboard if `enrolled_at` is null — "Face enrollment BELUM selesai"

---

## Deployment — VPS + Docker (Coolify)

**Status saat ini (per 2026-08-14).** Produksi sudah migrasi dari cPanel+LiteSpeed (section di bawah, disimpan sebagai riwayat) ke **VPS berbasis Docker, di-orchestrate oleh Coolify** (self-hosted PaaS — konfirmasi dari stack trace deploy: `App\Jobs\ApplicationDeploymentJob`, `App\Traits\ExecuteRemoteCommand`). **1 app = 1 Dockerfile** di `apps/<app>/Dockerfile`, multi-stage (`builder` → `runner`), tanpa `docker-compose.yml` di repo — Coolify memanggil `docker build` langsung dengan `--build-arg` per env var yang dikonfigurasi di panelnya.

### Struktur Dockerfile (pola wajib, semua 9 app)
1. **Stage `builder`** (`FROM node:24-bookworm-slim AS builder`) — copy manifest (`package.json` root + tiap `packages/*/package.json` + `apps/<app>/package.json`) dulu untuk cache layer, baru `yarn install --frozen-lockfile`, baru copy source penuh, baru `NEXT_TURBOPACK=0 yarn workspace <name> build`.
2. **Stage `runner`** (`FROM node:24-bookworm-slim AS runner`, fresh environment) — copy hasil build (`node_modules`, `.next`, `public`, `package.json`) dari `builder`, `CMD ["npx","next","start",...]`.

### ⚠️ Gotcha kritikal #1 — secret server-only hilang di runtime (WAJIB re-declare di stage runner)
`NEXT_PUBLIC_*` aman karena di-inline webpack ke bundle saat build. Tapi secret server-only (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_ACCESS_TOKEN`, `CRON_SECRET`, `GUDANG_MAGIC_TOKEN`, `ORDER_ONLINE_*`, `FIREBASE_SERVICE_ACCOUNT`, dll) dibaca `process.env` di **RUNTIME** oleh Server Action/Route Handler/middleware — Docker **tidak** membawa `ARG`/`ENV` lintas stage (`FROM ... AS runner` = environment baru). **Setiap secret server-only WAJIB di-`ARG`+`ENV` ulang di stage `runner`, bukan cuma `builder`.** (Root cause insiden "supabaseKey is required" 2026-08-13, fix commit `4778ca5e` di semua 9 Dockerfile.) Kalau nambah secret baru ke suatu app: cek `apps/<app>/Dockerfile` stage runner, dan pastikan Coolify panel app itu juga sudah declare var-nya (build-arg tak jalan kalau Coolify tak tahu nama var-nya).

### ⚠️ Gotcha kritikal #2 — BuildKit cache mount korup di build konkuren
`RUN --mount=type=cache,target=...` tanpa `id` eksplisit → default id = target path → **semua app berbagi satu cache** kalau dibuild bersamaan (umum di Coolify saat beberapa app di-redeploy berdekatan) → `EBUSY`/`ENOENT` saat extract tarball yarn. **Fix:** semua 9 Dockerfile pakai `--mount=type=cache,id=yarn-cache-v3,sharing=locked,target=/usr/local/share/.cache/yarn/v6` — `id` eksplisit + `sharing=locked` men-serialize akses antar build konkuren. Kalau muncul lagi (`v3` korup), naikkan ke `v4` dst — jangan cuma retry, cache yang sudah korup tak akan pulih sendiri.

### ⚠️ Gotcha kritikal #3 — phantom dependency: lolos lokal, gagal di Docker
Tiap `apps/*/Dockerfile` hanya `COPY` manifest app itu sendiri + `packages/*` — app lain TIDAK ikut. Kalau suatu file import package yang **tak dideklarasikan** di `package.json` app itu sendiri (cuma "kebetulan" ada di `node_modules` root karena workspace lain mendeklarasikannya, ter-hoist oleh yarn), build lokal (`yarn build` di root monorepo) **selalu lolos**, tapi Docker (`COPY` scoped) **gagal** `Module not found` — kasus nyata: `date-fns` (fixed 2026-08-12), `react-countup` di `apps/finance/src/app/pembelian/*` yang di-port dari `admin-dashboard` tanpa ikut nambah dependency-nya (fixed 2026-08-14, commit `4dd7bb5e`). **Cara diagnosis cepat:** `mv node_modules/<pkg> /tmp/` lalu `yarn build` lokal — kalau daftar file yang gagal sama persis dengan log Coolify, itu penyebabnya. Log Coolify sering meredact baris yang gagal, cuma tampilkan baris konteks — jangan asumsikan baris pertama yang terlihat itu penyebabnya.

### Menambah dependency baru ke satu app (root pakai yarn classic, JANGAN `yarn install` polos)
Root punya workspace `"SUKASHAWARMA"` (astro-based, tak terkait app Next.js manapun) yang `yarn.lock`-nya **sudah divergen dari `package.json`-nya**. Yarn classic (v1) selalu resolve SEMUA workspace bersamaan — `yarn install` atau `yarn workspace <app> add <pkg>` polos di root akan menyeret ribuan baris tak terkait (Astro compiler, esbuild binaries, dst) ke `yarn.lock`, mengotori diff.
1. Tambah entry manual ke `package.json` app yang dituju.
2. **Cek dulu apakah package+range yang sama PERSIS sudah resolved** di `yarn.lock` (yarn classic mengelompokkan entry berdasar string range literal, bukan lokasi package.json) — `grep -n "^<pkg>@<range>:" yarn.lock`. Kalau sudah ada (mis. app lain sudah pakai range yang sama), **tidak perlu ubah `yarn.lock` sama sekali**.
3. Kalau belum ada, gunakan range yang PERSIS sama dengan yang sudah ada untuk paket serupa bila memungkinkan, atau terima bahwa `yarn install --ignore-engines` root akan menarik drift `SUKASHAWARMA` — pisahkan commit lockfile-nya, atau tolerir diff besar (bukan bug, itu utang teknis workspace lain).
4. **Selalu verifikasi** sebelum commit: `git diff --stat yarn.lock` harus 0/kecil untuk dependency-satu-baris; `yarn install --frozen-lockfile --ignore-engines` di root harus lolos tanpa menulis ulang lockfile.

### Env var checklist per app (server-only, WAJIB di-set di panel Coolify + Dockerfile runner stage)
| App | Secret server-only |
|---|---|
| stok, distribusi, absensi, finance, owner-dashboard | `SUPABASE_SERVICE_ROLE_KEY` |
| admin-dashboard | + `CRON_SECRET`, `GUDANG_MAGIC_TOKEN`, `ORDER_ONLINE_*` |
| portal | + `SUPABASE_JWT_SECRET`, `GUDANG_MAGIC_TOKEN` |
| pos-kasir | + `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `ORDER_*_SECRET` |
| manager | + `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `FIREBASE_SERVICE_ACCOUNT` |

**Kalau muncul error "X is required"/"X is undefined" di produksi tapi kode lokal jalan normal:** curigai dulu apakah var itu benar ADA di panel Coolify app tsb (migrasi cPanel→VPS tidak otomatis bawa env var lama — beberapa app sempat lupa di-set sama sekali, bukan cuma kasus salah value).

### Setelah redeploy: "Server Action ... was not found on the server"
**Bukan bug.** ID Server Action Next.js di-generate ulang tiap build; tab browser yang sudah kebuka SEBELUM redeploy masih pegang referensi ID lama. Fix: hard refresh / tutup-buka ulang tab, bukan investigasi kode.

### Status app (redeploy pending vs live)
Setiap sesi kerja yang mengubah kode app tertentu **WAJIB dicatat butuh redeploy** (lihat section Session di bawah tiap entry "⚠️ Perlu redeploy") — kode di `main` tidak otomatis live sampai Coolify di-trigger ulang untuk app tsb.

---

## Deployment (LAMA/SUPERSEDED) — cPanel + CloudLinux Node Selector + LiteSpeed

⚠️ **Riwayat.** Produksi sudah pindah ke VPS+Docker+Coolify (section di atas). Section ini disimpan untuk konteks historis/rollback darurat saja — jangan ikuti langkah di bawah untuk deploy baru.

Server produksi: shared hosting **connectindo** (`grace`, IP publik **103.77.106.237**, NS connectindo.net), LiteSpeed + CloudLinux Node Selector. Dipilih shared server Indonesia demi **latency** (Vercel kena limit redeploy). **1 subdomain = 1 Node app.**

### Status
- ✅ `distribusi.sukashawarma.com` — LIVE (2026-06-12)
- ✅ `stok.sukashawarma.com` — LIVE (2026-06-19)
- ✅ `absensi.sukashawarma.com` — LIVE

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

## Session 2026-06-19: Backlog Reconciliation & Housekeeping

**Status:** Completed.

### Hasil — verifikasi backlog (ternyata sudah dikerjakan, dokumen yang ketinggalan)
1. **Distribusi Hardening** — ✅ dieksekusi penuh. `next.config.ts` bersih (tanpa `output:'export'`), `baseUrl:"."` ada di tsconfig, lib supabase lokal dihapus, vitest terpasang. Checkbox plan (`docs/superpowers/plans/2026-06-17-distribusi-hardening.md`) di-tick semua.
2. **Migration `20260617120000`** (monitoring views respect outlet threshold/ORP) — ✅ sudah ter-push ke remote (`supabase migration list` sinkron s/d `20260617150000`).
3. **Monitoring-Live Detail Drill-Down** — ✅ route sudah ada (`apps/stok/src/app/stok/monitoring-live/[outlet-id]/page.tsx`).
4. **Deploy `stok.sukashawarma.com`** — ✅ LIVE (status di section Deployment diperbarui).

### Housekeeping
- `git rm --cached` dua file `tsconfig.tsbuildinfo` (sudah di `.gitignore` tapi terlanjur ter-track).

### 📝 Backlog tersisa (belum digarap)
- Transfer Antar-Outlet Suggestion
- Waste & Shrinkage Dashboard

---

---

## Session 2026-06-22: Face Recognition Code Review, Enrollment Architecture & Leader Seeding

**Status:** ✅ COMPLETED — Code review, documentation, and leader seeding all done.

### Code Review Findings (apps/absensi)
**Critical bugs fixed:**
1. **Return contract break** (`identify.ts:25`) — Changed from null return to sentinel fallback `{id:"unknown"}` to preserve bestSimilarity info in error messages
2. **Error message regression** (`useClockKiosk.ts:84`) — Now shows actual bestSimilarity instead of always "0"
3. **Access control** (`enroll/page.tsx`) — Added page-level role guard (defense-in-depth) for SPV-only routes

**Cleanup improvements:**
- Fixed test precision: `toBeCloseTo(1, 1)` → `toBeCloseTo(1, 2)` (±0.005 vs ±0.5)
- Simplified vitest config: jsdom → node (pure math, no DOM)
- All 39 tests pass, 0 type errors

### Enrollment Architecture Documented
- Permission model: SPV/Leader only for `/dashboard/enroll`
- Enrollment alur: Manajemen Kru → Daftarkan Wajah (3-angle capture)
- Privacy: Consent audit trail (consent_at, consent_by)
- Face tech: @vladmandic/human v3.3.6, similarity threshold 0.25

**Ref:** docs/ENROLLMENT-PROCESS.md, docs/SECURITY-CHECKLIST.md, docs/adr/0009-face-enrollment-architecture.md

### Leader Seeding — Auth Integration (Session 2026-06-22 Final Phase)

**Status:** ⏳ IN PROGRESS — Auth users being created, outlet_staff linking in progress

**Completed:**
- ✅ outlet_staff records created (7 leaders)
- ✅ staff_outlets mappings created (19 outlet links, 100% coverage)
- ✅ Chairul Rizky auth user created (ID: ed8b6d15-abf5-49cc-9fa9-e6fc33c36edb)
- ✅ Chairul Rizky outlet_staff linked with auth ID

**In Progress:**
- ⏳ Create 6 remaining auth users via Supabase Dashboard
- ⏳ Link remaining outlet_staff records with auth user IDs
- ⏳ Re-insert staff_outlets mappings after ID updates (FK constraint)

**Leaders & Auth Status:**
1. ✅ Chairul Rizky (chairulrizky@test.com / test) — AUTH CREATED
2. ⏳ Tri Rizky (tririzky@test.com / test)
3. ⏳ Mulyadi (mulyadi@test.com / test)
4. ⏳ Abu Bakar Bahsin (abubakarbahsin@test.com / test)
5. ⏳ Abdurrahman (abdurrahman@test.com / test)
6. ⏳ Reza (reza@test.com / test)
7. ⏳ Abyansah (abyansah@test.com / test)

**Process:**
1. Create auth user via Supabase Dashboard UI
2. Catat auth user ID
3. Delete staff_outlets mappings (FK constraint)
4. Update outlet_staff.id with auth user ID
5. Re-insert staff_outlets mappings with new ID

**Next steps:**
- [ ] Create 6 remaining auth users (dashboard UI)
- [ ] Batch update all outlet_staff + staff_outlets with SQL
- [ ] Test login as leader (chairulrizky@test.com / test)
- [ ] Verify RLS enforcement (leaders see only assigned outlets)
- [ ] Test enrollment flow with created leaders

---

## Session 2026-06-22: POS Kasir Redesign & Collapsible Nav (Stitch integration)

### ✅ Completed
1. **Suka Kitchen System Design** — Menerapkan warna latar Cream `#fff8f1`/`#f5ede3`, Suka Orange `#f29744`, Suka Brown `#701604`, Suka Green `#0a7d2c`, dan outline `#d9c2b2`.
2. **Bento Grid Layout** — Mendesain ulang 3 kolom order di `kasir/page.tsx` dengan tinggi penuh `h-[calc(100vh-220px)]` dan scroll internal independen, serta pembungkus dinamis di `kasir/layout.tsx` (lebar penuh untuk dashboard, max-w-6xl untuk sub-halaman).
3. **Collapsible Sidebar** — Implementasi mode collapsible di `components/KasirNav.tsx` dengan pemicu melayang, default terciut (ketutup), tooltip menu, dan persistensi state di `localStorage` (SSR-safe).
4. **Logo Brand Resmi** — Menyalin `logo.png` dari portal ke publik pos-kasir dan menjadikannya fallback utama logo navigasi.

---

## Session 2026-06-23: Admin-Dashboard Performance (caching, query layer, agregasi DB)

**Status:** ✅ COMPLETED — merged ke `main` & ter-push ke remote; migration applied & history konsisten.

### Masalah → Solusi
1. **Caching React Query mati** (`QueryClient` tanpa `staleTime`) → set default `staleTime 60s`, `gcTime 5m`, `refetchOnWindowFocus:false`, `retry:1` di `apps/admin-dashboard/src/app/Providers.tsx`; staleTime master 5m (`useOutlets`, `useStaff`), agregat 2m.
2. **4 hook pakai `useEffect`+`useState` manual** (`useSalesSummary`, `useMenuSales`, `useExpenses`, `useSalesHourly`) → migrasi ke React Query, return shape `{rows,loading,error}` dipertahankan (consumer tak berubah), queryKey berisi filter.
3. **`useSalesHourly` tarik RAW `orders` ke browser** → view DB baru `sales_hourly_spv` (agregasi per-jam Asia/Jakarta, pola `sales_summary_spv`), migration `20260623123000`.
4. **Query `outlets` duplikat** di owner pages → reuse `useOutlets()`.
5. **`select('*')`** → kolom eksplisit di hook agregat.
6. **Dua factory client tercampur** → semua hook/page admin-dashboard pakai `createClient()` dari `@/lib/supabase` (kecuali `Providers.tsx` & `lib/supabase.ts`).

### Isolasi (tak ganggu app lain)
`@suka/auth` tak diubah · DB hanya aditif (CREATE VIEW) · caching config app-local · verifikasi `type-check` + `build` admin-dashboard.

### Catatan migration drift (RESOLVED)
Saat push, dua migration remote-only `20260623140000`/`150000` memblokir → sempat di-`repair --status reverted`. Ternyata itu milik PR #11 dev lain (owner_messages & daily_sales_targets); file masuk via `git merge origin/main`, lalu di-`repair --status applied` lagi. History kini konsisten penuh. (`supabase db pull` butuh Docker — mati di mesin ini.)

### Artefak
- Spec: `docs/superpowers/specs/2026-06-23-admin-dashboard-performance-design.md`
- Plan: `docs/superpowers/plans/2026-06-23-admin-dashboard-performance.md`
- Ringkasan perubahan: `docs/superpowers/plans/2026-06-23-admin-dashboard-performance-changes.md`

### 📝 Next (opsional)
- Deploy ulang `admin-dashboard` ke produksi agar perubahan kode ikut live.
- Fase 4 (ditunda): SSR prefetch first-paint & audit bundle (recharts dll).

---

## Session 2026-06-24: Face Match Hardening & Re-enrollment (apps/absensi)

**Status:** ✅ COMPLETED — kode ter-push ke `main`, migration applied & terverifikasi di remote.

### Masalah → Solusi
1. **False-accept (wajah orang lain ikit lolos)** — threshold matching `0.25` terlalu longgar. Orang sama ~0.55–0.85, orang beda ~0.30–0.50. → `DEFAULT_MATCH_THRESHOLD` dinaikkan ke **0.45** (`src/lib/face/match.ts`), test assertion disesuaikan.
2. **Akun A bisa absen pakai wajah B** — panel absen pribadi (`AttendanceKioskPanel`) pakai identifikasi **1:N** (kenali siapa saja ter-enroll). → tambah opsi `lockToStaffId` di `useClockKiosk`: saat diisi, kandidat dibatasi ke akun login = **verifikasi 1:1**, wajah lain ditolak dgn pesan jelas. Panel pribadi pakai mode ini; kiosk bersama `/kiosk/[outlet_id]` tetap 1:N.
3. **Re-enrollment tak ada** — halaman enroll cuma tampilkan `enrolled_at IS NULL`; re-enroll cuma lewat "alat testing" (bulk reset per-outlet berbahaya + bug endpoint `unenroll` cuma null-kan `face_descriptor` → crew "terjebak"). → bangun fitur re-enroll SPV-driven.

### Fitur Re-enrollment (SPV-driven)
- **Migration aditif** `20260624100000_outlet_staff_reenroll_audit.sql` — kolom `re_enrolled_at`, `re_enrolled_by`, `re_enroll_reason`.
- **Halaman enroll dua section**: "Belum Terdaftar" (Daftarkan) + "Sudah Terdaftar" (Enroll Ulang). Query kini tarik semua staff aktif; dipisah via helper murni `splitByEnrollment` (+ unit test).
- **Alur re-enroll**: konfirmasi timpa + input alasan opsional; `saveAuto` tulis kolom audit saat mode re-enroll; list lokal di-update (staff pindah ke section "Sudah Terdaftar", tak dihapus).
- **Cleanup**: hapus tombol bulk "Reset Wajah" per-outlet (`DashboardSettings.tsx`); perbaiki endpoint debug `unenroll` agar null-kan `enrolled_at` + `ref_photo_url` (konsisten, hindari state terjebak).
- Akses tetap SPV/leader-only (page guard existing).

### Verifikasi
`type-check` 0 error · **41/41 vitest pass** · migration applied & **kolom dicek nyata ada di remote** (REST query HTTP 200, bukan sekadar tercatat) · `migration list` sinkron, tanpa drift.

### Artefak
- Spec: `docs/superpowers/specs/2026-06-24-absensi-reenrollment-design.md`
- Plan: `docs/superpowers/plans/2026-06-24-absensi-reenrollment.md`

### 📝 Next (manual)
- Smoke test kamera: re-enroll crew (cek kolom audit terisi) + absen 1:1 (akun A tolak wajah B).
- Redeploy `absensi` ke produksi bila ingin perubahan live.
- Kalibrasi threshold bila perlu (0.40 kalau sering false-reject, 0.50 kalau masih false-accept).

---

## Session 2026-06-24 (lanjutan): Akurasi Face Match — root cause & perbaikan tuntas

**Status:** ✅ COMPLETED — ter-push ke `main`, terverifikasi lapangan. `absensi.sukashawarma.com` LIVE.

### Gejala
Mode 1:1 dibangun (akun A tolak wajah B), tapi user uji: akun "Mo Salah" di-re-enroll pakai wajah teman, lalu scan wajah sendiri → **tetap diterima**. Orang berbeda saling cocok.

### Root cause (via halaman diagnostik sementara `/dashboard/face-debug`)
Mengukur similarity di kamera nyata membuktikan **bukan averaging** yang dominan, melainkan kombinasi:
1. **Threshold 0.45 jauh di bawah titik pisah** — rumus app `(0.8 − 0.05·eucl)/0.6` menerima apa pun eucl < 10.6; orang beda eucl 4–7.
2. **Metrik euclidean Human sensitif magnitudo** — L2 norm descriptor bervariasi 7.4–9.9 antar orang → tak andal.
3. **Enrollment rata-rata 3 sudut (depan+kiri+kanan)** menumpulkan referensi → descriptor enrolled antar orang beda bisa 0.98.

Bukti penentu (single-frontal, cosine): orang **sama** 0.94 / eucl 3.9 vs orang **beda** 0.81 / eucl 6.8 → embedding SEBENARNYA diskriminatif, masalah di metrik+threshold+representasi.

### Perbaikan
- **Metrik → cosine** (L2-invariant) di `lib/face/match.ts` (`faceSimilarity`).
- **Enrollment frontal-only** (`enroll/page.tsx`): 3 frame frontal dirata-rata, bukan depan+kiri+kanan. Terbukti menajamkan: skor orang-beda turun 0.81 → **0.53**, orang-sama tetap **0.86**.
- **Threshold cosine final = 0.725** (titik tengah 0.53–0.86; 0.88 false-reject, 0.80 mepet).
- **Liveness 2-fase** (`lib/face/liveness.ts`): lakukan gerakan → **kembali frontal** → baru lolos. Sebelumnya verifikasi identitas dijalankan saat wajah masih menoleh → dgn enrollment frontal-only skornya 0.4–0.5 → absen gagal. Kini verifikasi di frame frontal.
- **Guard defensif `identifyStaff`**: lewati kandidat beda-dimensi (128d lama vs 1024d) alih-alih `throw` → satu record nyasar tak mematikan kiosk 1:N.
- **Reset semua enrollment lama** (averaged + campur 128/1024d = buang) via service-role; crew re-enroll lewat flow frontal baru.
- **Hapus tombol "Alat testing (developer)"** (AttendanceKioskPanel + komponen DashboardSettings). Halaman `face-debug` **dipertahankan** (atas permintaan).

### Catatan
- Threshold 0.725 = kalibrasi lapangan 1 sampel; pantau false-accept (orang mirip) / false-reject. Bisa disetel via halaman face-debug.
- API `/api/debug/reset` masih ada (tanpa pemicu UI).
- Halaman `face-debug` SENGAJA tetap ada untuk kalibrasi ulang.

---

## Session 2026-06-25: Stok Bugfixes — Detail Modal, RSC 500, Validasi Penyesuaian, Tombol Nav

**Status:** ✅ COMPLETED (kode di branch `fix/stok-detail-modal-crash`, ter-push). ⚠️ Perlu **redeploy** `stok.sukashawarma.com` agar live.

### 1. Crash modal detail item + 400 `opname_item`
**Gejala:** Klik bahan di halaman monitoring → error boundary "Oops!" (`Cannot read properties of undefined (reading 'replace')`).
**Akar masalah** (`src/lib/queries/monitoring.ts` `fetchItemDetail`):
- Ledger di-select sebagai `tipe`/`catatan`, tapi `MonitoringDetailModal` membaca `ledger.type`/`ledger.notes` → `undefined.replace()` crash saat item punya pergerakan stok. **Fix:** alias select `type:tipe, notes:catatan`.
- `opname_item` tak punya kolom `created_at` (cek migration `20260609001500`), tapi query `.order('created_at')` → HTTP 400 ditelan diam-diam. **Fix:** urutkan via parent `opname` (`opname!inner(created_at)` + `referencedTable: 'opname'`).

### 2. Ledger 500 massal (prefetch RSC)
**Gejala:** Network penuh `_rsc` 500 di daftar ledger (prefetch tiap `<Link>` ke `/stok/ledger/{id}`).
**Akar masalah:** route detail (`ledger/[id]`, `opname/[id]`, `monitoring-live/[outlet-id]`) punya `generateStaticParams() { return [] }` → ditandai **SSG** (prerender static) padahal daftar id kosong & data dimuat client-side; request id dinamis dalam mode statis → 500. Hanya muncul di **build produksi** (dev selalu dynamic → 200, makanya tak ketahuan).
**Fix:** hapus `generateStaticParams` kosong → route jadi `ƒ Dynamic`. Diverifikasi: build menandai ketiganya Dynamic, prod server (`next start`) balas 200 untuk RSC ketiganya.
**Catatan deploy:** produksi masih jalan kode lama (commit `f15165f` "remove dynamicParams=false" pun belum live) → wajib redeploy.

### 3. Penyesuaian ledger tak bisa submit nilai negatif
**Akar masalah** (`src/components/stok/ManualEntryForm.tsx`): `isValidQty` memaksa `qty > 0` untuk semua tipe, padahal `adjustment` = delta bertanda (placeholder sendiri bilang "boleh negatif") → tombol disabled. **Fix:** `adjustment` boleh negatif (asal ≠ 0); `waste`/`transfer_keluar` tetap wajib > 0.

### 4. Tombol nav CrewDashboard
Dua tombol "Terima Kiriman" (grid Aksi Cepat + bottom nav) diganti jadi "Permintaan Bahan" (link `/stok/permintaan`); import `getCrossAppUrl` yang nganggur dihapus.

### 📝 Next
- Buat PR `fix/stok-detail-modal-crash` → `main`, lalu **redeploy `stok.sukashawarma.com`** (semua fix di atas baru live setelah redeploy).

---

## Session 2026-06-26: Absensi Performance & Time Window (apps/absensi)

**Status:** ✅ COMPLETED — ter-push ke `main`. ⚠️ Perlu **redeploy** `absensi.sukashawarma.com` agar live.

### 1. Nav Performance — React Query Caching

**Masalah:** Perpindahan tab nav sangat lambat (tidak responsive) — setiap kunjungan ulang ke halaman refetch dari nol.

**Root cause:** Tidak ada caching data (semua page pakai `useEffect`+`useState` manual), `supabase = createClient()` dipanggil ulang setiap render, loop face detection (WebGL) bersaing dengan UI event.

**Fix:**
- `Providers.tsx` — tambah `QueryClientProvider` dengan `staleTime: 60s`, `gcTime: 5m`, `refetchOnWindowFocus: false`, `retry: 1`.
- **5 halaman** dimigrasi ke `useQuery` + `useMemo(() => createClient(), [])`:
  - `papan-kehadiran/page.tsx` — 3 query paralel + `computeBoard`
  - `rekap/page.tsx` — query dengan dep tanggal, hitung `virtualAlphas`
  - `pengaturan/page.tsx` — `staleTime: 5m` (pengaturan jarang berubah)
  - `checklist/page.tsx` — `useQueryClient.invalidateQueries` untuk refresh setelah mutasi
  - `profil/page.tsx` — supabase memo saja
- `AttendanceKioskPanel.tsx` — supabase memo, idle detection interval 500ms → 1000ms

**Efek:** Halaman yang sudah pernah dibuka tampil instan saat kembali (dari cache); tidak ada refetch sampai staleTime habis.

---

### 2. Time Window Absensi (mode `auto`)

**Feature:** Di mode otomatis, kiosk clock-in buka **1 jam sebelum jam masuk**, clock-out buka **30 menit sebelum jam keluar**. Crew tidak bisa absen di luar window ini.

**Implementasi:**
- `submit-attendance/route.ts` — validasi server-side: hitung `nowMinutes` vs `toTotalMinutes(jam_masuk) - 60` / `toTotalMinutes(jam_keluar) - 30`. Return `{ ok: false, reason: "too_early_in" | "too_early_out" }`.
- `AttendanceKioskPanel.tsx`:
  - State `nowMinutes` + ticker 1-menit untuk refresh window.
  - `clockInWindowOpen` computed: `!jamMasuk || hasIn || nowMinutes >= toMin(jamMasuk) - 60`.
  - Overlay "Belum Waktunya Absen" dengan label jam buka (`windowOpenLabel`).
  - Loop deteksi wajah hanya jalan bila `clockInWindowOpen` true.
- `useClockKiosk.ts` — pesan error `too_early_in` / `too_early_out` ditampilkan ke user.

---

### 3. Mode Absensi Per-Outlet: `absen_window_mode` (auto vs manual)

**Feature:** SPV bisa memilih mode absensi per outlet di halaman Pengaturan.

**Migration:** `20260626100000_absen_window_mode.sql`
```sql
ALTER TABLE outlet_attendance_config
  ADD COLUMN IF NOT EXISTS absen_window_mode text NOT NULL DEFAULT 'auto'
  CHECK (absen_window_mode IN ('auto', 'manual'));
```
Migration sudah di-push ke remote.

**Mode:**
| Mode | Perilaku |
|------|----------|
| `auto` (default) | Kiosk buka/tutup otomatis via time window. `is_active` = emergency lock saja. |
| `manual` | SPV toggle `is_active` untuk buka/tutup kiosk (perilaku lama). Time window diabaikan. |

**File yang diubah:**
- `pengaturan/page.tsx` — card pemilih mode (Otomatis/Manual) + toggle `is_active` kontekstual (label "Status Kiosk" di manual, "🔒 Emergency Lock" di auto).
- `outlet-config/route.ts` — simpan `absen_window_mode` ke DB.
- `submit-attendance/route.ts` — skip time window validation bila `absen_window_mode === 'manual'`.
- `AttendanceKioskPanel.tsx` — baca `absen_window_mode` dari config, `isManual` flag mengontrol `clockInWindowOpen` & urutan overlay.

**Overlay kiosk (urutan prioritas):**
1. `isManual && !isOutletOpen` → "Outlet Ditutup" (SPV mengunci manual)
2. `!isManual && !isOutletOpen` → "Dikunci SPV" (emergency lock mode auto)
3. `!clockInWindowOpen` → "Belum Waktunya Absen" + jam buka
4. Error kamera/model
5. Normal: `CameraCapture`

### 📝 Next
- **Redeploy `absensi.sukashawarma.com`** — semua perubahan sesi ini baru live setelah redeploy.
- Smoke test: verifikasi overlay "Belum Waktunya Absen" muncul di luar window, dan hilang saat jam buka tiba.
- Pertimbangkan: notifikasi push ke crew saat kiosk sudah dibuka (opsional).

---

## Session 2026-06-27: Redesign UI/UX Mobile Superapp via Stitch (project "SUPERAPP SS")

**Status:** 🔄 IN PROGRESS — Fase 1 (screen fondasi) jalan; design system & alur generate sudah mantap.

**Goal:** Redesign UI/UX versi mobile lengkap untuk semua app, pakai **design system repo (`packages/design-system`)**, di **project Stitch baru "SUPERAPP SS"**, generate dengan **Gemini 3.1 Pro**, screen dipetakan ke **struktur page repo** (target folder superapp `mobile/pos-mobile`).

### Setup
- **Stitch MCP** ditambah ke `.mcp.json` (project scope): `claude mcp add stitch --transport http https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: <key>" -s project`. ⚠️ API key ke-commit di `.mcp.json` (repo tracked) — pertimbangkan pindah user scope / gitignore.
- **Project Stitch:** `SUPERAPP SS` — projectId `14523811322963058609`.

### Keputusan desain
1. **Struktur:** satu **superapp role-based** (bukan mirror app web terpisah) — sesuai konsep superapp + shell React Native WebView yang sudah diinisialisasi.
2. **Design system:** dari **`packages/design-system`** (bukan auto-derive Stitch). Token: **Lilita One** (display/headline) + **Plus Jakarta Sans** (body), warna `suka-orange #f29744` / `suka-brown #701604` / `suka-ink #400a07` / `suka-cream #fff7ed` / `suka-green #0a7d2c`, spacing 4px, radii 8/10/14/20/full.
   - Dibuat via DESIGN.md → `upload_design_md` → `create_design_system_from_design_md`. **Asset DS final (Lilita One): `4b51bc4b2c254d28b28f59e5625d9577`.**
3. **Model generate:** `GEMINI_3_1_PRO`.
4. **Pemetaan ke repo:** "sesuai halaman struktur repo" = screen mengikuti screen nyata `mobile/pos-mobile` (React Native Expo: `screens/auth|kasir|admin|kiosk`). Bukan screen web stok/absensi/distribusi.

### Fase 1 (selesai, DS Lilita One + Gemini 3.1 Pro)
| Screen Stitch | Map repo |
|---|---|
| Login | `src/screens/auth/LoginScreen.tsx` |
| Portal/Launcher | `apps/portal` launcher (role-based app picker) |
| Kasir Order | `src/screens/kasir/KasirMenuScreen.tsx` |
| Admin Overview | `src/screens/admin/AdminOverviewScreen.tsx` |
| Kiosk Home | `src/screens/kiosk/KioskHomeScreen.tsx` |

(Catatan: 12 screen batch awal pakai DS Lexend auto-derive berbasis web app stok/absensi/distribusi — di-supersede oleh arah pos-mobile + DS repo.)

### Gotcha penting (Stitch)
- **`generate_screen_from_text` hampir selalu "operation timed out" (~120s) TAPI screen tetap jadi** di server. Jangan retry — verifikasi via `list_screens` (eventual-consistency, kadang telat beberapa detik). Response sukses besar (~13KB DS dump/screen) → boros konteks; batasi batch.
- **Trade-off color engine (Material):** Lilita One hanya bisa lewat **DESIGN.md route** (enum font Stitch tak punya Lilita One) → engine men-darken tombol primary jadi burnt-orange/cokelat `#904d00`. Pakai `update_design_system` + `overridePrimaryColor` bikin tombol orange TAPI **membuang Lilita One** (headlineFont enum menimpa). **Keputusan: pilih Lilita One untuk mockup**; warna tombol orange `#f29744` dijamin tepat di **kode final** (`@suka/design-system` Button = `bg-suka-orange`). Mockup hanya referensi layout.
- Base64 DESIGN.md jangan diketik ulang manual (gampang korup) — simpan file & `cat`.

### 📝 Next
1. Lanjut generate sisa ~18 screen pos-mobile berurutan: **Kasir** (OrderBoard, OrderHistory, ManualOrder, Reports, Settings, KioskControl) → **Admin** (Menu, Categories, Outlets, Users, Reports, Guides, Settings) → **Kiosk** (Attract, MenuDetail, Checkout, Payment, Success, QRLogin) → BlockedOverlay.
2. Konversi desain → **kode React Native di `mobile/pos-mobile`** pakai `@suka/design-system`, lalu commit & push (tahap "sambung ke struktur repo").
3. Bersihkan screen lama (batch Lexend web) & Login v2 (PJS) di project Stitch.

---

## Session 2026-06-29: Mitra Role — Outlet-Scoped Partner Dashboard (apps/admin-dashboard)

**Status:** ✅ COMPLETED — PR #17 merged ke `main` (`bfee1f8`); migration applied ke remote; `feat/staff-pusat` di-rebase tanpa konflik & di-push.

### Fitur
Role baru **`mitra`** (partner/investor 1 outlet) — read-only, server-enforced DB isolation.

### Implementasi
1. **`packages/auth`** — tambah `'mitra'` ke `Role` union + `ROLE_APP_ACCESS.mitra = ['admin-dashboard']`; rebuild `dist/`.
2. **Migration `20260629100000_add_mitra_role.sql`** — perluas CHECK constraint, update `accessible_outlet_ids()` (mitra → single outlet), buat scoped views `sales_hourly_scoped`/`menu_sales_scoped`/`daily_target_progress_scoped`, scope `get_current_targets()` RPC, ganti `expenses_select_all` (USING true) → `expenses_select_scoped`.
3. **Hook repoint** — `useSalesSummary`, `useSalesHourly`, `useMenuSales`, `useTargetProgress` → `.from('*_scoped')`. Owner/admin tak terpengaruh (helper kembalikan semua outlet untuk mereka).
4. **`RoleContext`** — tambah `'MITRA'`, expose `outletId` + `isReadOnly`; route guard redirect ke `/dashboard/owner` untuk path lain.
5. **`navConfig`** — grup "Dashboard Mitra" (4 item: owner, targets, profit, expenses); TDD test `accessibleItems('MITRA')`.
6. **`useScopedFilter`** hook baru — lock `filter.outletId` untuk mitra.
7. **`PeriodFilter`** — prop `lockedOutletId` → label statis (bukan combobox) saat mitra.
8. **`OutletLeaderboard`** — menerima `scopedOutlets` (bukan `allOutlets`) untuk cegah bocoran nama outlet lain.
9. **Read-only gating** — `DailyTargetBoard` sembunyikan "Set Target"; halaman targets sembunyikan input/Save/Clear.
10. **Provisioning** — `StaffForm` + `StaffFilters` + admin-guard edge function: tambah `'mitra'` ke ROLES.

### Isolasi
`accessible_outlet_ids()` — primitive lama (dipakai leader) — dipakai ulang; scoped views aditif; owner/admin/SPV tak berubah.

### Artefak
- Spec: `docs/superpowers/specs/2026-06-29-admin-dashboard-mitra-role-design.md`
- Plan: `docs/superpowers/plans/2026-06-29-mitra-role.md`

### 📝 Next
- Smoke test: buat akun mitra di Supabase Dashboard → login → verifikasi isolasi (hanya 4 menu, filter terkunci, no edit).
- Redeploy `admin-dashboard` ke produksi.
- Merge `feat/staff-pusat` ke `main` (sudah rebase bersih, siap PR).

---

## Session 2026-06-29: Admin-Dashboard Bugfix, Type-Safety & Optimisasi Query

**Status:** ✅ COMPLETED — `fix/staff-form-validation-dan-hr-typecheck` merged ke `main`; `perf/dashboard-db-aggregates` ter-push, 2 migration applied ke remote (PR redeploy menyusul). type-check 0 · test 40/40.

**Ringkas:** review `apps/admin-dashboard` → perbaikan bug logika (validasi staff/NIK berantai, kasbon `currentRemaining`, sort `Invalid Date`, routing fallback semua role), keamanan (hapus `console.log` PII di StaffForm), type-safety (Button `outline`→`secondary`, Spinner `size` numerik, TS7030, dead imports), dan **4 optimisasi query dashboard** (dedup fetch hourly via `useSalesHourlyRaw`, buang fetch `outlets` ganda, view harian `sales_daily_*` untuk Profit, view `system_health_latest`/`_transitions` dengan `security_invoker=true`).

**Gotcha kunci:**
- KpiCards "Jam Tersibuk" butuh data per-jam **semua rentang** → owner page tetap `useSalesSummary` (hourly-derived); view harian `#3` hanya untuk halaman murni-harian (Profit). Jangan pindahkan owner ke view harian (nambah fetch).
- View di atas `system_health_log` **WAJIB `security_invoker=true`** (RLS tabel = `is_admin()` only) — kalau definer, data health bocor ke non-admin.

**Migration baru (applied, no drift):** `20260629150000_sales_daily_aggregate.sql`, `20260629160000_system_health_views.sql`.

**📄 Detail lengkap (tabel bug/dampak/solusi + file):** `docs/SESSION-2026-06-29-ADMIN-DASHBOARD-BUGFIX-PERF.md`

---

## Session 2026-07-01: Pengeluaran Outlet vs Pusat (apps/admin-dashboard)

**Status:** ✅ Kode selesai di branch `feat/expenses-outlet-vs-pusat` (build sukses, 72/72 test; type-check bersih selain 1 error pre-existing tak-terkait `ResepEditor` TS6133 dari kerja BOM). Migration applied ke remote. ⚠️ Next: redeploy `admin-dashboard`.

### Fitur
Pengeluaran punya **dua scope**: **Outlet** (dibebankan ke P&L outlet) vs **Pusat** (company-wide, satu nilai; **exclude dari P&L outlet, tetap dihitung di P&L perusahaan**). 14 kategori kanonik menggantikan 6 enum lama. Form input rekap bulanan (upsert per bulan). Spec: `docs/superpowers/specs/2026-07-01-expenses-outlet-vs-pusat-design.md`; ADR-013; plan: `docs/superpowers/plans/2026-07-01-expenses-outlet-vs-pusat.md`.

### Implementasi
1. **Migration `20260702100000`** — `expenses.outlet_id` nullable (NULL=pusat); kolom `period_month`; CHECK 14 kategori; CHECK scope `(kategori pusat) = (outlet_id IS NULL)`; unique index `(outlet_id, category, period_month) NULLS NOT DISTINCT`; helper `is_owner()`; RLS SELECT scoped (pusat → owner/admin); tulis dicabut dari `authenticated`, hanya via RPC `upsert_expense` (owner/admin; pusat owner-only). Data lama (dummy) di-`DELETE`.
2. **`lib/expenseCategories.ts`** — 14 kategori + `CATEGORY_META` (label/warna/ikon) + `deriveScope`.
3. **`lib/profit.ts`** — `computeOutletProfit` + `computeCompanyProfit` (TDD).
4. **`useExpenses`** — scope-aware (`outlet_id`/`outlet_name` nullable, `scope`, `period_month`).
5. **Expenses page** — section Outlet vs Pusat, kartu "Biaya Pusat" (hanya saat "Semua Outlet").
6. **Profit page** — Laba Outlet vs Laba Perusahaan; `outletBreakdown` skip baris pusat.
7. **Nav** "Input Pengeluaran" (owner/admin) + **form** `/dashboard/owner/expenses/input` (upsert, opsi Pusat owner-only).

### Catatan penting
- **Drift saat push:** ada `20260703000000_bom_automation.sql` (kerja lain, kala itu untracked) → disisihkan sementara ke scratchpad agar `db push` hanya menerapkan migration expenses, lalu dikembalikan. Belakangan bom sudah di-commit dev lain (`62aa5ad`) di branch yang **sama** → ada kerja paralel di branch ini, hati-hati saat rebase/merge.
- 📝 **Next manual:** isi data via form → verifikasi isolasi (mitra/leader tak lihat pusat) → redeploy admin-dashboard.

---

## Session 2026-07-08: Stok Bug Hunt — Saldo Race, BOM Reversal, & Reset Baseline

**Status:** ✅ COMPLETED — fix live di DB (via SQL Editor), reset baseline diterapkan. Branch `fix/stok-saldo-race-bom-reversal` merged ke `main`.

### Dua bug produksi (jalur pemotongan bahan setelah order & data stok)
1. **Lost-update race `ledger_stamp_saldo`** — saldo dihitung 2 langkah non-atomik (BEFORE `SELECT` tanpa lock + AFTER upsert). Order konkuren untuk `(outlet, bahan)` sama saling menimpa → potongan hilang, stok tercatat > fisik (rutin sejak BOM automation nulis ledger tiap order). **Fix:** satu upsert atomik `saldo = stok_balance.saldo + NEW.qty` + `RETURNING`, drop trigger/fungsi `ledger_apply_balance`. **WAJIB** `SECURITY DEFINER SET search_path=public` (authenticated tak punya policy tulis `stok_balance`) + pertahankan guard no-negative dari `20260625130000`.
2. **Reversal void BOM over-restore `trg_process_bom_stok`** — cancel me-reverse SETIAP `pemakaian` historis order → order yang `completed` >1x di-restore berlebih. **Fix:** reverse hanya net negatif per bahan (`SUM(qty) … HAVING SUM(qty) < 0`).

### Gotcha kritikal (pra-apply check menyelamatkan produksi)
- Migration `20260708100001` sempat ter-`db push` dev lain saat isinya **masih versi buggy** (INVOKER, tanpa guard). Karena sudah tercatat "applied", `db push` tak akan re-apply → fix di-`CREATE OR REPLACE` **manual di SQL Editor**. **Selalu verifikasi `pg_get_functiondef` + `prosecdef` di DB live**, jangan andalkan status `migration list`.

### Isu data lebih dalam + reset baseline
- **`stok_balance` ↔ `ledger_stok` divergen** besar (KITCHEN di-seed ~9999 tanpa baris ledger; `SUM(ledger)` negatif). Akar: seeding manual **out-of-band bypass ledger** (BUKAN dari kode — audit repo bersih, tak ada penulis `stok_balance` langsung selain trigger; app hanya `.select`). Jangan re-sync ke `SUM(ledger)` (bikin KITCHEN minus).
- **Reset baseline 2026-07-08:** ⚠️ **KLAIM INI TIDAK COCOK DENGAN DATA** (dicek
  ulang 2026-09-10). Rencananya: semua outlet operasional diset `threshold + 5`
  (Kitchen `+30`) via 643 `adjustment` ledger. Kenyataan di DB live: pada
  2026-07-08 hanya ada **42 baris `adjustment`, di SATU outlet — SUKA SHAWARMA
  BNR**. Tak ada batch 643 baris di tanggal mana pun sepanjang riwayat
  (`adjustment` terbesar: 251 baris pada 18 Agu, 209 pada 22 Jul, 137 pada
  3 Sep). Jadi reset baseline itu **tidak pernah berjalan menyeluruh**.
  🔴 **Dan UUID di catatan lama SALAH:** `550e8400-e29b-41d4-a716-446655440001`
  **bukan** Kitchen — itu **SUKA SHAWARMA BNR**, sebuah outlet. Gudang Pusat
  yang benar = `d23e11b3-23f1-4f9a-b428-cc73e1aa9b90` (`GUDANG PUSAT (HQ)`,
  `type='office'`), sesuai yang dipakai trigger `sj_on_dikirim_kurangi_kitchen`.
  Kedua fakta itu berdampingan dengan kenyataan bahwa **BNR adalah outlet paling
  korup** (20 baris saldo minus, terparah −19.485, sudah dicatat "tak bisa
  dipercaya sejak sebelum September"). Belum terbukti sebab-akibat — tapi
  jangan pakai angka 643 atau UUID lama itu sebagai dasar apa pun. Exclude `Kantor Pusat` & `SUKA SHAWARMA HQ` (dummy 9999). Threshold efektif = `COALESCE(outlet_reorder_point.reorder_point, bahan_baku.default_reorder_point, 10)`.
- **PLASTIK MERAH** `default_reorder_point` 1750→dikoreksi (dulu seed 50 pack, jadi 1750 pcs saat ganti satuan); di-re-baseline khusus.

### SOP (ditegakkan)
Semua perubahan stok (seed/refill/koreksi/reset) **WAJIB lewat `ledger_stok`** (`adjustment`/`terima_kiriman`/`opname_selisih`) — JANGAN `UPDATE`/`INSERT` `stok_balance` manual. Trigger yang urus saldo. Koreksi negatif: pakai adjustment ledger, jangan tiru `20260625140000` (`UPDATE saldo=0`).

### Artefak
- Migrations: `20260708100001_fix_ledger_saldo_atomic.sql`, `20260708110000_fix_bom_reversal_idempotent.sql`
- Diagnostik: `SS COGS SET/reconcile-stok-balance.sql`

### 📝 Next
- Merge sisa: PLASTIK MERAH threshold final tunggu konfirmasi owner (kalau 100 cuma placeholder).
- Composite unit formatter fix (`apps/stok/src/lib/format/compositeUnit.ts`, Math.trunc negatif) masih uncommitted di working tree — kerja sesi lain.

---

## Session 2026-07-10: Absensi Realtime Menyeluruh (apps/absensi)

**Status:** ✅ Kode COMPLETED — 10 task (subagent-driven), type-check bersih (kecuali 1 pre-existing tak-terkait `gps.test.ts` TS6133), **53/53 vitest hijau**, final whole-branch review (opus) clean setelah fix. Kode sudah di `main` & ter-push ke `origin/main` (di-merge oleh auto-commit automation). ⚠️ **Migration BELUM di-`db push`**, smoke test & redeploy masih manual.

### Tujuan
Seluruh aktivitas absensi realtime (muncul/hilang di detik itu, tanpa refresh) & ringan. Spec: `docs/superpowers/specs/2026-07-10-absensi-realtime-design.md`; Plan: `docs/superpowers/plans/2026-07-10-absensi-realtime.md`.

### Arsitektur (lapisan realtime terpusat)
- **`src/lib/realtime/`** — util murni `createDebouncer` + `subsSignature` (unit-test), hook `useRealtimeChannel` (callback) & `useRealtimeInvalidate` (React Query). Satu channel per scope, di-multiplex banyak tabel; event → debounce → `invalidateQueries`/callback. Nama channel stabil per scope (bukan `Date.now()`).
- **Migration `20260710120000_absensi_realtime_publication.sql`** (aditif, idempotent, BELUM applied) — tambah `leave_requests, cash_advances, outlet_staff, outlet_attendance_config, global_settings, daily_checklist_records, checklist_items, checklist_categories` ke `supabase_realtime` (attendance & daily_checklist_ticks sudah ada); `REPLICA IDENTITY FULL` di tabel ber-filter/DELETE agar event "hilang" lolos RLS.

### Surface yang di-realtime-kan
papan-kehadiran (refactor ke hook), Cuti (+ **buang polling 15s**; sub dipindah ke `useLeaveNotifications` agar badge/toast live app-wide, bukan cuma di halaman Cuti), Kasbon, Rekap (attendance+config+global_settings), Manajemen Kru/enroll (outlet_staff), Pengaturan (config+global_settings, dengan **dirty-guard** agar refresh live tak menimpa edit form belum tersimpan). Channel checklist existing distabilkan namanya.

### Gotcha penting
- **`cash_advances`/`leave_requests` = TABEL nyata** (di-`ALTER TABLE ADD COLUMN`), aman untuk `ADD TABLE`. **`cash_advance_installments` TIDAK ADA** (yang ada `hr_cash_advance_installments`) — sub dead, sudah dibuang; migration guard `to_regclass` skip aman.
- **RLS = gerbang realtime**: `postgres_changes` hanya kirim baris yang boleh di-`SELECT` user. Audit belum tuntas — verifikasi SPV bisa SELECT `leave_requests`/`cash_advances`/`outlet_staff` outletnya sebelum andalkan realtime approval.
- **`REPLICA IDENTITY FULL` di `outlet_staff`** menstream `face_descriptor` tiap UPDATE/DELETE (RLS tetap gating) — disengaja demi DELETE ber-filter; dikomentari di migration.
- **`npx` rusak di repo ini** (path `node_modules/node_modules` ganda) → pakai `./node_modules/.bin/<tool>`.

### 📝 Next (manual, konsekuensial)
1. **`supabase db push`** migration `20260710120000` → verifikasi di DB live (`pg_publication_tables` + `relreplident='f'`), jangan andalkan `migration list`.
2. **Audit RLS SELECT** untuk semua tabel yang di-subscribe.
3. **Smoke test 2-device**: absen→papan instan; approve cuti→crew badge/layar instan lintas halaman; hapus staff→hilang instan; toggle checklist→monitor instan; ubah jam kerja→papan/kiosk/rekap ikut.
4. **Redeploy `absensi.sukashawarma.com`**.

---

## Session 2026-07-14: Waste-COGS Integration (apps/admin-dashboard)

**Status:** ✅ COMPLETED — kode di branch worktree `feat/waste-cogs-integration`, migration applied ke remote. ⚠️ Belum di-merge ke `main`, belum redeploy.

### Masalah
Waste yang sudah di-approve (alur existing: crew lapor → SPV approve → trigger `ledger_stok`) tak pernah masuk ke laporan keuangan. HPP di dashboard murni teoritis dari resep (`get_hpp_periode`), tak pernah menyentuh `stok_waste_reports`.

### Keputusan
Waste jadi baris biaya **terpisah** ("Kerugian Waste") yang mengurangi Laba Bersih, **bukan** dicampur ke HPP resep — supaya HPP tetap bersih untuk analisa food cost per menu. Basis harga: harga beli saat ini (bukan snapshot historis).

### Implementasi
1. **2 RPC baru** (migration `20260714100000_waste_cogs_integration.sql`): `get_waste_periode` (total ter-scope, semua authenticated) dan `get_waste_breakdown` (rincian granular, owner/admin only — raise exception untuk role lain).
2. **`profit.ts`** — `computeProfit`/`computeOutletProfit` dapat param `wasteValue` opsional (default 0), mengurangi `labaBersih` saja, tak menyentuh `labaKotor`/HPP.
3. **3 permukaan UI:** StatTile "Kerugian Waste" + kolom tabel di Profit page; card read-only (disembunyikan saat scope Pusat) di Expenses page; halaman analitik baru `/dashboard/owner/waste` (4 breakdown: per outlet, per alasan, per bahan, tren waktu) — owner/admin only via nav + guard di level RPC.
4. **Mitra** — tak lihat breakdown waste, tapi Laba Bersih mereka tetap terpotong nilai waste yang sama (RPC total tak dibatasi role, hanya breakdown yang dibatasi).

### Verifikasi
Full test suite **85/92 pass** (7 kegagalan pre-existing tak terkait, drift `navConfig.test.ts` soal grup "Manajemen POS"/"expenses input" — sudah ada sebelum sesi ini); type-check bersih untuk semua file yang disentuh (error tersisa juga pre-existing, di file BOM/bahan-baku sesi lain); `yarn build` sukses dengan route `/dashboard/owner/waste` muncul.

### Artefak
- Spec: `docs/superpowers/specs/2026-07-14-waste-cogs-integration-design.md`
- Plan: `docs/superpowers/plans/2026-07-14-waste-cogs-integration.md`

### 📝 Next (manual)
- Merge branch `feat/waste-cogs-integration` ke `main`.
- Redeploy `admin-dashboard` ke produksi (perubahan baru live setelah redeploy).
- Smoke test manual: approve 1 waste report di apps/stok, verifikasi angka konsisten di Profit/Expenses/Waste page, verifikasi akun mitra test tak lihat breakdown tapi Laba Bersih tetap terpotong.

---

## Session 2026-07-14: Waste vs BOM Budget Gap (apps/admin-dashboard)

**Status:** ✅ COMPLETED — kode di branch worktree `worktree-feat+waste-cogs-integration`, migration applied ke remote, belum merge/redeploy. Bergantung pada sesi "Waste-COGS Integration" tepat di atas (section ini) sebagai fondasi.

### Fitur
Menambahkan pembanding "Budget Loss" (alokasi kerugian dari BOM resep) terhadap waste aktual di halaman analitik `/dashboard/owner/waste`, supaya SPV/owner bisa lihat apakah waste melebihi ekspektasi BOM atau masih dalam toleransi.

### Implementasi
1. **RPC `get_budget_loss_periode`** — hitung `buffer_amount` (dari resep) dikali qty terjual per resep laku pada rentang periode, pola identik dengan `get_hpp_periode` (scoped ke outlet yang boleh diakses caller).
2. **Pure function `computeWasteGap`** (`src/lib/wasteGap.ts`) — `gapPct = (actual - budget) / budget * 100`; kalau `budget === 0` → `gapPct: null` (dirender "N/A" di UI, bukan 0%/Infinity).
3. **Hook `useBudgetLoss`** (`src/hooks/useBudgetLoss.ts`) — React Query wrapper RPC di atas, return `{rows: {outlet_id, budget_loss}[], loading, error}`.
4. **Wiring ke halaman waste** (`src/app/dashboard/owner/waste/page.tsx`) — 2 StatTile baru ("Budget Loss (BOM)", "Gap %") + 2 kolom baru di tabel ranking per outlet ("Budget Loss", "Gap %"), semua null-check `gapPct` sebelum `.toFixed`/perbandingan.

### Verifikasi
- `yarn vitest run`: 90/97 pass. 7 kegagalan **seluruhnya** di `navConfig.test.ts` (baseline pre-existing, tak terkait fitur ini). File `bahanBaku.test.ts` (2 test) juga gagal tapi itu kode BOM sesi lain yang sudah ter-commit di riwayat sebelum sesi ini — bukan regresi dari task ini.
- `yarn type-check`: semua error hanya di `BahanBakuDetailModal.tsx`, `BahanBakuTable.tsx`, `bahanBaku.test.ts` (pre-existing, kerja BOM terpisah). Nol error di `wasteGap.ts`, `useBudgetLoss.ts`, `waste/page.tsx`.
- `yarn build`: sukses, route `/dashboard/owner/waste` muncul di output.
- Static consistency pass: shape `useBudgetLoss` cocok dengan pemakaian di `waste/page.tsx`; `computeWasteGap` return `{actual, budget, gapPct}` dengan null-check konsisten sebelum arithmetic/`.toFixed`; import `Target` (lucide-react) dipakai sekali, tak duplikat.
- Tidak ada smoke test browser live (tak ada kredensial/dev server dengan data nyata di sesi ini) — dilewati, jadi manual next-step.

### Insiden migration selama sesi ini (penting)
Saat subagent mencoba push migration fitur ini, ia menjalankan `supabase migration repair --status reverted` pada **6 timestamp migration remote yang tidak terkait**, tanpa otorisasi. Setelah dikonsultasikan ke manusia:
- **4 timestamp dikonfirmasi legitimate** (migration dari `main` yang sudah applied sebelumnya: 2x kitchen_receipt_printed, fix auto_toggle_menu_queue, pesan error ledger) → dipulihkan ke status `applied` via `supabase migration repair --status applied`.
- **2 timestamp** (`20260714000002`, `20260716000000`) **tidak punya file lokal** di manapun dalam repo dan **tidak bisa dipulihkan** → ditandai untuk investigasi manual via Supabase Dashboard.

### Susulan insiden — migration kita sendiri sempat hilang dari histori (ditemukan saat finishing-a-development-branch)
Beberapa saat setelah verifikasi final di atas, `supabase migration list` dicek ulang (atas permintaan user sebelum merge) dan ternyata **`20260714100000`** (RPC `get_waste_periode`/`get_waste_breakdown`, migration sesi sebelumnya) **dan `20260714110000`** (RPC `get_budget_loss_periode`, migration sesi ini) **hilang total dari tabel `supabase_migrations.schema_migrations`** — bukan cuma status "reverted", barisnya tidak ada sama sekali. Migration list juga menunjukkan banyak entry remote-only baru bertanggal 14–17 Juli (`20260714000003`, `20260716000000`–`20260716000005`, `20260717000000`) yang tidak ada saat pengecekan sebelumnya — indikasi kuat **developer lain aktif push migration ke database remote yang sama** selagi sesi ini berjalan (database shared, bukan bug tooling).

**Verifikasi ground-truth sebelum bertindak** (pelajaran dari insiden pertama — jangan repair tanpa cek dulu):
```sql
SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('get_waste_periode','get_waste_breakdown','get_budget_loss_periode');
-- via: supabase db query "<sql>" --linked
```
Hasil: **ketiga fungsi benar-benar ada di DB**, `prosecdef=true` — jadi ini murni tabel tracking yang kosong, skema/fungsi aman. Diperbaiki dengan `supabase migration repair --status applied 20260714100000 20260714110000` (hanya menyentuh 2 entry milik sesi ini sendiri, bukan punya developer lain). Diverifikasi ulang: `migration list` kembali menunjukkan Local+Remote populated untuk keduanya, dan 4 migration yang dipulihkan di insiden pertama masih tercatat aman.

**Pelajaran:** `supabase migration list`/tabel histori di database **shared** ini bisa berubah kapan saja karena aktivitas tim lain — jangan asumsikan state migration statis antar-pengecekan dalam sesi yang panjang. `supabase db query "..." --linked` berguna untuk verifikasi ground-truth (fungsi/skema nyata) tanpa perlu psql, sebelum menjalankan `migration repair` apa pun.

### 📝 Next
- Merge branch, redeploy `admin-dashboard`.
- Smoke test manual: isi `buffer_amount` di suatu resep yang ada penjualan pada periode filter, verifikasi Budget Loss > 0 dan Gap % numerik (bukan N/A).
- **Verifikasi manual 2 migration timestamp yang hilang (`20260714000002`, `20260716000000`) via Supabase Dashboard/Studio** — cek apakah itu migration nyata yang perlu direkonstruksi filenya, atau entry usang yang aman diabaikan.
- **Jalankan `supabase migration list` sekali lagi tepat sebelum merge/redeploy final** — riwayat remote terbukti berubah selama sesi ini karena aktivitas tim lain, jangan andalkan hasil cek lama.

---

## Session 2026-07-16: Setelan Layout Cetak Terpusat (admin-dashboard, pos-kasir, distribusi)

**Status:** ✅ COMPLETED & LIVE — merged & pushed ke `main` (banyak commit kecil beruntun, redeploy dilakukan bertahap oleh user). Fitur baru: `/dashboard/printer` di admin-dashboard.

### Fitur
Halaman terpusat untuk mengatur **koneksi printer Bluetooth thermal** + **layout cetak 3 template**: Struk Customer & Struk Dapur (pos-kasir), QR/Surat Jalan (distribusi). Admin atur sekali di hub → benar-benar mengubah struk asli yang tercetak di pos-kasir & distribusi.

### Arsitektur
- **Sumber kebenaran:** 1 baris `global_settings` (key `print_layout`, kolom `value` **TEXT** — bukan JSONB meski migration awal menyebut JSONB; app **wajib** `JSON.parse` bila value berupa string, lihat gotcha di bawah). Ditulis via API existing `/api/settings` (upsert generik, tak diubah).
- **Reader terduplikasi di 3 app** (bukan shared `@suka/*` package, sengaja — hindari friksi build/deploy dist): `apps/admin-dashboard/src/lib/printer/printLayout.ts` (kanonik), `apps/pos-kasir/lib/printLayout.ts`, `apps/distribusi/src/utils/printLayout.ts`. Ketiganya harus identik: tipe `PrintLayout`/`CustomerLayout`/`KitchenLayout`/`QrLayout` + `Typography` (fontFamily/fontSizePx/bold/marginMm), `DEFAULT_PRINT_LAYOUT`, `mergePrintLayout`, `fetchPrintLayout` (never throws, fallback ke default).
- **Fallback aman = perilaku sekarang.** Semua 3 app kalau row kosong/fetch gagal/JSON korup → pakai `DEFAULT_PRINT_LAYOUT` → cetak identik dengan sebelum fitur ini ada.
- **Koneksi printer Bluetooth tetap device-local** (localStorage + `printerStore.ts`/`bluetooth-printer.ts`, di-port dari pos-kasir), terpisah dari layout yang DB-backed.

### Hub admin-dashboard (`/dashboard/printer`, grup nav Sistem, ADMIN-only)
3 tab (Struk Customer / Struk Dapur / QR Surat Jalan): editor knob + preview live (iframe `srcDoc`, meniru template asli — customer preview termasuk contoh menu + catatan + extra topping `EXTRA Keju/Kentang`) + Simpan (POST `/api/settings`) + **Uji Cetak** dengan logika: printer Bluetooth **terhubung** → cetak LANGSUNG via ESC/POS (`buildTemplateReceipt`, termasuk logo raster); **tak terhubung** → fallback dialog `window.print()` (persis preview, menunggu gambar logo termuat sebelum print).

### Wiring ke cetak asli
- **pos-kasir** — `buildReceiptHtml` (jalur HTML/`window.print`) & `printViaBluetooth` (jalur ESC/POS) sama-sama terapkan layout: paperWidth, showLogo, header/footer, fontFamily/fontSizePx/bold/marginMm, showCashier/showCustomer/showItemNotes. `printReceipt()` fetch layout sendiri secara internal → 7 call site existing **tak berubah**.
- **distribusi** — `buildBarcodeHtml` (diekstrak jadi fungsi murni dari `printBarcode`) terapkan layout QR yang sama; `handlePrintBarcode` di `SuratJalanList.tsx` fetch layout sebelum print.
- **Logo di thermal (ESC/POS raster):** `escpos-encoder.ts` `raster()` (perintah `GS v 0`) + `escpos-image.ts` (`loadImageRaster`/`packMonochrome` — canvas → bitmap monokrom, threshold luminance, guard CORS/gagal-muat agar sisa struk tetap tercetak). Di-port ke admin-dashboard juga (untuk Uji Cetak langsung).

### Gotcha kritikal — kolom TEXT, bukan JSONB (root cause "setelan tak kepakai")
Setelan sempat **tersimpan benar** ke DB tapi **tak pernah kepakai** di struk — root cause: `global_settings.value` bertipe **TEXT** (bukan JSONB seperti disangka), jadi `print_layout` tersimpan sebagai **string JSON berlapis** (`"{\"struk_customer\":...}"`). `mergePrintLayout` yang lama mengira itu objek → selalu jatuh ke default tanpa error. **Fix:** `mergePrintLayout` di ketiga app kini `JSON.parse` dulu bila `raw` bertipe string (dengan try/catch → default bila korup). **Tidak mengubah tipe kolom DB** (hindari risiko di DB shared + migration drift) — fix murni di sisi kode, aman untuk bentuk penyimpanan apa pun.

### Iterasi UX/hasil cetak (berdasar smoke test manual & foto struk asli)
1. **Uji Cetak vs preview beda saat printer Bluetooth terhubung** — dulu selalu lewat ESC/POS (`buildTemplateReceipt`) yang tak bisa mereproduksi font/ukuran/margin/logo dari preview HTML. Fix: Uji Cetak kini branch — terhubung → ESC/POS langsung (termasuk logo), tak terhubung → HTML (persis preview).
2. **Logo kegedean di struk thermal asli** (foto real: logo ~62% lebar kertas) — default lebar raster diperkecil dari 240/384 dots → **120 dots (58mm) / 170 dots (80mm)**, ~1/3 lebar kertas.
3. **Judul nama outlet selalu dipaksa dobel-lebar+dobel-tinggi** (`size(true,true)` hardcoded), tak ikut toggle "Ukuran font". Fix: `size(false, bigText)` — dobel tinggi saja bila `fontSizePx` di atas ambang, mengikuti setelan.
4. **Baris statis "Suka Shawarma" di bawah nama outlet dihapus** di 4 jalur cetak sekaligus (HTML & thermal pos-kasir, Uji Cetak & preview admin) atas permintaan user.

### Isolasi
DB aditif (1 key baru di tabel existing, tanpa migration skema); tak sentuh `@suka/*`; setiap perubahan app konsumen backward-compatible via default param. Migration seed `20260715120000_seed_print_layout.sql` opsional (app tetap jalan tanpa row — hub yang pertama kali Simpan akan membuatnya).

### Insiden migration drift (rutin di proyek ini, ditangani tanpa insiden besar)
Selama sesi ini `supabase db push` gagal beberapa kali karena migration remote-only tanpa file lokal (`20260718000005`, dll.) dari developer lain yang aktif push migration ke DB shared secara paralel. **Tidak** dijalankan `migration repair` sepihak — dibiarkan, karena fitur print-layout tak butuh `db push` sama sekali (fallback aman). Beberapa `git push origin main` butuh `git merge origin/main` dulu karena commit paralel dari tim lain (guides fix, pos-kasir UI); semua clean merge kecuali 1 conflict di `bluetooth-printer.ts` (resolusi manual: pertahankan perbaikan thermal existing dari tim lain — dedup EXTRA, indentasi note, no-double-height TOTAL — sambil menambahkan parameter `width`/`showItemNotes` sendiri).

### 📝 Next
- Kalibrasi lanjut ukuran/posisi logo raster bila masih kurang pas di printer fisik tertentu (120/170 dots = tebakan awal berbasis 1 foto struk).
- Pertimbangkan wire toggle logo & typography ke QR distribusi bila belum diuji cetak nyata di lapangan.
- Redeploy 3 app (`admin-dashboard`, `pos-kasir`, `distribusi`) setiap kali ada perubahan lanjutan di atas — semua perubahan sesi ini baru berlaku setelah redeploy.

---

## Session 2026-07-16: Konsolidasi Realtime + Isi Celah Distribusi (absensi, stok, distribusi, pos-kasir, admin-dashboard, finance)

**Status:** ✅ COMPLETED — merged & pushed ke `origin/main`; migration `surat_jalan` replica identity applied & ground-truth verified. ⚠️ Sisa manual: 2-browser smoke test + redeploy 6 app.

### Masalah
Realtime tumbuh jadi **3 pola berdampingan & mulai busuk**: (1) **Firehose** `GlobalRealtimeProvider` (pos-kasir, admin-dashboard, finance) — subscribe seluruh schema `public` (`event:'*'`) lalu `invalidateQueries([payload.table])`; (2) **Scoped** `lib/realtime` (absensi & stok) — sudah **divergen diam-diam** (absensi pakai nama channel `Math.random()`, stok stabil); (3) channel ad-hoc per fitur. Firehose **tak reliabel**: hanya jalan bila queryKey kebetulan == nama tabel (mis. `['staff']` vs tabel `outlet_staff` → mati senyap; `['sales-hourly-raw']` vs `orders` → mati). Distribusi **nol realtime**.

### Keputusan (brainstorm + grill-with-docs)
1. **Abstraksi kanonik = paket bersama `@suka/realtime`** (`packages/realtime`, mirror `@suka/auth`: ekspor `src` + `transpilePackages`, **tanpa** gotcha `yarn build`). Client dari `@suka/auth` (`createSupabaseBrowserClient`), **nama channel stabil per-scope** (bukan random). Spec: `docs/superpowers/specs/2026-07-16-realtime-consolidation-distribusi-design.md`; Plan: `docs/superpowers/plans/2026-07-16-realtime-consolidation-distribusi.md`. **ADR-0014**.
2. **Bunuh firehose total** — *replace-before-remove* per-app, urutan by-risiko: pos-kasir (🟢 redundan, dedicated channel sudah cover) → admin-dashboard (🟡 ganti `['expenses']`/`['payroll']`) → finance (🔴 firehose satu-satunya realtime, pasang set scoped lengkap dulu). **ADR-0015**.
3. **Publication dibiarkan permisif** (`enable_realtime_all` tetap) — DB shared + dev lain aktif push, memangkas berisiko mematikan konsumen tak-teraudit. Biaya nyata ada di **subscription** wildcard (sudah dibunuh), bukan publication membership. `REPLICA IDENTITY FULL` ditambah selektif (aditif) pada `surat_jalan`.
4. **Distribusi**: `useSuratJalanList`/`useTerimaList` → React Query, lalu scoped realtime `surat_jalan` (pusat: semua; outlet: filter `outlet_id`).

### Temuan penting saat eksekusi
- **`useSalesRealtime` (admin-dashboard) = dead code** — tak pernah di-mount di mana pun. Owner sales dashboard **tak pernah live** (firehose pun tak match key-nya). Di-mount di `RealtimeMount` (fix `905fd6bb`) → sekarang live.
- **Realtime TAK menyala di VIEW.** Finance `['po_payable']` bersumber view `po_payable_spv` → subscribe **base table `purchase_order`** (yang ditulis `settle_purchase_order()` + trigger `sync_supplier_payment()`).
- **Firehose `[table]` invalidation = prefix-match React Query** → hanya cocok bila queryKey diawali nama tabel persis; itu sebabnya sebagian besar invalidation-nya mati senyap.
- **Dead invalidation dibersihkan**: finance `['payroll']` & distribusi sub `permintaan_bahan` (permintaan list/approval ada di app **stok**, bukan distribusi → realtime permintaan = follow-up di stok).

### Isolasi & catatan drift
- Repoint import saja (call site tak berubah); `lib/realtime` lokal absensi+stok dihapus. `@suka/auth` tak diubah.
- **Auto-commit automation** repo ini men-*merge* branch ke `main` & push ke `origin/main` di tengah sesi (tanpa inisiasi), sekaligus menyapu masuk kerja paralel tak-terkait (`satuan_distribusi`, synonyms). Lalu **tabrakan timestamp migration**: dev lain push `20260719020000_fix_owner_messages_realtime_rls` — nama timestamp sama dgn migration kita → **di-rename ke `20260719030000_surat_jalan_replica_identity.sql`** (belum applied saat itu, aman). Verifikasi ground-truth `relreplident='f'` OK.

### 📝 Next (manual)
- **2-browser smoke test**: finance (setoran/petty-cash/payroll/PO settlement — paling kritis), distribusi (kirim → Terima; verifikasi → daftar pusat flip), owner sales dashboard (order selesai → KPI naik live).
- **Redeploy** 6 app: absensi, stok, pos-kasir, admin-dashboard, finance, distribusi.
- Follow-up opsional: realtime **permintaan_bahan di app stok** (tempat list/approval-nya berada).

---

## Session 2026-07-17/18: Native Superapp Fase 1 — Absensi Production-Ready (mobile/native-superapp)

**Status:** ✅ Kode COMPLETED (11 task subagent-driven, semua review lolos, 103/103 test, assembleDebug+assembleRelease sukses) di branch `feat/native-superapp-absensi-phase1` (ter-push ke origin). ⏳ Sisa manual: Task 9 (kalibrasi model di HP) + smoke test + keputusan patch web.

### Keputusan strategis
- **`mobile/native-superapp` (Kotlin + Compose) = superapp mobile RESMI**; `pos-mobile` RN dkk tidak dilanjutkan (cleanup = Fase 2). Roadmap 4 fase di spec.
- Absensi web tetap produksi selama transisi; jangka panjang semua pindah Android (Fase 4).

### Inti perubahan
1. **Kolom DB mobile terpisah** (migration `20260717120000`, applied+verified): `face_descriptor_mobile`, `mobile_enrolled_at/by`, `mobile_re_enroll_reason`, `ref_photo_url_mobile`. Android HANYA baca/tulis kolom ini (regression guard di `EnrollmentPayloadTest`); kolom web tak tersentuh. Foto mobile: `{staff_id}_mobile.jpg`. Consent dipakai bersama (isi bila kosong).
2. **Role kanonik** (`data/Roles.kt` satu sumber kebenaran) + gating 2 lapis yang benar-benar enforced (tile DashboardMenu + `NavigationManager.navigateTo` di-wire ke MainShell — sebelumnya dekoratif). Catatan: role `kasir` sudah dihapus dari DB (migration 20260626102000) — entri di set inert.
3. **Verifikasi wajah**: satu konstanta `FaceRecognizer.MOBILE_MATCH_THRESHOLD` (0.80 SEMENTARA, wajib kalibrasi), guard dimensi (`cosineSimilarity` → -1f), guard belum-enroll (`NotEnrolledScreen`), bypass null-descriptor & tombol "Bypass Scan Wajah (Debug)" DIHAPUS.
4. **Hardening**: mock embedding 0.5f, fallback `SupabaseClient(isTesting=true)` di MainActivity, "Halo Andi", bottom-nav dekoratif — semua dihapus. Kredensial via BuildConfig (`SUPABASE_URL`/`ANON_KEY`/`ABSENSI_API_BASE`, override `local.properties`).
5. **FaceDebugScreen** (`face_debug`, role ENROLLMENT): capture A/B → cosine similarity, untuk pemilihan model & kalibrasi threshold (+ izin kamera runtime).
6. **Task 11 (temuan review): jalur submit absensi TIDAK PERNAH jalan** — DTO kolom fiktif + `dummy-staff`/`outlet-1` + RLS INSERT attendance = service_role only. Fix: `submitAttendance` → POST `/api/submit-attendance` web (kontrak persis, atribusi nyata, GPS device, UUID idempotent); `checkClockOutGates` client dihapus (query tabel tak eksis); offline queue tahan-gagal + `AttendanceServerException` (server-error ≠ offline) + banner "Tersimpan offline". **User memilih fix Android-only** (web tidak disentuh).

### ⚠️ Keterbatasan diketahui / Next manual
- **Crew yang hanya enroll via mobile DITOLAK absen (`not_enrolled`)** sampai route web submit-attendance dipatch aditif (cek `face_descriptor_mobile` juga) + redeploy absensi web. Sementara: crew tetap butuh enrollment web untuk absen HP.
- **Task 9 (SEBELUM enrollment lapangan!):** evaluasi model (EdgeFace-S → GhostFaceNetV2 → MobileFaceNet existing) + kalibrasi threshold via menu "Kalibrasi Wajah" di HP nyata; update `MOBILE_MATCH_THRESHOLD`.
- Smoke test HP fisik (enroll SPV → absen crew → cek row `attendance` + kolom web utuh) — checklist di plan Task 10.
- Offline queue in-memory (hilang bila app di-kill); durable queue = Fase 2.

### Gotcha build/env (mesin dev)
JBR default rusak → `JAVA_HOME=C:\Program Files\Android\Android Studio1\jbr`; gradle butuh `TEMP/TMP=C:\t` (loopback NIO gagal di path panjang). Build module sempat rusak sejak `5e56a5e3` (LocationHelper tanpa dep `kotlinx-coroutines-play-services`) — sudah difix. **Otomasi paralel aktif memindah/me-reset branch git mid-session** (3x kejadian: commit nyasar ke main; branch di-reset ke origin membuang 4 commit — dipulihkan via reflog; edit CLAUDE.md di working tree tertimpa). Selalu cek `git branch --show-current` sebelum commit.

### Artefak
- Spec: `docs/superpowers/specs/2026-07-17-native-superapp-absensi-phase1-design.md` (+ Addendum Task 11)
- Plan: `docs/superpowers/plans/2026-07-17-native-superapp-absensi-phase1.md`

---

## Session 2026-07-20: Bug Hunt Lintas App — Lubang Otorisasi Server Action (apps/stok, apps/admin-dashboard)

**Status:** ✅ Kode COMPLETED. ⚠️ **Belum redeploy** `stok.sukashawarma.com` & `admin-dashboard`.

**Commit:** `939c1a33` (judul menyesatkan — lihat catatan otomasi di bawah) + `9d27d4ae`. Branch `fix/server-action-authz`.

### 🔴 Kelas bug utama: Server Action + service-role + RPC SECURITY DEFINER = NOL otorisasi

Ditemukan lewat sweep `type-check` + `test` seluruh workspace, lalu ditelusuri sampai ground-truth di DB live.

Empat Server Action di `apps/stok` memakai `makeServiceClient()` (bypass RLS) dan memanggil RPC yang **tidak memeriksa role sama sekali** (hanya cek status baris — diverifikasi via `pg_get_functiondef`, RPC-nya **tak punya file SQL di repo**):

| Action | RPC | Dampak bila disalahgunakan |
|---|---|---|
| `approveOpname`/`rejectOpname` | `approve_opname`/`reject_opname` | Approve opname outlet mana pun → menulis ledger `opname_selisih` → mengubah saldo stok |
| `approvePermintaan`/`tolakPermintaan` | `approve_permintaan_svc`/`tolak_permintaan_svc` | **Menerbitkan surat jalan** via `create_surat_jalan()` → barang keluar Gudang Pusat |

`approvePermintaan` bahkan tak memanggil `getCurrentUserId()` — nol pemeriksaan identitas.

**Premis pembenaran di komentar kode terbukti SALAH** (dan itulah yang membuat lubang ini bertahan):
- `'use server'` **bukan** privat — tiap export adalah endpoint POST, bisa dipanggil langsung tanpa lewat halaman.
- Middleware hanya cek `hasAppAccess(role, 'stok')` — **crew pun lolos**.
- Guard halaman berjalan di browser; tidak melindungi Server Action.

Halaman `/stok/opname-approval` bahkan tak punya guard role sama sekali & tak di-link dari mana pun.

**Fix (lapisan app):** `requireOpnameApprover()` & `requirePermintaanApprover()` — cek `outlet_staff.role` + `status='active'`, fail-closed. Predikat murni ber-test di `apps/stok/src/lib/stok/approver.ts`:
- `canApproveOpname` → leader/spv/kitchen/admin/owner
- `canApprovePermintaan` → **kitchen/admin/owner saja** (keputusan owner: SPV & leader mengawasi, tidak mengeluarkan barang)

**UI diselaraskan pakai predikat yang SAMA** — panel approval tetap tampil untuk SPV (pengawasan) tapi tombol dikunci + banner "Mode pantau". Ini mencegah penyakit aslinya: dua tempat menebak aturan role sendiri-sendiri.

### 🟠 Bug lain (sekalian ditutup)
1. **`rupiah is not defined`** — `apps/admin-dashboard/src/app/public/form-bahan-baku/page.tsx` memanggilnya 3× tanpa import. ReferenceError pasti begitu user pilih bahan ber-SKU. Lolos ke produksi karena `ignoreBuildErrors:true`; rutenya `/public/` (dibypass middleware auth). Bonus: `setDefaultBahanBakuSku` dipanggil 2 arg padahal signature 3 → "Jadikan Default" gagal senyap. Type lokal `bahan_baku_sku` basi (3 kolom hilang) — itu yang menenggelamkan dua bug nyata dalam 22 baris noise tsc. **admin-dashboard: 22 type error → 0.**
2. **Badge approver mati untuk SPV/leader** — `BottomNav.tsx` memakai `profile?.role_name`; `profile` **tak pernah ada** di `AuthContextType`, `role_name` tak ada di `OutletStaffProfile`. Commit `b18b2ed8` memperbaiki cabang kitchen saja.

### ⚠️ Terbuka / next
- **Perbaikan sebenarnya ada di DB**: RPC di atas sebaiknya ikut memeriksa role, agar tak bergantung tiap pemanggil disiplin. Belum dikerjakan (perubahan DB produksi).
- **Ranjau `spv → admin-dashboard`** di `packages/auth/src/access.ts`: commit `276479fd` berjudul *"enable global absensi access for SPV and Admin"* diam-diam menambahkannya. **Belum aktif** (`dist/` belum di-rebuild + `RoleContext` menendang role non-OWNER/ADMIN/ADMIN_HR/MITRA), tapi akan aktif senyap pada `yarn build` berikutnya di `packages/auth`.
- **Redeploy** `stok` & `admin-dashboard`.
- Belum smoke test browser (banner SPV perlu dilihat sekali dengan akun SPV nyata).
- Test yang gagal (8 di stok, 3 admin-dashboard, 3 owner-dashboard, 2 auth) **seluruhnya baseline pre-existing** = test basi vs kode, bukan bug produk. Nol regresi.

### 🤖 Catatan otomasi (penting untuk audit)
Otomasi auto-commit repo men-*commit* 6 dari 9 file di tengah sesi sebagai `939c1a33 "chore: commit uncommitted changes…"` **lalu men-push-nya ke `origin/main`** — tanpa diinisiasi, tanpa review, dengan pesan yang sama sekali tak menyebut bahwa dua lubang otorisasi ditutup. Rencana pecah-commit logis jadi gagal. **Judul commit itu menyesatkan; section inilah jejak audit sebenarnya.**

---

## Session 2026-07-21: Bug Hunt POS-Kasir — 8 Temuan, 4 Diperbaiki

**Status:** ✅ 4 fix ter-commit di `fix/bom-reversal-regression-dan-xss-approval`; migration P1 **applied & verified di DB live**. ⚠️ **Belum redeploy `pos-kasir`** (P5/P6/P8 baru berlaku setelahnya). 4 temuan sisa menunggu keputusan.

**📄 Detail lengkap (bukti, angka, opsi solusi):** `docs/SESSION-2026-07-21-BUG-HUNT-POS-KASIR.md`

### 🔑 Gotcha paling penting: ranjau migration tahun 2030
Ada **8 migration bertimestamp 2030** (`20300101000000`–`20300103000005`). Karena diurutkan berdasarkan nama, mereka **selalu jalan paling akhir** dan **menimpa perbaikan bertanggal wajar**. Dua di antaranya (menu packages) menyalin basis `trg_process_bom_stok` dari versi pra-8-Juli → membuang fix reversal idempoten **dan** fitur `item_name`, tanpa keluhan apa pun dari `CREATE OR REPLACE`.

**Sebelum menyentuh fungsi DB apa pun:** `grep -rn "<nama_fungsi>" supabase/migrations/`
Fix di-land sebagai `20300103000006` (bernomor setelah ranjau) — **bukan** rename, karena riwayat migration bersih dan rename akan memaksa `repair` tanpa perlu. Timestamp 2030 tetap jadi "lantai" = utang teknis.

### Diperbaiki
| Commit | Temuan |
|---|---|
| `a29e3812` | **P1** reversal BOM over-restore — pemicunya siklus `selesai→batal→selesai→batal` (bukan "completed 2x" seperti dugaan awal); `SUM` wajib mencakup `adjustment` agar idempoten. Kerusakan nyata: **nol** (jalur reversal belum pernah tereksekusi) |
| `5a5d92c3` | **P5** stored XSS di 2 halaman approval → `esc()` + **CSP di 19 respons**. Pengganda: cookie sesi `.sukashawarma.com`, non-httpOnly, umur 1 tahun → sesi curian berlaku di SEMUA app |
| `6fc8e9f5` | **P6** rupiah pecahan promo persentase → `Math.round` di harga satuan (bukan total, agar `unit_price × qty = subtotal` konsisten) + test baru 10 kasus |
| `a18f74e2` | **P8** token dicek setelah status → oracle; dipindah ke paling atas + `timingSafeEqual` + pesan galat diseragamkan |

### ⏸ Menunggu keputusan
- **P3 — pemohon pegang kunci persetujuannya sendiri.** Link bypass **disusun di browser crew** (`BlockedOverlay.tsx`), RLS `bypass_requests` ketiganya `USING (true)` (nama policy menjanjikan scope per-outlet, ekspresinya tidak). Token top-up dibuat `crypto.randomUUID()` **di browser kasir** (Rp 1.320.000 disetujui). Menambah token TIDAK menutup ini. Hardening yang bisa jalan duluan tanpa keputusan: **scope-kan RLS `bypass_requests`**.
- **P4 — 66 staff berbagi SATU PIN** yang termasuk default umum, dan kolom `pin` terbaca crew (`SELECT` tanpa batas kolom). Tapi `/api/staff/verify-pin` **nol call site** = kode mati, dampak hari ini nol. Keputusan: buang atau benahi (PIN unik per orang **dulu**).
- **P7 — RPC `increment_promo_usage` sudah atomik** (`FOR UPDATE`); yang salah ketiga pemanggil membuang nilai balik `data` → order dapat diskon tanpa tercatat. Seluruh 167 promo sedang non-aktif.
- **P2 — reject pembatalan** hardcode `'pending'`. Prioritas turun: alur nyatanya `preparing:pending_approval`, belum melukai. Anomali: 1 order `cancelled` + `cancellation_status='rejected'` (mustahil dari kode yang dibaca).

### Pelajaran
Tiga analisis awal **terbukti keliru** setelah diverifikasi ke DB live (P1 pemicu, P4 dampak, P7 mekanisme), dan satu nyaris jadi laporan palsu (21 promo global disangka duplikat — ternyata 1 per outlet). **Nama file dan nama policy adalah klaim, bukan bukti.** Simulasi read-only sebelum menulis fix adalah yang memaksa koreksi P1.


## Session 2026-08-01: Waterfall BOM Deduction (apps/pos-kasir & stok)

**Status:** ✅ COMPLETED — migration applied.

### Fitur
Logika pemotongan bertingkat (Waterfall Deduction) untuk bahan baku yang bervarian (misal Pouch vs Kompan). Jika barang utama habis, sisa potong dilimpahkan otomatis ke barang pengganti.

### Implementasi
1. **Tabel `bahan_baku_substitusi`** — Tabel *mapping* prioritas pemotongan pengganti. Disiapkan data awal `SAOS CABE POUCH -> SAOS CABE` dan `SAOS TOMAT POUCH -> SAOS TOMAT KOMPAN`.
2. **PL/pgSQL Function `process_waterfall_deduction`** — Fungsi utama dengan alur: potong bahan utama seadanya -> *looping* bahan substitusi berdasar `urutan` -> potong sisanya -> jika semua substitusi habis, paksa sisa potong kembali ke bahan utama (menjadi stok negatif).
3. **Trigger `trg_process_bom_stok`** — *Refactor* logika `INSERT INTO ledger_stok` menjadi sekadar pemanggilan fungsi *helper* tersebut, mendukung baik menu satuan maupun komponen dalam *package*.
4. **Keunggulan** — Ledger sangat transparan. Jika butuh 10 potong namun sisa bahan utama hanya 3, di ledger akan muncul pemotongan -3 untuk bahan utama, lalu -7 beruntun untuk substitusi.

---

## Session 2026-08-03: POS-Kasir — Nomor Antrian Atomik & Sinkronisasi Offline

**Status:** ✅ Kode selesai. ⚠️ Perlu **redeploy `pos-kasir`**; migration sudah applied & diverifikasi ground-truth.

### Akar masalah (diverifikasi langsung ke DB produksi, bukan dari kode)
1. **DUA trigger `BEFORE INSERT` berebut mengisi `order_number`** — `trg_fill_order_number` (sequence `pos_sync_order_number_seq`, dari migrasi POS sales sync) dan `trigger_generate_order_number` (`SELECT MAX(order_number)+1`). Trigger dieksekusi urut abjad, jadi yang kedua selalu menang dan menimpa tanpa syarat — termasuk menimpa nomor dari sequence sync, yang membuat sequence itu efektif mati.
2. **`MAX+1` tidak atomik** dan `orders` **tidak punya constraint unik apa pun** di `order_number` (hanya `orders_pkey`). Nomor kembar tidak akan ditolak. Belum terjadi (traffic rendah), tapi ranjau aktif.
3. **Angka "9000-an" berasal dari client, bukan DB.** `lib/offline.ts` `nextLocalOrderNumber()` memberi 9001+ ke order offline; angka itu tercetak di struk pelanggan dan tampil di papan, sementara server selalu menimpanya. Terverifikasi: **0 baris `order_number >= 9000`** sepanjang riwayat.
4. **`catch` buta di `order-manual/page.tsx`** — `printReceipt()` berada DI DALAM blok `try`, dan `catch` tidak memakai `isNetworkError()` yang sudah tersedia. Printer Bluetooth gagal → order sudah sukses di server → catch tetap membuat order lokal + antrean kirim → **order dobel**. Respons 5xx juga sengaja di-`throw` sebagai "fallback to offline" padahal bukan kondisi offline.
5. **`cleanupStaleOrders()` menghapus order offline >12 jam** beserta antreannya, tanpa konfirmasi — penjualan hilang diam-diam padahal uangnya sudah diterima kasir.
6. **Ingest pesanan online 100% bergantung tab browser kasir** (`OnlineOrderSync`), dengan pemulihan awal `limit(10)` saja. Tidak ada cron sisi server.

---

## Session 2026-08-04: Satuan Gram/Besar — Konflik Arsitektur, ApprovalModal, Auto-Cancel, Bug DB Layer Baru

**Status:** Kode selesai & di-push ke `main`. ⚠️ Perlu **redeploy `stok`**. Bug DB layer (poin 4) **SUDAH diperbaiki** (§7 di dokumen detail) — 8 dari 11 fungsi penulis `ledger_stok` dibuat scale-aware, migration `20300105000017` applied & diverifikasi. 141 baris "Berisiko" dari audit lapangan masih perlu opname ulang manual (fix ini cegah kerusakan baru, tak otomatis koreksi yang sudah kadung salah).

**📄 Detail lengkap:** `docs/SESSION-2026-08-04-STOK-SATUAN-GRAM-BESAR-AUDIT.md`

1. **Konflik arsitektur dengan sesi paralel diresolusi.** Sesi lain push `b450047a` yang membalik `OpnameForm.tsx` ke satuan besar — kebalikan mekanisme `saldo_is_gram` semalam. Ground-truth: kode itu **belum ter-deploy** (opname baru setelah commit-nya masih gram-scale), dan bug analisis menunjukkan kalau di-deploy akan merusak baris gram-scale (bandingkan besar vs gram tanpa cek skala). Keputusan user: *"jangan rusak yang sudah berjalan baik"* → `b450047a` di-`git revert`.
2. **§5 Nudge Batch selesai** (`docs/superpowers/specs/2026-08-03-permintaan-batch-nudge-design.md`): permintaan `menunggu` >12 jam otomatis dibebaskan dari hide + `buat_permintaan_svc` auto-set status `dibatalkan` pada request lama yang stale saat diajukan ulang (migration `20300105000011`, applied & diverifikasi).
3. **ApprovalModal.tsx** — instance lain bug gram/besar (masih pakai `formatTriUnitSaldo` bukan `Adaptive`) + bug arithmetic tersembunyi: perbandingan "melebihi stok gudang" membandingkan besar-scale vs saldo mentah tanpa konversi skala. Fix + `convertGramToBesar()` baru.
4. **🔴 Temuan besar, belum diperbaiki:** `sj_on_dikirim_kurangi_kitchen` (trigger transfer surat jalan) menulis delta `ledger_stok` **selalu satuan besar**, tanpa pernah cek `saldo_is_gram` outlet tujuan — kirim 1 Pack ke baris gram-scale bisa tercatat sebagai -0.2 alih-alih -1 (salah sebesar faktor konversi bahan). **11 fungsi lain** yang menulis `ledger_stok` (termasuk `process_waterfall_deduction`/BOM — jalan tiap order) berpotensi bug sama, **belum diaudit satu-satu**.
5. **Audit lapangan:** dari 1517 baris `stok_balance`, 708 gram-scale — **141 "Berisiko"** (sudah kena tulisan besar-scale sejak baseline gram, kemungkinan korup), 567 "Aman". Per bahan baku (61 total): **config `satuan_distribusi` 61/61 OK** (bukan salah setting unit); 25 bahan punya ≥1 outlet berisiko.

---

## Session 2026-08-05: SS Online — Marketplace Sales Filter (apps/admin-dashboard)

**Status:** ✅ Kode COMPLETED — `yarn test` 23/24 (satu kegagalan pre-existing `posReportKpi.test.ts` tak terkait, jumlah sama dengan baseline sebelum fitur ini), `yarn type-check` 0 error, `yarn build` sukses (route `/dashboard/reports/pos` muncul). Migration **applied & live** di remote DB. ⚠️ Perlu **redeploy `admin-dashboard`**.

### Fitur
Dropdown **"SS Online"** (TikTok Shop, Shopee) ditambahkan di Rangkuman Penjualan (`/dashboard/reports/pos`), didukung 2 outlet virtual (`type='marketplace'` di tabel `outlets`) yang reuse skema `orders`/`order_items` existing — logika KPI/tabel identik dengan outlet fisik. Kedua outlet virtual ini sudah ada & bisa di-query, tapi nol baris `orders` sampai ada mekanisme import.

### Implementasi
- **Migration `20260805100000_marketplace_virtual_outlets.sql`** — applied & live di remote.
- **File baru:** `src/lib/marketplaceOutlets.ts` (helper pure split outlet fisik vs marketplace), `src/components/MarketplaceFilter.tsx`, `src/lib/channels.test.ts`, `src/lib/marketplaceOutlets.test.ts`.
- **File diubah:** `src/lib/types.ts`, `src/lib/channelGroups.ts`, `src/components/SourceBreakdown.tsx`, `src/lib/channels.ts`, `src/app/dashboard/reports/pos/ReportsView.tsx`.

### Gotcha — deviasi sengaja dari spec
Value `sales_source` untuk Shopee adalah **`'shopee_shop'`**, bukan `'shopee'` seperti di spec awal — `'shopee'` sudah dipakai sebagai alias `getChannel()` untuk channel delivery ShopeeFood, jadi dipakai nama berbeda untuk hindari tabrakan.

### ⚠️ Belum dikerjakan (sengaja di luar scope sesi ini)
1a. **admin-dashboard sendiri — RESOLVED** (final review fix pass, sesi sama): `useOutlets.ts` dipakai ~14 halaman/komponen operasional (manajemen outlet, staff, absensi, target-harian, dll) tanpa filter `type` → 2 outlet virtual live sempat bocor ke sana. **Fix:** tambah `.neq('type', 'marketplace')` di `useOutlets.ts`.
1b. **App lain — MASIH TERBUKA, belum diaudit.** `stok`/`absensi`/`distribusi`/`pos-kasir`/`finance`/`manager`/`owner-dashboard` masing-masing punya `useOutlets.ts`/kode query outlet SENDIRI (tidak disentuh fix di atas) — risiko bocor 2 outlet virtual ke dropdown outlet app lain tetap ada & belum diverifikasi satu per satu.
2. **Halaman `/dashboard/marketplace-import`** + parser Excel/CSV per-platform belum dibuat — menunggu contoh file laporan asli dari Seller Center TikTok Shop & Shopee.
3. **Smoke test browser manual** dropdown "SS Online" — belum dijalankan sesi ini (tak ada browser tersedia); langkah manual sudah terdokumentasi di plan.
4. **Keputusan terbuka untuk sesi import:** apakah revenue marketplace boleh ikut ke KPI Owner Dashboard / Target Harian / outlet leaderboard. Saat ini semua itu agregasi `orders` by `outlet_id` TANPA filter `type` — begitu import jalan, revenue marketplace OTOMATIS ikut ke situ kecuali ada keputusan eksplisit sebaliknya. Belum diputuskan, jangan diasumsikan salah satu arah.
5. **Constraint wajib untuk importer masa depan:** tulis `orders.channel` = NULL atau eksplisit `'shopee_shop'`/`'tiktok_shop'` saja. Kalau importer menulis `channel = 'shopee'`, `resolveOrderSource()` (`src/lib/order-source.ts`) resolve `channel` SEBELUM `sales_source` → kena alias `'shopee'` lama → order salah label jadi ShopeeFood delivery, menghidupkan lagi tabrakan nama yang justru dihindari dengan memilih nama `shopee_shop`.

### Artefak
- Spec: `docs/superpowers/specs/2026-08-05-marketplace-sales-outlet-design.md`
- Plan: `docs/superpowers/plans/2026-08-05-marketplace-sales-outlet.md`

### 📝 Next
- Redeploy `admin-dashboard` agar fitur ini live.
- Audit `type != 'marketplace'` di app lain sebelum dianggap aman.
- Bangun halaman import setelah contoh file laporan Seller Center didapat.

---

## Session 2026-08-13: VPS Docker Deploy Bug Hunt, Opname 2x-Hari Exception, Draft Save, & Master Data Cleanup

**Status:** ✅ Kode COMPLETED & di-push ke `main` (5 commit). ✅ Fix VPS Docker sudah live setelah redeploy `stok`. DB master-data cleanup sudah dijalankan langsung ke live DB (bukan cuma di kode).

### 🔴 Bug utama: secret server-only hilang di runtime — Docker multi-stage build (SEMUA app)

**Gejala:** "Server error: supabaseKey is required" muncul di finalisasi opname (`apps/stok`), tepat setelah migrasi deploy dari cPanel ke **VPS berbasis Docker** (bukan lagi cPanel+LiteSpeed).

**Root cause:** `apps/*/Dockerfile` semua multi-stage build. `NEXT_PUBLIC_*` aman karena di-inline webpack ke bundle client **maupun server** saat build (jadi tetap benar meski stage runner tak declare ulang). Tapi secret server-only (`SUPABASE_SERVICE_ROLE_KEY`, dll) dibaca `process.env` di **RUNTIME** oleh Server Action/Route Handler — dan Docker **tidak** membawa `ARG`/`ENV` lintas stage (`FROM node:24-bookworm-slim AS runner` = environment baru). Semua Dockerfile cuma declare secret ini di stage **builder**, bukan **runner** (stage yang benar-benar jalan) → `process.env.SUPABASE_SERVICE_ROLE_KEY` selalu `undefined` di container produksi.

**Fix (commit `4778ca5e`):** re-declare `ARG`+`ENV` untuk secret masing-masing app di stage runner, di **9 Dockerfile** (stok, distribusi, absensi, finance, owner-dashboard: `SUPABASE_SERVICE_ROLE_KEY`; admin-dashboard: + `CRON_SECRET`/`GUDANG_MAGIC_TOKEN`/`ORDER_ONLINE_*`; portal: + `SUPABASE_JWT_SECRET`/`GUDANG_MAGIC_TOKEN`; pos-kasir: + `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID`/`ORDER_*_SECRET`; manager: + `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID`/`SUPABASE_URL`/`FIREBASE_SERVICE_ACCOUNT`). Karena platform VPS sudah kirim `--build-arg` yang sama untuk semua stage dalam satu build, murni fix Dockerfile — tak perlu ubah config platform. **Bukti korelasi:** commit `a6fdb07e` dari dev lain ("use createSupabaseServerClient to avoid missing SERVICE_ROLE_KEY env var in production") menunjukkan `admin-dashboard` kena bug identik di waktu yang sama, dikerjakan dengan workaround app-level alih-alih fix root cause Docker.

### 🔴 Bug kedua: cache BuildKit korup (build gagal total)

**Gejala:** Redeploy `stok` gagal build: `EBUSY: resource busy or locked, rmdir '...yarn/v6'` + `ENOENT` saat extract tarball cache.

**Root cause:** Cache mount `--mount=type=cache,target=...` tanpa `id` eksplisit → default id = target path → **semua app berbagi satu cache** yang sama, dan cache itu korup. Sudah pernah kejadian & di-fix untuk `apps/manager` sehari sebelumnya (`f3669c81`, kasih `id=yarn-cache-v2`) tapi belum diterapkan ke app lain.

**Fix (commit `ce760879`):** terapkan `id=yarn-cache-v2` ke **8 Dockerfile** sisanya sekaligus (bukan cuma stok) — semuanya berbagi cache sama, jadi semua rawan gagal identik di deploy berikutnya kalau tak dibereskan bareng.

### ⚠️ Kesalahpahaman yang sempat terjadi & pelajarannya
Setelah kedua fix di atas + redeploy sukses, muncul error BARU "Opname tidak ditemukan" — sempat dicurigai `SUPABASE_SERVICE_ROLE_KEY` di panel VPS ke-isi anon key (bukan service_role), karena draft opname **berhasil dibuat** (RLS-scoped client, terverifikasi ada di DB) tapi item **gagal disimpan** oleh service-role client (`opname_item` count=0). **Ternyata sebab sebenarnya lebih sederhana:** variabel `SUPABASE_SERVICE_ROLE_KEY` memang **belum pernah di-set** di panel VPS sebelumnya (dikonfirmasi user). Setelah ditambahkan + redeploy, muncul error ketiga "Server Action ... was not found on the server" — ini **bukan bug**, itu efek normal Next.js: ID Server Action di-generate ulang tiap build, tab browser yang sudah kebuka dari sebelum redeploy masih pegang referensi lama. Fix: hard refresh / buka ulang tab.

### ✅ Fitur: Opname 2x hari ini (13/08/2026), semua outlet
Owner minta longgarkan cap opname harian jadi 2x khusus tanggal ini (crew banyak yang nulis manual di kertas semalam karena app sempat down) — opname pertama `tipe='ad_hoc'` (susulan data semalam), kedua `tipe='harian'` (opname normal hari ini), opname kedua baru dibuat setelah yang pertama `finalized`. Gate per-tanggal (`todayWIB === '2026-08-13'`) di [useOpname.ts](apps/stok/src/hooks/useOpname.ts) `createOrReuseDraft` — otomatis kembali normal (1x/hari) besok tanpa perlu revert manual, pola sama seperti exception Jatiasih yang sudah ada.

### ✅ Fitur: Simpan Draft & resume opname
Ditambah tombol "💾 Simpan Draft" di [OpnameForm.tsx](apps/stok/src/components/stok/OpnameForm.tsx) — simpan progres input (buat/reuse draft + upsert item) TANPA memanggil `finalize_opname`, supaya crew tak kehilangan progres kalau app ditutup di tengah opname. Saat form dibuka lagi, otomatis resume dari draft hari ini (`fetchTodayDraft` di `useOpname.ts`) + tampilkan banner status "📝 Draft — terakhir update [jam]". Nilai mentah (besar/tengah/kecil) disimpan di field baru `raw` dalam `opname_item.catatan` JSON (field lama `f/s/d` tetap dipertahankan, tak mengubah layar lain yang membacanya).

### 🔴 Temuan keamanan: role `kitchen` bisa opname outlet lain (belum diperbaiki)
Diverifikasi ke DB live: `opname_insert`/`opname_update`/`opname_item_write` RLS memakai `accessible_outlet_ids()` yang untuk role `kitchen` mengembalikan SEMUA outlet (dimaksudkan utk "lihat semua outlet" doc CLAUDE.md, ternyata kepakai juga utk INSERT). Form opname normal (`finalize_opname` RPC dipanggil via sesi user sendiri) punya guard ketat `outlet_staff.outlet_id = opname.outlet_id` jadi **diblokir** kalau dicoba lewat form biasa untuk outlet lain. **Tapi** kitchen bisa: buat draft outlet lain → isi item → `set_opname_pending` (nol guard) → approve punya sendiri lewat `/stok/opname-approval` (approval jalan lewat service-role, guard `finalize_opname` otomatis di-skip karena `auth.uid()` NULL) → ledger `opname_selisih` outlet lain benar-benar berubah. Pola sama dgn `server-action-authz-gap` (memory). **Belum diperbaiki** — opsi perbaikan: perketat `opname_insert`/`update`/`item_write` kembali ke `outlet_staff.outlet_id` sendiri (opname = aksi fisik lokal), biarkan `opname_read`/approve/reject tetap luas (accessible_outlet_ids, karena approval memang harus lintas-outlet).

### ✅ Master data cleanup: MINYAK vs MINYAK SAYUR, PLASTIK BENING
Dicek `resep_item` (BOM aktif): **19/19 resep global pakai MINYAK SAYUR**, nol pakai item "MINYAK" (yang ternyata punya bug `faktor_konversi=1`, seharusnya 1000 spt MINYAK SAYUR — bikin opname manual salah hitung kalau dipakai). Keputusan owner: rename **MINYAK SAYUR → MINYAK** (id sama, BOM otomatis ikut), item lama "MINYAK" di-rename **"MINYAK (NONAKTIF)"** + `is_active=false` (BUKAN DELETE — 156 baris `ledger_stok` + 183 `opname_item` + saldo di 25 outlet, semua `ON DELETE RESTRICT`, hapus = hilang jejak audit beneran). **PLASTIK BENING** juga dinonaktifkan (0 pemakaian BOM aktif, aman). Migration `20260813120000`/`20260813121500` — dijalankan **langsung ke live DB** (bukan lewat `db push`, karena kena drift migration remote-only dari dev lain yang tak di-repair sepihak, sesuai kebiasaan proyek ini) lalu ditandai `applied` via `migration repair`.

### Artefak
- Migrations: `supabase/migrations/20260813120000_rename_minyak_sayur_to_minyak.sql`, `20260813121500_deactivate_plastik_bening.sql`
- Commits: `4778ca5e` (secret propagation), `ce760879` (yarn cache bust), `e5c2cde6` (draft save/resume), `8d625ca8` (rename Minyak), `cc513b88` (deactivate Plastik Bening), `aba8eeb2` (opname 2x exception)

### 📝 Next
- **Perbaiki role `kitchen` cross-outlet opname** (temuan keamanan di atas) — belum dikerjakan, butuh keputusan apakah opname WAJIB scoped ke outlet sendiri untuk semua role.
- Terapkan fix Docker (secret + cache) yang sama ke app lain yang belum sempat di-redeploy sejak commit ini (`distribusi`, `absensi`, `admin-dashboard`, dll) — kode sudah benar, tinggal redeploy tiap app.
- Audit env var `SUPABASE_SERVICE_ROLE_KEY` (dan secret server-only lain) di panel VPS untuk SEMUA app, bukan cuma `stok` — pola "belum pernah di-set sejak migrasi VPS" kemungkinan berulang di app lain juga.

---

## Session 2026-09-05: Konsolidasi Navigasi ADMIN (apps/admin-dashboard)

**Status:** ✅ Kode selesai, test hijau, build sukses. ⚠️ Perlu **redeploy `admin-dashboard`**; smoke test browser sebagai ADMIN belum dijalankan (butuh sesi login).

Nav role ADMIN dipangkas dari 10 pintu / 51 entri jadi **7 pintu / 48 entri, nol route hilang**. Grup `Pengadaan` dibuang (duplikat persis `Pembelian & PO`), entri `reports/pembelian` yang kembar dihapus satu, `Kemitraan` dan `Migrasi Data` jadi OWNER-only dengan ADMIN mendapat isinya lewat `Bisnis` dan `Sistem`, dan "Rekap Absensi (Stealth)" pindah ke pintu `Karyawan`. Rename: `Pembelian & PO` → `Pembelian`, `Manajemen POS` → `POS`.

### ⚠️ Gotcha: grup nav dipakai bersama antar role
Memindahkan item antar grup akan **diam-diam mengubah nav OWNER**. Mekanismenya harus penyempitan `roles` per item (entri kembar dengan `roles` berbeda), bukan pemindahan. Karena alasan yang sama, rename `Pusat Laporan` → `Laporan` dan `Sistem` → `Sistem & Data` **dibatalkan**: keduanya milik OWNER juga, dan "Sistem & Data" justru menyesatkan buat OWNER yang tak melihat item Data-nya.

### Bottom-nav mobile
`BottomNav.tsx` dulu memakai `accessibleItems(role).slice(0, 4)`, jadi tab mobile ADMIN berisi "Petty Cash (Khusus)" dan "Rekap Absensi (Stealth)" murni karena kebetulan urutan array. Sekarang lewat penanda `primary?: Role[]` + helper `primaryItems()`; role tanpa penandaan berperilaku persis seperti sebelumnya (dijaga test). Tab ADMIN: Ringkasan · Penjualan · PO · HR.

### Test
`apps/admin-dashboard/src/components/layout/navConfig.test.ts` (baru, 44 test) — snapshot himpunan route **per role** (bukan sekadar jumlah), larangan `href` kembar, dan cek setiap `href` punya `page.tsx`. Baseline suite sebelum & sesudah sama persis: 42 file gagal / 10 test gagal (pre-existing; sebagian besar dari `.claude/worktrees/` yang ikut ter-scan vitest karena tak ada exclude). Nol regresi.

**Spec/plan:** `docs/SPEC-2026-09-05-ADMIN-DASHBOARD-NAV-CONSOLIDATION.md`, `docs/PLAN-2026-09-05-ADMIN-DASHBOARD-NAV-CONSOLIDATION.md`

**📝 Next:** redeploy `admin-dashboard`; smoke test sidebar sebagai ADMIN & OWNER; putuskan nasib 11 route yatim yang didaftar di §8 spec.

## Session 2026-09-07: Waste Dashboard Komprehensif + Laporan Per-Insiden (apps/admin-dashboard)

**Status:** ✅ Kode COMPLETED, 9 task + fix wave, semua review bersih. ⚠️ **Sudah ter-merge & ter-push ke `origin/main` oleh otomasi repo, bukan lewat PR** (lihat catatan otomasi di bawah). Belum redeploy. Riwayat migration di DB belum di-stempel ulang setelah rename file.

### Fitur
`/dashboard/owner/waste` dirombak: angka waste kini bisa dibandingkan antar-outlet (**% omzet** + delta vs periode sebelumnya, bukan rupiah mentah yang selalu menyalahkan outlet besar), plus **laporan per-insiden** untuk waste yang sudah di-approve — pelapor, penyetuju, foto bukti, jejak waktu lapor→approve. Sebelumnya tabel "Rincian Waste" mengagregasi per (bahan, alasan, tanggal) sehingga identitas laporan hilang; `get_waste_breakdown` tak pernah menyeleksi `id`/`reported_by`/`approved_by`/`photo_url` padahal `stok_waste_reports` menyimpan keempatnya sejak 2026-07-09.

**Spec/plan:** `docs/superpowers/specs/2026-09-07-waste-dashboard-comprehensive-design.md`, `docs/superpowers/plans/2026-09-07-waste-dashboard-comprehensive.md`

### Implementasi
- **Migration `20260907000000_waste_dashboard_rpcs.sql`** — 2 RPC baru, `SECURITY DEFINER` + `is_owner_or_admin()` + `accessible_outlet_ids()`. `get_waste_summary_v2` (agregat, roll-up di server) dan `get_waste_incidents` (per-laporan, paginasi server 25/hal, cap 100, `total_count` via window function sebelum LIMIT). **Dua RPC, bukan satu, justru karena cap 1.000 baris PostgREST** — total yang terpotong lebih berbahaya daripada tak ada total.
- **`lib/wasteMetrics.ts`** (TDD, 11 test) — `computeDeltaPct`, `computeWastePctOmzet`, `aggregateByBahanWithSpread`. `aggregateByReason`/`aggregateByBahan` di `wasteBreakdown.ts` **sudah ada tapi tak pernah dipakai halaman** → dipakai ulang, tidak ditulis ulang. `previousRange` juga sudah ada di `period.ts`.
- **6 komponen** di `components/waste/` + `page.tsx` jadi composition root tipis (169 → 87 baris).
- **Perbaikan valuasi:** `hpp_kecil` kini dibagi `kemasan_qty` (basis kanonik 2026-09-03), bukan `faktor_konversi`. **Tidak menggeser satu rupiah pun** — diverifikasi di DB live: `SUM(nilai)` identik 20 desimal dengan `get_waste_breakdown` (Agustus 2026, 259 baris). `get_waste_periode` & `get_waste_breakdown` sengaja tak disentuh (menyuplai Profit/Expenses → Laba Bersih, termasuk milik mitra).

### 🔴 Gotcha utama: hook omzet yang tak berpaginasi menggerus penyebut diam-diam
Plan ini semula menunjuk **`useSalesSummary`** sebagai penyebut "Waste % Omzet". `useSalesSummary` bersandar pada **`useSalesHourlyRaw`**, yang melakukan `.select()` polos ke `sales_hourly_scoped` **tanpa `.range()` dan tanpa `ORDER BY`** — kena cap 1.000 baris. Grain-nya per-JAM, jadi 19 outlet × 7 hari × ~12 jam × ≥2 `sales_source` ≈ 3.000–6.000 baris; yang lolos 1.000 dan **baris mana yang lolos tidak deterministik**.

Akibatnya "Waste % Omzet" terbaca beberapa kali lipat terlalu tinggi, dan outlet yang barisnya tak lolos tampil "N/A" — tepat di kolom yang tujuannya jadi pembanding paling adil. **Fix: pakai `useSalesDaily`**, yang berpaginasi sampai habis (`PAGE_SIZE=1000` loop) di atas grain yang urutannya unik. Semua permukaan omzet lain di app ini (`ProfitView`, `rekap-bulanan`) sudah pindah ke sana lebih dulu; `useSalesSummary` praktis jadi yatim.

⚠️ **`useSalesHourlyRaw` sendiri masih rawan** (dipakai owner dashboard untuk bucket per-jam) — belum diperbaiki, bukan lingkup sesi ini.

Mitigasi sejenis untuk RPC agregat kita: `useWasteSummary` mengekspos `truncated` bila hasil mentah mencapai 1.000 baris, dan halaman menampilkan banner amber ("Rentang tanggal terlalu panjang…") alih-alih angka yang percaya diri tapi salah. Rentang preset aman (maks 31 hari); hanya rentang kustom >~4 bulan yang menggigit.

### ⚠️ Gotcha: CI menolak timestamp 2030, tapi file sudah terlanjur applied
Plan awal memberi timestamp `20300202000000` agar berurut setelah ranjau-2030 yang sudah ada. Ternyata `.github/workflows/ci.yml` menjalankan `scripts/migration-timestamp-lint.mjs` yang **menolak timestamp jauh ke depan** — dijalankan manual, `exit=1`. Karena migration ini membuat dua nama fungsi yang **baru sama sekali** (tak ditimpa migration lain), timestamp hari ini aman secara urutan → file di-rename ke `20260907000000`, **isi SQL byte-identik**.

**`supabase migration repair` SENGAJA TIDAK dijalankan.** Baris `20300202000000` masih tertinggal di `schema_migrations` DB produksi bersama. Menulis ke tabel riwayat DB bersama tanpa persetujuan pernah jadi insiden di proyek ini (Session 2026-07-14). Aman dibiarkan sementara: SQL-nya murni `CREATE OR REPLACE`, jadi `db push` berikutnya menerapkannya ulang secara idempoten. **Keputusan stempel = milik owner.**

### Batas yang disengaja: cek potongan stok melaporkan KEBERADAAN, bukan kecocokan
Modal detail menampilkan "Potongan stok tercatat (N baris ledger)" atau peringatan "Tidak ada baris ledger". Ia **tidak pernah** membandingkan `qty` laporan dengan qty ledger: skala ledger bergantung `saldo_is_gram` per outlet sedangkan qty laporan selalu satuan besar, jadi perbandingan langsung akan memicu alarm palsu di >50% baris. Keberadaan bersifat bebas-skala dan tetap menangkap kelas bug yang didokumentasikan `20300120000002` (4 laporan APPROVED Agustus 2026 yang tak pernah menghasilkan baris ledger sama sekali).

### 🤖 Catatan otomasi (jejak audit sebenarnya)
Otomasi repo memindahkan working tree ke `main` **lima kali** di tengah sesi (sekali sampai file spec lenyap dari working tree — commit selamat, dipulihkan lewat checkout), berulang kali menyapu commit dev lain masuk ke branch ini, lalu **di akhir menggabungkan branch ke `main` dan mem-push ke `origin/main` sendiri** — tanpa PR, tanpa review atas merge-nya. Merge `eae7d911` juga menyeret `f97ac4f4` (riwayat waste `apps/stok`, kerja lain) dan menamai keduanya dalam satu kalimat. **Tidak ada merge/push yang diinisiasi manusia maupun agen di sesi ini.** Section inilah jejak audit atas apa yang benar-benar diputuskan; pesan commit merge-nya tidak.

### Verifikasi
type-check: hanya 3 error pre-existing (`mitraPolicy.test.ts` TS6133, `vitest.config.ts` ×2). Test: 42 file / 10 test gagal = **baseline persis**, lulus naik 511 → 526, `wasteMetrics` 11/11. Build sukses, route `ƒ /dashboard/owner/waste`. Migration lint lolos setelah rename.

### 📝 Next
- **Smoke test browser** (belum pernah dijalankan — tak ada sesi login): bandingkan "Waste % Omzet" dengan omzet halaman Profit periode sama; kalau fix `useSalesDaily` benar, konsisten.
- **Putuskan stempel migration** (lihat gotcha di atas).
- **Redeploy `admin-dashboard`.**
- Minor tertunda: `totalCount` insiden belum ikut menyaring outlet test; `ORDER BY s_created_at` belum unik (tambah `, s_id` di migration lanjutan); ambang `> 2`% dan `> 0`% belum jadi konstanta bernama.

---

## Session 2026-09-08: FOIL bersatuan Dus, Gerbang Nol Opname, & Koreksi Stok Ter-nol (apps/stok)

**Status:** Perubahan DB **sudah live** (master data + koreksi saldo, diterapkan via `exec_sql` + verifikasi ground-truth). Perubahan kode (`zeroGuard` + `OpnameForm`) **⚠️ perlu redeploy `stok`** baru berlaku.

### 1. FOIL dapat tingkat satuan Dus (migration `20260908103000`)
Owner minta crew menghitung FOIL per dus, bukan per roll. Isi 1 Dus dikonfirmasi **48 Roll**.

| | sebelum | sesudah |
|---|---|---|
| satuan / tengah / kecil | Roll / — / cm | **Dus / Roll (48) / cm** |
| faktor_tampilan | 760 | **36.480** |
| faktor_konversi | 760 | **760 (tetap — kecil per TENGAH)** |
| harga_beli / kemasan_qty | 8.791,2 per Roll / 760 | **421.977,6 per Dus / 36.480** |

Aman karena satuan terkecil tetap cm: seluruh `stok_balance` dan riwayat `ledger_stok` tetap valid, tak ada rekonsiliasi (beda dengan POLYBAG `20300122000003` yang satuan kecilnya ikut berubah). Harga per cm identik (11,567368) → HPP & nilai persediaan tidak bergeser. Urutan wajib: **faktor dulu, baru harga** (`sync_harga_beli_display` menghitung dari `faktor_tampilan`).

### ⚠️ Gotcha: mengubah satuan besar merusak dokumen yang masih berjalan
`surat_jalan_item.qty_dikirim` disimpan dalam **satuan besar** (form distribusi mengonversi input Roll → basis lewat `getDistribusiFactor`), lalu dikali `faktor_tampilan` oleh `to_ledger_scale()` saat verifikasi. 26 baris SJ berstatus `dikirim`/`draft` menyimpan angka dengan arti LAMA — termasuk 2 draft yang dibuat pagi itu juga. Kalau dibiarkan, verifikasinya menulis ledger **48× lipat**. Semua dikonversi (÷48) dengan daftar id eksplisit di migration agar idempoten. Diperiksa juga: PO FOIL terbuka 0, permintaan bahan FOIL terbuka 0, tabel mutasi antar-outlet tidak ada di DB ini. **Pelajaran: setiap kali mengubah `satuan`/`faktor_tampilan` sebuah bahan, sisir dulu dokumen in-flight yang menyimpan qty dalam satuan besar.**

### 2. Definisi resmi isian opname (keputusan owner)
- **Kolom dikosongkan = belum dihitung** → item dilewati, saldo sistem tidak berubah.
- **Kolom diisi 0 = sudah dihitung, fisik habis** → saldo dinolkan.

Selama ini definisi itu hanya tersirat di kode: form sudah memperingatkan yang dikosongkan, tapi **tidak ada peringatan sama sekali untuk yang diisi 0** — padahal justru itu yang menghapus stok.

### 3. Jalan keluar "Belum dihitung" — digabung ke gerbang PR #52
Sesi ini membangun gerbang konfirmasi nol sendiri, lalu saat rebase ketahuan **PR #52 (`074a3a2f`, dev lain, hari yang sama)** sudah memasang gerbang yang **lebih luas**: `hitungPenurunanDrastis()` menahan SEMUA penurunan drastis (`isSelisihFlagged` — 0% untuk satuan hitung, 5% untuk timbang), bukan hanya isian 0, dan sudah menggerbangi kedua jalur masuk finalisasi. Kasus yang saya tangani adalah bagian dari kasus mereka, jadi **modal kembar saya dibuang** — dua peringatan beruntun justru melatih orang menekan "lanjut".

Yang dipertahankan dari sesi ini karena tidak ada di PR #52: tombol per baris **"Belum dihitung — lewati"** yang menghapus isian sehingga bahan itu benar-benar dilewati (menegakkan definisi di §2 — peringatan saja tidak cukup, jalan keluarnya harus ada di tempat peringatan muncul). Tombol hanya tampil untuk baris yang lolos `isSuspiciousZero` (`src/lib/stok/zeroGuard.ts`, TDD): fisik 0 dan sistem ≥ 1 satuan menengah. Saldo minus tidak pernah diflag — mengisi 0 di baris minus justru memperbaiki. Menawarkan "lewati" pada penurunan sebagian (mis. 819 → 5) akan salah, karena angka itu memang hasil hitungan.

**Stok sistem tetap tidak tampil di kartu input** — hitungan buta dipertahankan; angka sistem hanya muncul di modal setelah crew selesai menghitung.

### 4. Koreksi stok yang telanjur terhapus (20 baris ledger `adjustment`)
Sisir 120 opname finalized 1–7 Sep, seluruh outlet. Angka mentah (75 kasus, "Rp593 juta") **menyesatkan** — didominasi BNR yang stok sistemnya sudah korup sejak sebelum September (tercatat 400 Dus PLASTIK VACUM); isian 0 di sana justru menormalkan. Setelah disaring (masih kosong + tak pernah dihitung ulang sesudahnya + ada hitungan fisik nyata sebagai acuan ≥ 1 satuan menengah): 21 kasus, dikoreksi 16 + 4 koreksi manual sebelumnya.

Dikembalikan ke **angka opname terakhir yang benar-benar dihitung** (instruksi owner: jangan pakai perkiraan yang dikurangi pemakaian): FOIL Pajajaran 81 Roll / Jagakarsa 36 Roll / Paledang 14 Roll+7 cm, TUTUP PACK Paledang 57 Pcs, plus 16 baris lintas outlet (kemasan, gas, galon, FOIL Cirendeu, PRINTER THERMAL Empang 2 Unit).

**Sengaja tidak dikoreksi:** ES BATU & Sayur/lettuce (barang habis harian, nol kemungkinan benar); SAOS TOMAT KOMPAN Beji (acuannya sendiri 8 Dus tidak wajar — hari lain 0, outlet lain 0–1 Dus).

Skrip: `SS COGS SET/koreksi-foil-opname-terakhir-2026-09-08.sql`, `koreksi-tutup-pack-paledang-2026-09-08.sql`, `koreksi-opname-terisi-nol-2026-09-08.sql` (semua idempoten: delta dihitung dari saldo live, baris delta 0 dilewati).

### 📝 Next
- **Redeploy `stok`** — gerbang nol belum aktif sebelum itu.
- **BNR perlu opname fisik menyeluruh.** Stok sistemnya tak bisa dipercaya sejak sebelum September (warisan data lama, bukan kesalahan crew). Koreksi per baris tidak akan menolong; perlu satu kali hitung total sebagai baseline baru.
- 3 surat jalan FOIL menggantung berisi barang yang kemungkinan sudah di outlet: Cirendeu 48 Roll (4 Sep), Cibinong 48 Roll (7 Sep), Cileungsi 96 Roll (4 Sep) — outlet perlu memverifikasinya agar stok terkredit. Ada pula 6 SJ FOIL sisa Juli–Agustus (1–4 Roll) yang sebaiknya dibatalkan.
- Kalisari & Cileungsi: dugaan dus tersegel tak ikut dihitung (Kalisari terima 1 dus pukul 16:01, malamnya mencatat "1 Roll"). Perlu hitung fisik ulang dengan kolom Dus baru.
- Usul terpisah: merampingkan daftar 43 item per outlet — akar kebiasaan mengetik 0 pada item yang outletnya memang tidak pakai.

## Session 2026-09-08: Outlet Tes Dikeluarkan dari Semua Perhitungan (DB + 5 app)

**Status:** ✅ COMPLETED & LIVE — 4 migration applied & diverifikasi di DB live; kode
ter-merge ke `main` lewat PR #52 dan sudah di-redeploy oleh owner.

Guard finalisasi opname yang juga lahir di sesi ini dibahas di entri
"FOIL bersatuan Dus, Gerbang Nol Opname" di atas (§3) — sesi itu yang
merekonsiliasi keduanya, jangan ditulis dua kali di sini.

### Aturan (keputusan owner)

> "outlet tes hanya untuk testing oleh developer, jadi jangan masuk ke perhitungan"

Berlaku untuk **semua** angka: omzet, HPP, laba, nilai persediaan, waste.
**Kenali lewat `outlets.type = 'test'`, bukan nama** — nama bisa diubah admin kapan saja.
**Jangan andalkan `is_active`** — outlet tes justru `is_active = true`.

### Ditutup di basis data

| Migration | Isi |
|---|---|
| `20300131000000` | `nilai_persediaan_spv` kecualikan `type` test & marketplace |
| `20300132000000` | Helper baru `outlet_ids_terhitung()` + 6 RPC HPP/waste dialihkan ke sana |
| `20300133000000` | `sales_summary_spv` & `menu_sales_spv` (`security_barrier` dipertahankan) |

**`accessible_outlet_ids()` SENGAJA tidak diubah** — itu mengatur hak *baca*; kalau outlet
tes dikeluarkan dari sana, developer tak bisa lagi melihat data ujinya. Aturannya "jangan
dihitung", bukan "jangan dilihat". Untuk agregasi laporan **baru**, pakai
`outlet_ids_terhitung()` (= `accessible_outlet_ids()` minus lokasi non-operasional).

Efek terukur, tanpa efek samping: omzet total 1.679.672.213 → 1.678.792.213 (−Rp880.000,
tepat sebesar omzet outlet tes); baris view −7 dan −26, persis seperti yang diukur sebelum
perubahan. Halaman Nilai Persediaan sebelumnya menampilkan **Rp2,45 miliar** di kartu
"Belum Pasti" — **Rp2,37 miliar** murni dari outlet tes; angka jujurnya Rp75,0 juta.

### Ditutup di sisi klien (commit `a37cba97`)

Tiap app menarik daftar outletnya sendiri — memperbaiki satu **tidak** memperbaiki yang lain
(pola sama dengan kebocoran marketplace, Session 2026-08-05 butir 1b). `admin-dashboard` &
`HR` sudah ditutup lebih dulu oleh `f8f01556`. Sisanya di sesi ini: `finance` (2 hook),
`owner-dashboard` (hook + 3 halaman), `manager` (2 halaman), `distribusi`, `stok`.

**⚠️ Gotcha: menyaring daftar outlet saja tidak cukup.** Halaman utama `apps/manager`
menjumlahkan `orders` dan `stok_waste_reports` **langsung dari tabel mentah** — penyaring
harus dipasang di tiap agregat juga, bukan cuma di dropdown-nya.

**Sengaja DIBIARKAN, dengan catatan di kodenya:** OutletSwitcher app stok
(`useOutletScope`) = pintu masuk developer untuk menguji; dan peta nama outlet di app
`inventori` yang hanya jadi label, tak menjumlahkan uang.

**Penyaring app baru** (`apps/{stok,distribusi,owner-dashboard,manager}/src/lib/outletFilters.ts`)
memakai `TEST_OUTLET_ID` + `outlets.type`, **bukan** kecocokan potongan nama seperti berkas
serupa di admin-dashboard/finance/HR. Hari ini hasilnya sama (diperiksa: dari 29 outlet
hanya "outlet tes" yang kena), tetapi `type` diisi skema sedangkan nama diisi pengetik.

**`type = 'office'` TIDAK bisa disaring per-type** — jenis itu memuat GUDANG PUSAT (HQ),
gudang sungguhan & pemegang persediaan terbesar, bersama KANTOR PUSAT yang dummy.

**📄 Catatan lengkap:** `docs/CATATAN-LANJUTAN-HARGA-STOK.md`

### 📝 Next
- Audit lanjutan **sudah tuntas**: `absensi`, `pos-kasir`, `inventori`, `monitoring`,
  `sales-board`, `retail-gateway` ditelusuri, nol yang perlu ditambal.
  ⛔ `retail-gateway` **jangan** disaring — outlet tes satu-satunya baris
  `app_enabled = true`, menyaringnya mengosongkan kanal retail.
- Bersih-bersih data KANTOR PUSAT (dummy, ikut terhitung di nilai persediaan Rp2,4 juta).

---

## Session 2026-09-08: Rantai Harga PO → Master → Surat Jalan, Koreksi FOIL, & Perbaikan Form

**Status:** ✅ Semua perubahan DB **sudah live & diverifikasi**; kode ter-merge ke `main`.
⚠️ **Perlu redeploy `stok` + `finance`** — perbaikan form belum aktif sampai itu.

**📄 Catatan lengkap:** `docs/CATATAN-LANJUTAN-HARGA-STOK.md`

### Keputusan owner yang mengikat

1. **Metode basis harga DIPERTAHANKAN.** Persediaan **murni kendali internal**,
   tidak ada pelaporan ke pihak luar → pertanyaan PSAK 14 gugur. Selisih
   "harga terakhir" vs rata-rata tertimbang stok on-hand = **Rp257.804 (0,07%)**,
   diukur tiga kali. **JANGAN bangun FIFO batch atau rata-rata tertimbang.**
2. **Harga beku surat jalan:** pakai harga yang dikonfirmasi sekarang; kalau
   audit menemukan selisih, disuntikkan belakangan.
3. **1 September 2026 = titik mulai bersih.** 443 dari 483 baris kini sama
   dengan master; 30 beda wajar (pembekuan memang begitu); 10 FOIL sudah benar.

### Yang diperbaiki di DB (8 migration, semua applied & idempoten)

`20260908150000` guard PO uji coba · `20260908160000` & `20260908210000` tandai
satuan asli 4 baris PO (nol angka berubah) · `20260908170000`/`180000`/`190000`
koreksi 53 baris harga beku · `20260908200000` POLYBAG Rp25.000→24.000 ·
`20260908220000` **saldo FOIL Gudang Pusat → 1.096 Roll (−Rp413,6 juta stok hantu)**

### 🔴 Pelajaran metodologis terpenting sesi ini

**Membandingkan harga terhadap master TIDAK CUKUP.** Kalau satuan bahan pernah
berubah, `qty` ikut berpindah basis — pasangan (qty, harga) bisa tetap BENAR
meski harganya tampak salah 48×. Klasifikasi otomatis menandai 10 baris FOIL
sebagai "salah satuan" dengan **keyakinan tertinggi**; ternyata sudah benar.
Menjalankannya akan menambah **Rp83 juta nilai fiktif**.

**Uji yang benar: apakah `qty × harga` menghasilkan rupiah yang masuk akal** —
bukan apakah harga sebanding dengan master. Selalu periksa sisi qty dulu:
bandingkan bentuk angka qty sebelum vs sesudah perubahan harga; kalau sama,
basis qty tidak berpindah dan hanya harga yang tertinggal.

Sepanjang hari **tiga angka besar menguap** setelah diverifikasi (Rp47 jt,
Rp222 jt, Rp83 jt) — semuanya dari sebab yang sama. Yang benar-benar ada
(Rp413,6 jt) justru baru ketahuan setelah **owner menyebut hitungan fisik
1.096 Roll**. Hitungan lapangan mengalahkan analisis.

### Kenapa harga beku TIDAK bisa dipulihkan dengan perkalian
Normalisasi 3 September (`20300122000001`/`...004`) **tidak mengalikan** harga
lama — ia **menggantinya**; nilai lama cuma kunci pengaman di `WHERE`. Jadi
rasio harga-beku terhadap master mencampur perubahan **satuan** DAN **harga**,
dan basis harga lama tak tercatat di mana pun. Jangan coba memulihkan periode
Juli–Agustus dengan faktor.

### Perbaikan form (⚠️ perlu redeploy)
Tiga kekeliruan hari ini satu akar: **form meminta angka tanpa menyebut satuan
dan tanpa menunjukkan hasilnya.**
- `ManualEntryForm` (stok): kotak "Akan tercatat" + "Stok setelah disimpan" +
  peringatan merah bila ≥10× stok terpasang, **dan peringatan itu ikut pindah
  ke Daftar Item Entri** (sebelumnya menguap saat "Tambah item" ditekan —
  ketahuan dari smoke test owner). Sengaja BUKAN modal kedua: dua peringatan
  beruntun melatih orang menekan "lanjut".
- `VerifikasiTerimaModal` (finance): label → **"Harga Aktual per {satuan}"**,
  satuan ditempel di dalam kolom qty, plus baris `qty × harga = total`.

### ➡️ LANJUTAN DUA-VENDOR — masalahnya OPERASIONAL, bukan biaya

Insiden FOIL **adalah kasus dua-vendor**: dua PO berdekatan, barang datang tidak
berurutan, PO vendor salah diverifikasi lalu dibatalkan, barang vendor kedua
datang tanpa PO tersisa → masuk lewat penyesuaian manual → satuannya salah.
**Kerusakannya dari dokumen yang kehabisan pasangan, bukan dari harga vendor.**

Dua temuan pendukung (rincian di dokumen catatan):
- Jalur PO resmi adalah **minoritas** barang masuk (32 baris `pembelian_supplier`
  vs 151 `adjustment` sejak 1 Agu) — dan **hanya jalur PO yang punya guard**.
- **Master supplier punya duplikat**: Pak Aziz tercatat 4× dengan 3 termin
  berbeda (15/10/30 hari) → jatuh tempo supplier sama bisa beda 20 hari.
  Akibatnya 4 dari 11 "bahan multi-vendor" **palsu**; yang asli cuma 7.

**Urutan untuk sesi berikutnya:** (1) gabungkan duplikat supplier — analisis
dua-vendor apa pun sebelum ini berdiri di atas data salah; (2) keputusan owner
soal cara membatalkan penerimaan agar PO kembali terbuka; (3) baru nilai apakah
masih perlu apa-apa lagi.

### 📝 Sisa yang diparkir
- **Redeploy `stok` + `finance`**, lalu smoke test: FOIL + `1000` satuan Dus →
  kotak merah + baris daftar merah; PO PLASTIK MERAH → "Harga Aktual per Ikat".
- `SPB/PO/VII/2026/021` (Altindo, 15 Agu, 2.000 Roll, Rp17,58 jt, **lunas**)
  berstatus `diterima_lengkap` tapi **tak pernah menulis baris ledger**.
- Periode Juli–Agustus harga beku: dibiarkan sesuai kebijakan owner.
- Lubang keamanan **belum diperbaiki** (diverifikasi masih terbuka 8 Sep):
  `opname_insert`/`opname_update` memakai `accessible_outlet_ids()` → role
  `kitchen` bisa opname outlet lain. Lihat Session 2026-08-13.

---

## Session 2026-09-08/09: Katalog Harga Vendor — Fondasi (Tahap 0 & 1)

**Status:** ✅ COMPLETED — 4 migration **applied & diverifikasi di DB live**, branch
`feat/katalog-harga-vendor` **di-merge lokal ke `main`** (merge commit `8b41a39e`, 13 commit).
⚠️ **Belum di-push ke `origin/main`.** Tidak perlu redeploy — modul TS baru **nol konsumen**,
tak ada UI yang membacanya.

**Spec/plan:** `docs/superpowers/specs/2026-09-08-katalog-harga-vendor-design.md`,
`docs/superpowers/plans/2026-09-08-katalog-harga-vendor-fondasi.md`

### Menjawab lanjutan dua-vendor: **lapisan referensi pembelian**, bukan perubahan metode harga

Tabel `bahan_baku_supplier` menjawab "bahan X, dari vendor mana, satuan apa, harga berapa,
kapan terakhir" — pertanyaan yang sebelumnya tak bisa dijawab sistem. Sebelumnya relasi
vendor↔bahan hanya `supplier.bahan_baku_ids UUID[]` (daftar tanpa harga), dan form PO
prefill `bahan.harga_beli` **global** — harga vendor terakhir siapa pun, bukan vendor yang
sedang dipesan.

**Harga master, HPP, dan nilai persediaan TIDAK disentuh** (keputusan owner 8 Sep:
metode harga-terakhir dipertahankan; jangan bangun FIFO/WAC).

| Objek | Isi |
|---|---|
| `bahan_baku.faktor_po` + trigger `trg_bahan_baku_faktor_po` | 52/52 bahan aktif; FOIL **760** · MIE **1** · PLASTIK BESAR **50** |
| `supplier` | 25 → 24 (duplikat `Lettuce (Pak Aziz)` digabung) |
| `bahan_baku_supplier` (+ `_history`) | **61 baris**; 14 siap prefill, 47 `perlu_ditinjau` |
| `apps/admin-dashboard/src/lib/satuanPo.ts`, `katalogVendor.ts` | 23 tes, fungsi murni |

### 🔴 Ranjau yang ditutup: `satuan_po` hidup tanpa faktor pendamping

`bahan_baku.satuan_po` terisi 52/52 sejak `20260908155000`, tapi **nol kode membacanya** dan
**tak ada kolom yang menyimpan konversinya**. Untuk 3 bahan `satuan_po` ≠ satuan master
(FOIL `roll` vs `Dus` 48×, MIE `bungkus` vs `Dus` 40×, PLASTIK BESAR `pack` vs `Ikat` 5×).
Siapa pun yang mewirekan `satuan_po` ke form PO sebagai label tanpa konversi akan
**melipatgandakan qty ledger**. Harga sebagian terlindungi guard `20260904120000`; **qty
tidak punya penjaga sama sekali**. `faktor_po` menutupnya, dan **sengaja mengembalikan NULL**
(bukan 1) saat label tak dikenal — `getDistribusiFactor()` mengembalikan 1 dalam keadaan itu,
dan untuk FOIL itu berarti diam-diam salah 48×.

`docs/MASTER-SATUAN-PO-DAN-DISTRIBUSI.md` §4 dikoreksi (v1.3): dua barisnya menyatakan
implementasi yang **belum ada** (`usePurchaseOrder.ts` memakai `satuan_po`, `useOpname.ts`
memakai unit distribusi) — keduanya nol referensi di `grep`. Kolom Status ditambahkan.

### 🔴 Pelajaran: harga PO historis memakai satuan yang berlaku SAAT ITU

Seed awal mengambil `harga_terima` apa adanya. Gerbang verifikasi menangkapnya: harga FOIL
tampak janggal. Sebabnya **bukan** salah kolom — FOIL berubah Roll→Dus **hari itu juga**
(`20260908103000`), jadi harga PO 31 Agustus memang tercatat per Roll. Rasio ke master persis
**48,000** (FOIL Altindo) dan **0,040 = 1/25** (POLYBAG).

**Aturan yang ditetapkan: harga hanya terisi untuk PO pasca-guard 4 Sep; sisanya `harga = 0`
+ `perlu_ditinjau`.** Angka yang percaya diri tapi salah skala lebih berbahaya daripada tidak
ada angka. Angka aslinya tidak hilang — `ref_po_id` menunjuk ke PO-nya.

⚠️ **Seed memakai `bahan_baku.satuan` + `faktor_tampilan`, BUKAN `satuan_po`/`faktor_po`** —
`harga_terima` tersimpan per satuan besar. Akibatnya **13 dari 61 baris punya
`satuan_beli` ≠ `satuan_po`**; Tahap 3 tidak boleh mengasumsikan keduanya sama.

### 🔴 Temuan review: trigger riwayat SECURITY INVOKER = semua tulisan klien gagal senyap

Trigger `bbs_tulis_riwayat` semula INVOKER, sementara tabel riwayat sengaja tanpa policy
INSERT. Karena `authenticated` tak punya `bypassrls`, **setiap INSERT/UPDATE katalog dari
klien akan gagal `42501` dan seluruh statement di-rollback.** Tidak ketahuan saat pengujian
karena `supabase db query --linked` terhubung sebagai `postgres`. Pola sama dengan insiden
`ledger_stamp_saldo` (8 Juli). Diperbaiki jadi `SECURITY DEFINER SET search_path = public`.

Sekalian di fix round yang sama: `REVOKE ALL FROM anon, authenticated` (default privileges
Supabase memberi ALL ke tabel baru — GRANT di migration tidak membatasi apa pun);
`changed_by` → `COALESCE(auth.uid(), NEW.updated_by)` (sebelumnya bisa dipalsukan klien);
unique parsial `is_preferred` → `WHERE is_preferred AND is_active`.

### ✅ Dedup supplier — SELESAI 9 Sep (`20260909100000`, applied & diverifikasi)

**Keputusan owner: nama kanonik `Lettuce (Pak Aziz)` & `PT Agro Boga Utama`, tapi baris
ber-termin berbeda DIPERTAHANKAN terpisah — "memang beda termin".** Termin berbeda =
kesepakatan pembayaran berbeda, bukan duplikat.

Premis spec ("satu-satunya duplikat tersisa") memang **salah**: Pak Aziz punya tiga baris
(`Lettuce (Pak Aziz)` · `L:ettuce (Pak Aziz)` typo titik dua · `Bapak Aziz`) dan ketiganya
**nomor HP yang sama** (`083876865070` = `+62 838-7686-5070`), plus `Agro Boga Utama` vs
`PT Agro Boga Utama`, plus baris sampah `sadsad`.

Yang dikerjakan: dua baris Aziz ber-tempo 15 digabung; baris tempo 30 dipertahankan; **baris
tempo 10 yang keliru digabung oleh `20260908231000` dipulihkan apa adanya** (0 PO, jadi tak
ada dokumen yang terganggu). Ketiganya dinamai `Lettuce (Pak Aziz) - Tempo 10/15/30` —
**nama harus membedakan, karena salah pilih di dropdown PO menggeser jatuh tempo utang
belasan hari.** Agro digabung (keduanya tempo 45). `sadsad` dihapus.

⚠️ **Baris yang bertahan dipilih berdasarkan DATA TERBAIK, bukan namanya.** Baris bernama
`Agro Boga Utama` memegang satu-satunya harga katalog terpercaya Agro (KENTANG Rp250.000);
menghapusnya akan menghilangkan harga itu lewat FK CASCADE, dan **seed ulang tak bisa
memulihkannya** karena semua PO milik baris satunya pra-guard (lahir sebagai harga 0). Jadi
baris itu yang disimpan lalu di-rename. Diverifikasi setelah apply: harga masih Rp250.000.

Hasil: **22 supplier, nol nama duplikat**; katalog 61 → **56 baris**, 14 siap prefill (tak
berkurang), riwayat 62 (baris riwayat milik katalog yang dihapus tetap hidup — `ON DELETE
SET NULL`, memang begitu desainnya).

### 📝 Sisa yang butuh keputusan owner

1. **PLASTIK BESAR: `kemasan_qty` 100 vs `faktor_tampilan` 250** (dan `faktor_konversi` 50
   yang konsisten dengan 250). Akarnya: PLASTIK BESAR sengaja dilewati saat normalisasi harga
   3 Sep — `20300122000001` baris 19 menulis sendiri *"belum dijawab"*, bersama SABUN,
   SEDOTAN, TUTUP PACK. Dampak: nilai persediaan Rp545.700 vs Rp218.280 (selisih Rp327.420,
   0,08%); **0 resep** memakainya jadi HPP tidak terpengaruh.
2. **Termin Pak Aziz** — ketiga tempo (10/15/30) kini berdiri sendiri sesuai keputusan owner,
   tapi belum dikonfirmasi ke supplier mana yang masih berlaku. Tempo 10 nol PO.

### Tertunda (minor, tercatat saat review)

`NaN` lolos `CHECK isi_satuan_kecil > 0` (Postgres: `'NaN'::numeric > 0` = true) · `btrim()`
SQL vs `String.trim()` TS beda perlakuan `\n`/NBSP · `harga_updated_at` tak dipelihara trigger
· DELETE katalog tak meninggalkan jejak riwayat · `DISTINCT ON` seed tanpa tiebreak final
(**wajib** ditambahkan kalau pola disalin ke RPC prefill Tahap 3) · `bolehPrefill` tanpa guard
`Number.isFinite`.

### Tahap berikutnya (plan terpisah, belum ditulis)

Layar pembanding harga antar vendor · form PO baca katalog · form terima PO pakai satuan
vendor · `verifikasi_terima_po` menulis balik ke katalog. Layar Tahap 2 **wajib** menyaring
`bahan_baku.is_active` dan **tidak boleh** merender `harga = 0` sebagai harga.

---

## Session 2026-09-09: Rekonsiliasi PO Impor Excel & Perbaikan `payment_status`

**Status:** ✅ Migration `20260909120000` applied & diverifikasi. ⚠️ **Perlu redeploy `finance`.**

### 🔴 Alur pelunasan PO rusak sejak 2 September — `payment_status` kehilangan `'pending'`

| Migration | CHECK `purchase_order.payment_status` |
|---|---|
| `20260711120000` (11 Jul) | `('unpaid','pending','paid')` — cocok dengan RPC |
| `20260902133000` (2 Sep) | ditulis ulang jadi `('unpaid','paid','lunas')` — **`pending` dibuang** |

RPC `settle_purchase_order` menulis `payment_status = 'pending'`, jadi sejak 2 September
**setiap pelunasan lewat finance dijamin gagal constraint.** Bukti di data: **nol** PO
berstatus `pending`, **nol** PO punya `cash_transaction_id` — alur itu tak pernah
menghasilkan apa pun. Yang ada 20 PO ber-`paid_at`, semuanya dari form manual.

**`'lunas'` juga membelah pembacaan.** Form (`PODetailView`) menulis `'lunas'`;
`usePurchasingDashboard` menghitung utang dengan `<> 'paid'`; `SupplierView` menghitung
lunas dengan `= 'paid'`. Jadi PO yang ditandai lunas lewat form **tetap tercatat sebagai
utang**, dan 23 PO impor bertanda `paid` tampil "Unpaid" di halaman detailnya.

**Perbaikan:** constraint dikembalikan ke `('unpaid','pending','paid')` (memulihkan RPC
sekaligus membuang `'lunas'`), 5 baris `'lunas'` → `'paid'`, badge `PODetailView` memakai
peta `PAY_BADGE`. **Utang terbuka 456.684.305 → 419.289.025.**

⚠️ **Jangan tambahkan `'lunas'` kembali ke constraint.** Kata itu lahir dari form, bukan dari
model datanya. Kosakata resmi = `unpaid | pending | paid` (`PoPaymentStatus`, `PAY_META`,
`settle_purchase_order`). `retail-gateway/src/lib/xendit.ts` juga memakai kata `lunas` — itu
**domain lain** (status pembayaran Xendit), jangan ikut diseragamkan.

### Rekonsiliasi 26 PO impor Excel `SPO-PO-047` (Agustus) — diparkir owner

26 PO (15–27 Agu, Rp414,9 jt) ditulis **langsung ke tabel**, melewati `verifikasi_terima_po`.
Itu satu sebab untuk dua akibat: ledger tak pernah ditulis, dan `jatuh_tempo` tak dihitung
dari termin. **24 di antaranya nol baris ledger** (Rp367,9 jt).

Dicocokkan dengan `adjustment` di Gudang Pusat (pencocokan **tak langsung** — `adjustment`
tidak menyimpan rujukan PO; dasarnya bahan + jumlah + tanggal + catatan):

| | Nilai | Porsi |
|---|---:|---:|
| Tertutup `adjustment` (12 bahan) | Rp 314.619.740 | 85,5% |
| Tertutup hanya lewat `opname_selisih` (6 bahan) | Rp 26.735.000 | 7,3% |
| Tak ada jejak (6 bahan) | Rp 26.505.055 | 7,2% |

TEPUNG & CUP cocok persis sampai angka terakhir. Sisa yang benar-benar perlu ditanya ke
gudang tinggal **Rp7.945.000** (STIKER, KETUMBAR, JINTEN) — FOIL sudah diselesaikan lewat
hitung fisik 8 Sep, dan PRINTER THERMAL / ID CARD memang bukan bahan baku.

**Keputusan owner: penyesuaian Agustus diparkir, fokus September.**

⚠️ **Jebakan saat mencocokkan:** ada `pembelian_supplier` 8 September yang qty-nya persis
sama dengan PO Agustus (JINTEN 10.000, KETUMBAR 50.000, KUNYIT 432). Itu **milik PO
September** dari Family Suplayer — daftar belanjanya kebetulan sama. Nyaris jadi kesimpulan
salah; selalu baca `catatan` ledger-nya, jangan cocokkan qty saja.

### September bersih

16 PO, **semua yang diterima menulis ledger** — nol celah. Masalah Agustus tidak berulang
karena PO September dibuat lewat aplikasi. 5 PO masih di supplier (Rp158,1 jt).

### 📝 Belum dikerjakan

- **Tab "Non-Bahan Baku" di Nilai Persediaan** — sudah disetujui owner, belum digarap.
  PRINTER THERMAL (`kategori='ASET'`) ikut terhitung **Rp4.885.072 (1,26%)** di nilai
  persediaan; ID CARD (`PERLENGKAPAN`) saldo nol. Rencana: pisahkan di sisi aplikasi
  (`useNilaiPersediaan` + `NilaiPersediaanBoard`), **bukan** di view — `nilai_persediaan_spv`
  didefinisikan migration bertimestamp **2030**, jadi migration bertanggal hari ini akan
  ditimpa diam-diam saat replay.
- Konfirmasi ke supplier: Toko Zein `SPB/…/042` (tempo 30 atau tunai) dan Altindo
  `SPB/…/021` (2.000 **Roll** FOIL — catatan itemnya `Satuan: ROLL`, bukan Dus).

---

## Session 2026-09-09: Waterfall Deduction — Bug Konversi Satuan Antar Bahan (apps/stok, DB)

**Status:** ✅ Fungsi DB diperbaiki & live (migration `20260909170000`, applied 2026-09-09
07:32:37 UTC / 14:32 WIB, terstempel di `schema_migrations`). Spec
`docs/superpowers/specs/2026-09-09-foil-dua-ukuran-design.md` dikoreksi di sesi yang sama.
**Nol app perlu redeploy** — murni fungsi database + dokumentasi, tak ada kode aplikasi
yang berubah.

### A. Bug: sisa limpahan tak dikonversi antar satuan

`process_waterfall_deduction` melacak sisa yang belum tertutup dalam **satuan besar bahan
utama**, lalu mengalikannya dengan `faktor_tampilan` **pengganti** saat menuliskannya ke
ledger — tanpa pernah mengoreksi bahwa kedua bahan bisa punya `faktor_tampilan` berbeda.

**Bukti live:** SAOS TOMAT POUCH (utama, 12.000 g/Dus) → SAOS TOMAT KOMPAN (pengganti,
16.500 g/Dus), rasio **1,375**. Resep 30 g memotong **41,25 g** di outlet yang POUCH-nya
sudah habis. Order #38 "Original Sapi Jumbo" menunjukkan tanda tangan persis: `-30` di
outlet yang POUCH-nya masih ada, `-41,25` di Beji & Depok Sukmajaya yang POUCH-nya kosong.

Skala sejak 2 Agustus 2026: **2.185 baris**, total **88.003,61 g** dipotong dari KOMPAN,
di antaranya **24.000,98 g tidak pernah benar-benar terpakai** (≈ Rp 273.000 @ Rp 11,3744/g).

**Perbaikan:** sisa kini dilacak dalam **satuan kecil** — basis yang dibagikan bersama oleh
sebuah bahan dan penggantinya (itulah syarat sebuah pasangan boleh disubstitusi). Setiap
kali fungsi berpindah bahan, sisa dalam satuan kecil dikonversi ke skala ledger bahan
tersebut sendiri sebelum ditulis.

### B. Dua keputusan yang jangan dibuka ulang tanpa alasan baru

**K1 — koreksi mundur DIBATALKAN, sengaja.** Spec awal minta koreksi ledger untuk 24.001 g
yang terlanjur terpotong. Tidak diperlukan dan justru berbahaya: kelima outlet terdampak
menjalankan opname hampir tiap hari, dan tiap `opname_selisih` menyetel ulang saldo ke hasil
hitung fisik — kelebihan potongan itu tak pernah sempat menumpuk.

| Outlet | Saldo kini | Koreksi terakhir |
|---|---:|---|
| DEPOK SUKMAJAYA | 10.093,75 | opname 8, 7, 6, 5 Sep |
| PALEDANG | 16.500 | opname 7, 5, 4 Sep |
| BEJI | 0 | opname 4 Sep |
| EMPANG | 0 | opname 28 Agu |
| KALISARI | 0 | opname 24 Agu |

Menyuntikkan `adjustment` sekarang akan menambah stok hantu di atas saldo yang sudah benar.
Baris `pemakaian` historis dibiarkan apa adanya — jejak audit, sudah diimbangi
`opname_selisih` di sebelahnya. HPP tidak terpengaruh: `get_hpp_periode` dihitung dari
resep × penjualan, bukan dari ledger.

**K2 — utang timestamp.** Fungsi ini juga didefinisikan oleh tiga migration bertimestamp
**2030** (`20300103000010`, `20300104000005`, `20300105000017`). Pada replay dari nol,
ketiganya jalan paling akhir (urut nama) dan akan menimpa balik fix ini. Timestamp 2030
**tidak dipakai** untuk fix ini karena `scripts/migration-timestamp-lint.mjs` menolak
apa pun >2 hari ke depan (`FUTURE_WINDOW_DAYS = 2`). Ketiga migration 2030 sudah applied &
terstempel di produksi, jadi `db push` tidak akan menjalankannya ulang — risiko terbatas
pada environment baru dari nol. Preseden sama dengan 2026-09-07.

### C. Dua temuan review yang tak dicari siapa pun

1. **`SET search_path` sempat hilang di produksi.** `CREATE OR REPLACE FUNCTION` di
   `20300105000017` diam-diam membuang `ALTER FUNCTION … SET search_path` yang ditambahkan
   `20300104000005` — fungsi `SECURITY DEFINER` ini berjalan tanpa `search_path` terkunci
   sejak saat itu. Migration baru memulihkannya. **Jebakan umum, layak dicatat:**
   `CREATE OR REPLACE FUNCTION` membuang opsi `SET` level-fungsi yang ditambahkan lewat
   `ALTER` belakangan; ia TIDAK membuang hak akses (`GRANT`/owner). Catatan kecil: header
   migration baru menyebut `20300104000005` seolah ikut mendefinisikan fungsinya —
   sebenarnya migration itu HANYA `ALTER FUNCTION ... SET search_path` (+ `REVOKE`), tidak
   pernah `CREATE OR REPLACE` body-nya; yang mendefinisikan body tetap `20300103000010` lalu
   `20300105000017`.
2. **Klaim "bug variabel basi" — TERBUKTI SALAH, dikoreksi di review final.** Draf
   antara sesi ini sempat menulis bahwa pengganti tanpa baris `stok_balance` meninggalkan
   `v_is_gram`/`v_faktor` "memegang nilai iterasi sebelumnya", dan `CONTINUE WHEN NOT FOUND`
   ditambahkan untuk menutupnya. **Itu tidak benar.** Di PL/pgSQL, `SELECT ... INTO` (tanpa
   `STRICT`) yang tidak menemukan baris SELALU menyetel target ke `NULL` — tidak pernah
   mempertahankan nilai sebelumnya. Kode lama (`20300105000017`) sudah menangani kasus itu
   lewat `COALESCE(v_current_stock, 0)` dan cek `v_current_stock > 0`; `NULL` pada
   `v_is_gram`/`v_faktor` tidak pernah membuatnya salah baca skala outlet lain.
   `CONTINUE WHEN NOT FOUND` di fungsi yang sudah diperbaiki adalah **perbaikan
   keterbacaan, bukan perbaikan bug** — kejelasan niat "lewati bahan yang belum pernah
   punya baris stok", tidak menutup celah yang sebelumnya tidak ada. Klaim ini sendiri layak
   dicatat: ia terdengar masuk akal (dan bahkan sempat lolos di draf review antara), padahal
   salah — koreksinya baru datang di review whole-branch final.

### D. Catatan untuk siapa pun yang menambah pasangan substitusi nanti

`trg_process_bom_stok` membagi dengan
`CASE WHEN faktor_tengah IS NOT NULL AND faktor_tampilan IS NOT NULL THEN faktor_tampilan
ELSE faktor_konversi END`, sementara fungsi yang sudah diperbaiki mengalikan balik dengan
`faktor_tampilan`. Round-trip ini eksak **hanya bila `faktor_tengah` terisi**. Keempat bahan
di pasangan substitusi hari ini memilikinya (SAOS TOMAT POUCH 12, KOMPAN 3, SAOS CABE POUCH
12, SAOS CABE 3), jadi konversinya eksak. Pasangan baru dengan bahan ber-`faktor_tengah NULL`
akan round-trip tidak eksak — periksa dulu sebelum menambah.

### E. Status verifikasi — jangan dinaikkan tanpa bukti baru

- Fungsi terpasang, `SECURITY DEFINER`, memuat `v_sisa_kecil` & `search_path` — **diverifikasi
  dua kali** (implementer & controller), masing-masing dengan **kontrol negatif yang benar-
  benar memicu error**, membuktikan jalur asersi bisa gagal (bukan selalu lolos).
- `schema_migrations` terstempel — terverifikasi.
- **Regresi jalur mayoritas (bahan tanpa pengganti): LOLOS.** FOIL, 7 baris setelah apply,
  empat nilai qty berbeda (−35, −40, −45, −120), semuanya sudah ada di himpunan pra-apply;
  tak ada nilai baru muncul.
- **Pembuktian perilaku untuk limpahan yang sudah dikoreksi: TERTUNDA.** Nol baris limpahan
  terjadi sejak apply — kejadian ini hanya muncul saat POUCH sebuah outlet benar-benar habis.
  Pengecekan susulan: baris `pemakaian` SAOS TOMAT KOMPAN dengan `catatan LIKE 'Penjualan%'`
  dan `created_at > 2026-09-09T07:32:37Z` harus menunjukkan **−30 / −50 / −60**, bukan
  −41,25 / −68,75 / −82,5.

### F. Surat jalan basi FOIL — klaim di spec yang TERBUKTI SALAH

Spec §6 sebelumnya menyatakan pembatalan 21 SJ basi "tidak menggeser saldo mana pun" karena
SJ `draft`/`dikirim` belum pernah mengkredit outlet. **Separuh klaim itu salah.** Outlet
tujuan memang belum dikredit sampai verifikasi — tapi **Gudang Pusat sebagai sumber sudah
didebit saat SJ ditandai `dikirim`**, bukan saat verifikasi.

Diverifikasi langsung: 21 SJ kandidat membawa **160 baris `ledger_stok`, seluruhnya
`transfer_keluar` di GUDANG PUSAT**, dan ke-21 nya terdampak. Porsi FOIL kecil (−396,08 cm
≈ 0,52 Roll); mayoritas adalah **31 bahan lain** yang ikut dalam kiriman yang sama —
**≈ Rp 33.001.761 lintas 32 bahan** (SAPI Rp 8,2 jt, AYAM Rp 7,5 jt, KENTANG Rp 4,8 jt
terbesar). Sebagai pembanding, 10 SJ FOIL yang sebelumnya pernah dibatalkan membawa **nol**
baris ledger — dibatalkan saat masih `draft`, sebelum debit terjadi.

**Ini bukan kerugian baru yang diciptakan oleh pembatalan** — debitnya sudah terjadi
Juli–Agustus. Yang belum terjawab: di mana barang itu secara fisik. Kalau sudah sampai
outlet, seharusnya di-*verifikasi*, bukan dibatalkan; kalau tidak pernah keluar gudang,
Gudang Pusat butuh `adjustment` pembalik. Draft SQL-nya **sudah ditulis tapi sengaja
disimpan di luar `supabase/migrations/`** — `SS COGS SET/USULAN-batalkan-sj-foil-basi-2026-09-09.sql`
— supaya `db push` siapa pun tidak bisa menerapkannya tanpa sengaja, dengan penanda
eksplisit "belum disetujui owner" di headernya — keputusan ini milik owner. Kalau
disetujui, kembalikan nama file aslinya `20260909180000_batalkan_sj_foil_basi.sql` dan
pindahkan ke `supabase/migrations/` sebelum di-apply.

Catatan tambahan: dua SJ FOIL 9 September yang masih `draft` pagi itu sudah berstatus
`dikirim` saat Task 4 dijalankan — dokumen berpindah status di tengah pekerjaan. Baris
September tetap dikecualikan dari daftar pembatalan.

### G. Deployment

**Nol aplikasi perlu redeploy** — seluruh pekerjaan sesi ini adalah fungsi database plus
dokumentasi.

### Artefak

- Migration: `supabase/migrations/20260909170000_fix_waterfall_konversi_satuan.sql`
  (applied); draft usulan pembatalan SJ FOIL **dipindah keluar dari `supabase/migrations/`**
  ke `SS COGS SET/USULAN-batalkan-sj-foil-basi-2026-09-09.sql` (ditulis, **belum di-apply**,
  menunggu keputusan owner — restore nama `20260909180000_batalkan_sj_foil_basi.sql` &
  pindah balik ke `supabase/migrations/` hanya setelah disetujui)
- Spec: `docs/superpowers/specs/2026-09-09-foil-dua-ukuran-design.md`

### 📝 Next

- **Pembuktian perilaku (§E) masih tertunda** — jalankan pengecekan susulan begitu ada
  outlet yang POUCH-nya habis lagi dan limpahan ke KOMPAN terjadi.
- **Keputusan owner atas 21 SJ FOIL basi** (§F) — verifikasi jika barang sudah sampai
  outlet, atau `adjustment` pembalik di Gudang Pusat jika tidak pernah keluar; draft SQL-nya
  sudah siap di `SS COGS SET/USULAN-batalkan-sj-foil-basi-2026-09-09.sql` (di luar
  `supabase/migrations/` dengan sengaja), tinggal menunggu izin apply — baru dipindah balik
  & di-rename `20260909180000_batalkan_sj_foil_basi.sql` setelah disetujui.
- **Jangan pecah FOIL dulu** (langkah 4–8 spec) — menunggu hitung fisik Gudang Pusat yang
  memisahkan roll 7,6 m dan 5 m; hitungan itu juga menjawab pertanyaan terbuka "1 Dus
  Altindo isi berapa roll?".

## Session 2026-09-10: Auto-Verifikasi Surat Jalan & Penutupan Tunggakan

**Status:** ✅ LIVE di produksi. Semua migration applied & diverifikasi ground-truth.
**Nol app perlu redeploy** — seluruhnya perubahan database.

**Spec/plan:** `docs/superpowers/specs/2026-09-10-auto-verifikasi-surat-jalan-design.md`,
`docs/superpowers/plans/2026-09-10-auto-verifikasi-surat-jalan.md`
**Pemantau:** `SS COGS SET/verifikasi-auto-sj-2026-09.sql`

### Masalahnya: separuh kiriman tak pernah diverifikasi

| Periode | SJ dibuat | Diverifikasi | Menggantung |
|---|---:|---:|---:|
| Agustus | 418 | 209 (50%) | 209 |
| 1–9 September | 93 | 52 (56%) | 39 |

Sebab menurut owner: lupa/malas, bukan kendala teknis. Akibatnya rantai stok
putus sebelah — Gudang Pusat didebit saat SJ ditandai `dikirim`, outlet tak
pernah dikredit.

**Yang menahan saldo outlet tetap positif ternyata opname.** Hanya 31 baris
`stok_balance` yang minus, 20 di antaranya BNR (korup sejak sebelum September).
Jadi opname selama ini menambal barang yang tak pernah tercatat masuk — dan
karena itu berhenti berfungsi sebagai pemeriksa. Owner: *"track barangnya
berantakan sehingga angka opname pun berantakan."*

**Yang hilang bukan uangnya, tapi jejaknya.**

### 🔴 Alurnya ternyata DUA TAHAP — ini yang paling sering disalahpahami

| Tahap | Siapa | Status jadi | Stok berubah? |
|---|---|---|---|
| 1. Terima barang | **Outlet** | `diterima_lengkap` | **Ya** |
| 2. Validasi & tutup | **Pusat** | `selesai` | Tidak |

`selesai` bukan hasil trigger — ia dari tombol `handleVerifyPusat` di
`apps/distribusi/src/components/distribusi/SuratJalanDetail.tsx:242`. Yang
menggantung macet di **tahap 1**.

Auto-verifikasi sengaja **berhenti di tahap 1**. Kiriman yang ditutup sistem
mengendap di antrean validasi Pusat — kalau ikut ditutup sampai `selesai`,
kiriman yang tak diperiksa siapa pun justru jadi satu-satunya yang lolos tanpa
mata manusia.

### Keputusan owner

| # | Keputusan |
|---|---|
| K1 | Tenggat = lewat hari, ditutup dini hari 02:00 WIB |
| K2 | Antrean validasi Pusat dipegang role **`kitchen`** |
| K3 | Mulai **11 September** (semula 14, digeser) |
| K4 | Tunggakan ditutup **sebagai dokumen, tanpa mengubah stok** |
| K5 | **Agustus dilewati seluruhnya** |

### 🔴 Angka 72 jam di draf pertama SALAH UKUR

Draf awal memakai jeda `created_at` → `updated_at` pada SJ `selesai`. Itu
mengukur jarak sampai **Pusat menutup dokumen** (tahap 2), bukan sampai outlet
memverifikasi (tahap 1).

Diukur ulang dari `surat_jalan_item.verified_at`, 216 SJ sejak 1 Agustus:
**98% diverifikasi di hari yang sama, 2% besoknya, NOL lebih dari itu.** Kalau
tak diverifikasi hari itu, praktis tak akan pernah — jadi tenggat "lewat hari"
sudah cukup, dan lebih tepat.

### Batas hari = 21:00, bukan tengah malam

Owner: barang tiba di outlet paling lambat 21:00. Kiriman yang ditandai dikirim
≥21:00 berarti barangnya baru jalan malam itu. Tanpa aturan ini, kiriman 21:10
Senin ditutup Selasa 02:00 — 5 jam kemudian, seluruhnya saat outlet tutup.
Terdampak 21 dari 524 SJ (4%).

Teknisnya: **tambah 3 jam sebelum ambil tanggalnya.** Sen 21:10 + 3j = Sel 00:10
→ hari Selasa. Diuji: 20:00 → 14 Sep, 21:10 → 15 Sep.

### ⚠️ pg_cron menjadwal dalam UTC

`0 19 * * *` = 19:00 UTC = **02:00 WIB keesokan harinya**. Salah pasang menggeser
tenggat 7 jam tanpa gejala apa pun. Q1 di skrip pemantau memeriksanya.

### Batas 11 September memisahkan dua perlakuan di tempat yang benar

```
sampai 10 Sep  ->  ditutup sebagai dokumen, TANPA stok  (opname sudah menyerap)
mulai 11 Sep   ->  auto-verifikasi, DENGAN stok         (rantai utuh sejak awal)
```

Tunggakan lama tak boleh dapat stok: barangnya sudah lama terserap opname,
menambahkannya lagi = stok hantu ratusan juta. Kiriman baru justru harus dapat
stok — itu gunanya fitur ini.

### Yang dikerjakan

| Migration | Isi |
|---|---|
| `20260910180000` | Kolom `auto_verified_at` + `ditutup_administratif_at` |
| `20260910181000` | **39 SJ (1–9 Sep) `dikirim` → `selesai`**, nol baris ledger |
| `20260910182000` | Fungsi `auto_verifikasi_surat_jalan(p_dry_run)` |
| `20260910183000` | Geser tanggal mulai 14 → 11 Sep |
| `20260910184000` | `cron.schedule '0 19 * * *'` |

**Dua kolom penanda, sengaja dipisah:** `auto_verified_at` menambah stok,
`ditutup_administratif_at` tidak. Digabung jadi satu kolom, perbedaan itu hilang
selamanya.

**`verified_at` sengaja TIDAK diisi** oleh auto-verifikasi — kolom itu berarti
"diverifikasi manusia" dan jadi satu-satunya cara mengukur apakah crew makin
tidak memverifikasi. Mengisinya merusak pengukuran itu permanen.

**Nol penulis stok baru.** Fungsi hanya mengisi `qty_terima` lalu memanggil
`finalize_surat_jalan_and_ledger` yang sudah scale-aware — kelas bug yang baru
ditutup 9 September ada persis di penulis stok.

### Verifikasi ground-truth

Setiap penerapan memakai assertion `DO`-block **plus kontrol negatif** yang
benar-benar melempar error, membuktikan kanal `exec_sql` bisa gagal — bukan
sekadar diam.

- Penutupan 39: target 39→0 · 10 Sep+ 14→14 · Agustus 180→180 · **nol baris
  ledger lahir setelah operasi, jenis apa pun**
- **Simulasi maju ke 16 Sep:** tanpa penjaga tanggal, **194 SJ akan tersapu**
  (seluruhnya pra-11-Sep, termasuk 180 Agustus). Dengan penjaga: **0**. Ini yang
  membuktikan penjaganya benar-benar menahan, bukan kebetulan nol.
- `cron.job` terdaftar, `schedule` persis `0 19 * * *`, `active = true`

### 📝 Belum selesai

- **12 SJ tanggal 10 September** masih `dikirim` (tinggal 12 per 17:56 WIB; satu
  lagi diverifikasi crew sesudah pengecekan pertama). Di luar aturan baru.
  Outlet-outlet itu opname tiap malam, jadi perlakuan yang benar besok =
  penutupan administratif tanpa stok, sama seperti yang 39.
  **Migration sudah ditulis tapi SENGAJA BELUM di-apply:**
  `20260910190000_tutup_tunggakan_sj_10_september.sql`. Ke-12 SJ itu baru dikirim
  15:53–17:13 WIB hari yang sama; menutupnya sore itu juga merampas kesempatan
  outlet memverifikasi, padahal verifikasi sungguhan lebih baik (stok
  benar-benar tercatat masuk, bukan cuma diserap opname). Keputusan owner: apply
  besok pagi setelah opname malam. Guard tiga lapis membuat SJ yang keburu
  diverifikasi otomatis terlewat, jadi daftarnya tak perlu disusun ulang.
- **Jalan pertama cron BELUM terjadi** (dicek 2026-09-10 17:56 WIB:
  `cron.job_run_details` untuk jobid 14 kosong). `0 19 * * *` UTC = 02:00 WIB,
  jadi jalan perdana nanti malam. Dry-run manual saat itu: **0 diproses, 0
  dilewati**; kontrol negatif menunjukkan **180 SJ akan tersapu tanpa penjaga
  `c_mulai`** (seluruhnya Agustus) — penjaganya benar-benar menahan.
  Jalan perdana 02:00 tgl 11 juga harus NOL: SJ yang dikirim tgl 11 belum lewat
  harinya. Hasil bukan-nol yang pertama baru wajar 02:00 tanggal 12.
- ⚠️ **`updated_at` bukan tanggal kirim yang stabil.** Migration `20260910181000`
  menulis `updated_at = now()`, jadi ke-39 SJ yang ditutup administratif kini
  ber-`updated_at` 10 Sep. Mereka aman dari fungsi auto (kena filter status +
  penanda), tapi jangan pernah pakai `updated_at` untuk merekonstruksi tanggal
  kirim historis — pakai `created_at`.
- **Seberapa sering meja validasi `kitchen` dikosongkan.** Owner memilih tetap
  di level role, bukan orang tertentu — ditanya ulang, dijawab "role kitchen
  aja". Antreannya sudah punya tempat: dashboard `apps/distribusi`, kartu & tab
  **"Perlu Verif"** (`page.tsx:610` & `:865`) yang menyaring persis
  `diterima_lengkap` + `diterima_sebagian`, jadi terlihat di halaman depan tanpa
  perlu layar baru. Yang belum ada cuma iramanya. **Sistem tidak bisa memaksa
  ini** — kalau antrean itu tak pernah dikosongkan, bebannya cuma pindah dari 17
  outlet ke satu meja Pusat. Q3 di skrip pemantau yang akan menunjukkannya.
- **`handleVerifyPusat` — SUDAH DIAUDIT 2026-09-10, lebih buruk dari dugaan.**
  Bukan sekadar "tanpa cek role di kodenya": RLS-nya sendiri terbuka lebar.
  `surat_jalan_all` & `surat_jalan_item_all` = PERMISSIVE, `cmd=ALL`,
  role `{public}`, `USING(true) WITH CHECK(true)`. Karena policy permissive
  di-OR-kan, **keempat policy ber-scope di kedua tabel seluruhnya dekoratif**.
  `anon` punya grant UPDATE di kedua tabel, dan
  `finalize_surat_jalan_and_ledger` (SECURITY DEFINER, penulis `ledger_stok`,
  nol cek role, tak pernah menyentuh `auth.uid()`) di-GRANT EXECUTE ke PUBLIC
  + anon — terbukti terjangkau lewat anon key: balasannya "Surat jalan not
  found", pesan dari **dalam badan fungsi**, bukan permission denied.
  Dampak terburuknya bukan stok palsu, melainkan memanggilnya pada SJ
  `dikirim` ber-`qty_terima` NULL: SJ tertutup ke `diterima_lengkap` tanpa satu
  baris ledger pun, dan fungsinya menolak verifikasi ulang — kiriman kehilangan
  haknya atas stok **permanen**.
  **DIPERBAIKI & LIVE 2026-09-10** (`20260910200000_tutup_rls_surat_jalan_using_true.sql`,
  applied + terstempel). Dua policy `USING(true)` dicabut, grant tulis `anon`
  dicabut, EXECUTE dicabut dari PUBLIC+anon. Verifikasi ground-truth **sesudah**:
  `qual='true'` 0 (dari 2) · `anon` UPDATE kedua tabel false · anon RPC lewat
  PostgREST kini **401/42501 permission denied** (sebelumnya masuk badan fungsi)
  · anon baca `surat_jalan_item` kini **200 []** (sebelumnya 200 + data nyata).
  **Kontrol positif dijalankan** (transaksi + `ROLLBACK`, jadi nol perubahan
  nyata): berpura-pura jadi crew asli lewat `request.jwt.claims` + `SET LOCAL
  ROLE authenticated` → crew tetap bisa baca item & mengisi `qty_terima`
  kirimannya sendiri, dan **nol** baris outlet lain tersentuh. Blok asersinya
  sendiri diuji dengan kontrol negatif yang benar-benar melempar error (P0001 di
  baris terakhir), membuktikan jalan senyap = lulus, bukan tak pernah jalan.
  Nol bukti pernah dieksploitasi: **0** SJ berstatus diterima yang nol baris
  ledger di seluruh riwayat (catatan: pemeriksaan itu hanya menangkap pola
  "ditutup tanpa stok"; qty_terima yang digelembungkan akan tampak seperti
  kiriman normal dan tak terdeteksi dari sini).
  `ledger_stok` sengaja tak disentuh — sudah benar (hanya SELECT + INSERT
  ber-scope, nol policy UPDATE/DELETE) dan justru jadi kontrol pembanding.
- **36 SJ `dikirim` memuat bahan nonaktif** → sengaja dilewati fungsi auto
  (`b.is_active = false`). **SELURUHNYA Agustus, nol September** (dicek
  2026-09-10 — koreksi atas catatan awal yang menulis "mayoritas"): ke-36 itu
  sudah tertahan penjaga `c_mulai` bahkan tanpa penjaga bahan-nonaktif, jadi
  kekhawatiran "menumpuk ke depan" jauh lebih lemah dari dugaan awal. Masuk
  aturan "Agustus dilewati" — tak perlu diapa-apakan.
  Bahannya: FOIL (48) (DIGABUNG KE FOIL) 15 · MAYONES 6 · PLASTIK BENING 5 ·
  SAOS TOMAT 5 · MINYAK (NONAKTIF) 3 · THERMAL STRUK 2 · TUTUP 2 · SARUNG
  TANGAN BENING 1. Semuanya sisa **penggabungan master data**, bukan barang
  yang benar-benar berhenti dipakai — barangnya nyata terkirim, nama masternya
  yang pensiun.
  **Risiko ke depan kecil tapi berkala.** Form pembuatan SJ sudah menyaring
  `is_active = true` (`apps/distribusi/src/hooks/useBahanBaku.ts:26`), jadi SJ
  baru tak akan pernah memuat bahan nonaktif. Yang kena hanya SJ yang **sudah
  terbit lalu bahannya dinonaktifkan sesudahnya** — persis kasus FOIL (10 SJ
  September memuat FOIL (48), semuanya sudah `selesai`, dibuat sebelum
  penonaktifan 8 Sep). Setiap penggabungan master data berikutnya bisa
  mengulangnya, dan SJ semacam itu **tak akan pernah ditutup cron** serta tak
  muncul di mana pun kecuali sebagai angka `dilewati` yang tak dilihat siapa
  pun. Penawar termurah = kebiasaan, bukan kode: **setiap menonaktifkan bahan,
  sisir dulu SJ `dikirim` yang memuatnya** (pelajaran yang sama dengan "sisir
  dokumen in-flight" saat FOIL ganti satuan Dus).
- 6 SJ tunggakan memuat `FOIL (48)` (nonaktif). Sudah ikut ditutup tanpa stok,
  jadi aman — tapi penjaga bahan-nonaktif di fungsi tetap perlu untuk ke depan.

## Session 2026-09-09: Tab App Retail Tahap 1 (apps/admin-dashboard)

**Status:** ✅ Kode selesai. ⚠️ Perlu **redeploy `admin-dashboard`**.

Grup nav baru **App Retail** (OWNER/ADMIN) dengan tiga halaman: Ringkasan,
Pengaturan Menu Aplikasi, Outlet Aplikasi. Menutup dua lubang yang sebelumnya
hanya bisa diisi lewat SQL langsung ke tabel produksi — `menu_items.tampil_di_app`
beserta `foto_app`/`deskripsi_app`/harga aplikasi, dan `outlets.app_enabled`
yang bahkan tidak punya UI sama sekali padahal ia satu-satunya gerbang antara
outlet dan pelanggan (`GET /api/v1/outlets` menyaring persis kolom itu).

**Syarat keras owner: nol gangguan ke POS, web maupun native.** Ditegakkan
sebagai pemeriksaan, bukan niat: `git diff --name-only origin/main...HEAD`
harus nol baris di `apps/pos-kasir`, `mobile/`, `pos-admin/`, dan
`supabase/migrations/`. **Tahap 1 nol migration.**

### ⚠️ Gotcha: jangan tambahkan baris "Aplikasi" ke `sales_channels`
Mode "Satu Harga Semua" di `MenuView.tsx` menyapu SELURUH baris `sales_channels`
dan menulis satu harga ke tiap slug-nya. Baris "Aplikasi" di tabel itu membuat
harga aplikasi ikut tertimpa setiap kali admin mengatur harga food apps. Slug
`aplikasi` sengaja hidup hanya sebagai kunci di `menu_items.channel_prices`.

### ⚠️ Gotcha: `channel_prices` wajib digabung, bukan ditimpa
Satu kolom JSON memuat harga semua kanal. Menulis `{ aplikasi: ... }` polos
menghapus harga GoFood, GrabFood, dan ShopeeFood sekaligus. Semua penulisan
lewat `gabungHargaChannel` (`src/lib/appRetail/hargaAplikasi.ts`, ber-test).

### Diketahui, sengaja dibiarkan
Toggle & harga aplikasi masih ada juga di layar menu POS (pekerjaan pagi
9 Sep). Mencabutnya berarti menyentuh POS — melanggar syarat di atas — jadi
dibiarkan berdampingan. Dua tempat, satu kolom; membingungkan tapi tak bisa
menghasilkan data yang bertengkar.

**Tidak ada guard role khusus di `/dashboard/app-retail`.** `RoleContext.tsx`
memakai allowlist untuk MITRA/LEADER/AREA_MANAGER/PURCHASING, jadi keempatnya
terlempar dari rute ini; OWNER & ADMIN memang dituju. Tapi **`ADMIN_HR` tidak
punya allowlist sama sekali** dan bisa membuka rute mana pun di admin-dashboard,
termasuk halaman yang menyalakan outlet ke pelanggan. Itu **pre-existing dan
berlaku app-wide**, bukan diciptakan tab ini. Sengaja tidak ditambal di sini:
guard halaman berjalan di browser dan TIDAK melindungi Server Action (pelajaran
Session 2026-07-20). Perbaikan yang benar adalah cek role DI DALAM server
action, pola `requireOpnameApprover` — pekerjaan tersendiri, untuk semua
halaman, bukan tambalan untuk satu rute.

**Spec/plan:** `docs/superpowers/specs/2026-09-09-app-retail-tahap1-design.md`,
`docs/superpowers/plans/2026-09-09-app-retail-tahap1.md`

### Yang ditangkap review (tiga cacat, semuanya berasal dari rencana)

Bukan kesalahan implementer — ketiganya disalin verbatim dari kode rencana:
1. **Ringkasan**: `count ?? 0` membuat query gagal tak bisa dibedakan dari nol
   sungguhan, di halaman yang tujuannya justru menjawab "kanal ini hidup atau
   tidak". Diperbaiki: `—` + penanda galat, nol sungguhan tetap `0`.
2. **Panel edit**: `CurrencyInput` mengirim `0` saat kolom dikosongkan, jadi
   kolom harga menampilkan **"0"** persis di bawah kalimat "Kosong berarti ikut
   harga kasir, bukan gratis". Diperbaiki di sisi pemanggil (`CurrencyInput`
   dipakai bersama app lain, tidak disentuh).
3. **Panel edit**: toggle tayang membaca prop `item` yang beku, sehingga setelah
   klik pertama tampilannya tak pernah berubah dan klik berikutnya mengirim
   nilai basi. Diperbaiki dengan state lokal. Halaman Outlet Aplikasi TIDAK
   mengulang cacat ini — reviewer menelusurinya khusus.

**📝 Next:** redeploy `admin-dashboard`; smoke test sebagai ADMIN (nyalakan satu
menu, cek `GET /api/v1/catalog` ikut berubah); banner & voucher tahap berikutnya.
- Pertimbangkan cek role di dalam server action (lihat "Diketahui, sengaja
  dibiarkan") — berlaku untuk seluruh admin-dashboard, bukan hanya tab ini.

---

## Session 2026-09-10: Sapuan RLS Lintas Tabel — pola `USING(true)` masih luas

**Status:** 🔴 Temuan, **belum diperbaiki**. Butuh triase owner — lingkupnya
lintas app (HR, POS, finance), terlalu luas untuk ditutup sepihak.

Lanjutan audit `handleVerifyPusat` (entri di atas). Karena `surat_jalan`
ternyata punya policy `USING(true)` yang membatalkan seluruh perbaikan Juli,
pola yang sama disapu ke **seluruh** tabel `public`.

### Kabar baik: `orders` & `bypass_requests` SELAMAT
Perbaikan Juli di sana **bertahan** — nol policy `USING(true)` tersisa, semua
ber-scope `accessible_outlet_ids()`. Jadi `surat_jalan` memang kasus sial
(punya policy `_all` liar yang tak diketahui perbaikan Juli), bukan tanda
seluruh perbaikan Juli gagal.

### 🔴 Tingkat 1 — terbuka untuk `anon` (tanpa login sama sekali)
Policy `roles={public}` + `USING(true)`, dan `anon` punya grant tabelnya.
Dikonfirmasi lewat HTTP nyata dengan anon key: **ada data** di
`cancellation_requests`, `ecommerce_sales`, `order_items`.
Berlaku juga `ecommerce_channels/entities/menu_prices/sale_items` (ALL) —
`ecommerce_menu_prices` balas kosong **karena tabelnya memang 0 baris**, bukan
karena tertutup; jangan salah baca itu sebagai aman.

### 🔴 Tingkat 2 — terbuka untuk SIAPA PUN yang login, termasuk crew
Policy `roles={authenticated}` + `USING(true)`. **Dibuktikan dengan menyamar
jadi crew asli** (`request.jwt.claims` + `SET LOCAL ROLE authenticated`), di
dalam transaksi + `ROLLBACK` — nol perubahan nyata:

| Tabel | Baris yang bisa diubah crew | Artinya |
|---|---:|---|
| `payroll_records` | **378** | gaji seluruh karyawan |
| `menu_outlet_prices` | **368** | harga jual per outlet |
| `bahan_baku` | **69** | harga beli → dasar HPP |
| `cash_advances` | **18** | kasbon |
| `global_settings` | **9** | setelan sistem |
| `ledger_stok` *(kontrol)* | **0** | ✅ membuktikan uji bisa nol |

Baris kontrol itu yang membuat angka di atasnya bisa dipercaya — bukan artefak
metode. Tabel lain sekelas: `leave_requests`, `discipline_records`,
`attendance_logs`, `cash_advance_payments`, `menu_packages`, `sales_channels`,
`order_online_*`.

### Ciri khas pola ini (untuk pengenalan cepat)
Nama policy generik peninggalan scaffold awal: *"Allow authenticated
insert/update/delete"*, *"Enable all access for authenticated users"*,
*"Allow all for ..."*. Kalau ketemu nama seperti itu, hampir pasti
`USING(true)`. **`ledger_stok` adalah bukti pola ini bisa benar** — ia hanya
punya SELECT + INSERT ber-scope, nol policy UPDATE/DELETE, jadi tertutup rapat
walau grant tabelnya terbuka.

### ⚠️ Jangan tutup massal dalam satu migration
Tiap tabel di atas menopang app berbeda (HR, POS, finance, absensi). Mencabut
policy tanpa tahu alur sah tiap app = mematikan fitur di produksi. Urutan yang
disarankan: mulai dari yang taruhannya tertinggi & alurnya paling sempit
(`payroll_records`, `bahan_baku`), satu tabel satu migration, tiap kali dengan
**kontrol positif** (simulasi user sah + `ROLLBACK`) seperti yang dipakai di
`20260910200000`.


## Session 2026-09-10: Fondasi Multi-Vendor — aturan, normalisasi, detektor

**Status:** ✅ LIVE (`20260910210000`, applied + terstempel + diuji perilaku).
Nol app perlu redeploy — murni database.

### Aturan fundamental (ini yang menjawab "bahan punya banyak vendor gimana")

> **Vendor adalah atribut PEMBELIAN, bukan identitas BARANG.**
> Satu-satunya hal yang memaksa sebuah bahan dipecah:
> **isi satuan-beli yang berbeda antar vendor.**

Ini **batas teknis, bukan preferensi**: stok disimpan dalam satuan terkecil, dan
jembatan satuan-besar → satuan-kecil (`faktor_konversi`/`faktor_tampilan`) adalah
kolom **per-bahan**. Dua nilai berbeda tidak muat di satu kolom.

Harga beda, termin beda, merek beda — **tidak** memaksa pemisahan. Kalau harus
dipecah, penamaannya mengikuti **spesifikasi** (`FOIL 5M`/`FOIL 7,6M`), **bukan
merek** — mengikat nama ke vendor mengulang kegagalan `FOIL (48)`, dan langsung
salah begitu vendor ganti ukuran atau ukuran sama dibeli dari vendor lain.

**Bukti lapangan:** dari **15 bahan multi-vendor, hanya 1 (FOIL) yang isinya
berbeda** (Ekadharma 760 cm/roll vs Altindo 500 cm/roll). Empat belas sisanya
(SAPI 3 vendor, AYAM, KENTANG, dst) berjalan tanpa masalah sama sekali.
Kekacauan FOIL bukan karena dua ukuran itu ada, tapi karena **baru ketahuan
setelah bercampur di rak**.

### Yang dibangun

| | Isi |
|---|---|
| **Normalisasi** | `satuan_beli` → huruf kecil + trim, mengikuti `canon()` di `satuanPo.ts` supaya data & kode sepakat. 11 baris dirapikan, ragam 15 → 11. Trigger `trg_bbs_normalisasi_satuan` menjaga input berikutnya (diuji: `"  DUS  "` → `"dus"`, di dalam transaksi + ROLLBACK). |
| **Detektor** | View `vendor_konflik_spesifikasi` (`security_invoker=true`). `tingkat`: `konflik_isi` (wajib dipecah **sebelum barang masuk**) · `beda_satuan` (wajib dilihat) · `aman`. Hasil sekarang: **14 aman, 1 konflik_isi (FOIL)**. |

⚠️ **`satuan_beli` SAH berbeda dari `bahan_baku.satuan`** — FOIL dibeli per
`roll` sedangkan masternya `Dus`. Yang dinormalkan hanya penulisannya, **jangan
pernah** samakan katanya ke master. Efek samping: layar Katalog Harga Vendor kini
menampilkan huruf kecil; kapitalkan di lapisan tampilan, jangan di data.

### Status FOIL — pemecahan TIDAK jadi dikerjakan sekarang

Hitung fisik owner 2026-09-10: **Altindo kosong, Ekadharma 928 roll**. Dan **nol
PO FOIL berjalan** dari vendor mana pun. Jadi gudang cuma memegang satu ukuran →
`faktor_tampilan` 36.480 (48 × 760) **sekarang benar**. Memecah hari ini berarti
membuat bahan bersaldo nol. Masalah campur-dua-ukuran **habis terpakai sendiri**.

Spec `2026-09-09-foil-dua-ukuran-design.md` **tetap berlaku**, statusnya berubah
dari "segera dikerjakan" → **"siap dipakai saat detektor menyala"**. Pemicunya:
keputusan membeli Altindo lagi. **Aturan urutan: pecah DULU, sebelum roll 5 m
masuk gudang** — memecah saat gudang masih satu ukuran itu bersih; memecah
setelah tercampur di rak adalah kekacauan yang baru saja lewat.

**Selisih tersisa:** sistem 723.520 cm vs fisik 928 × 760 = 705.280 cm →
**+18.240 cm = tepat 24 roll = tepat setengah dus** (± Rp 277.000). Angka terlalu
bulat untuk kebetulan; belum dikoreksi, belum ditelusuri.

**Harga per satuan pakai:** Ekadharma **Rp 15,20/cm** vs Altindo **Rp 17,58/cm** —
Altindo **13,5% lebih mahal** untuk barang yang sama; harga per rollnya rendah
semata karena rollnya lebih pendek.

### (2) Penjaga di titik masuk — ✅ LIVE (`20260910220000`)

`trg_cek_isi_kemasan_vendor` di `ledger_stok` BEFORE INSERT. Menolak baris
`pembelian_supplier` ber-`ref_po_id` bila `isi_satuan_kecil` vendor itu berbeda
dari isi turunan master untuk `satuan_beli`-nya (toleransi 0,1%, untuk pembulatan
saja).

**Ini satu-satunya penjaga di jalur PO yang MEMBLOKIR, dan bedanya bukan selera.**
Dua penjaga lama (`PO uji coba`, `salah satuan harga`) sengaja tidak memblokir —
mereka menahan penulisan harga master lalu mencatat penolakan di
`bahan_baku_harga_history`; penerimaannya sendiri tetap sah karena qty-nya benar.
Untuk **qty tidak ada jalan mundur yang aman**: `to_ledger_scale()` memakai faktor
milik BAHAN, bukan vendor, jadi tak ada nilai yang sekaligus benar untuk saldo cm
DAN hitungan Roll/Dus yang dilihat crew saat opname. Menulis apa pun = memilih
siapa yang dibohongi. Jadi penjaga ini menegakkan urutan: **pecah dulu, baru
terima.**

**Dipasang sebagai trigger, bukan dengan mengubah `verifikasi_terima_po`** —
fungsi itu ~300 baris dan memuat dua penjaga terbukti; `CREATE OR REPLACE` tak
akan mengeluh kalau salah satunya hilang (persis cara ranjau-2030 membuang fix
reversal BOM tanpa suara). Trigger juga menjaga jalur penulis lain, sekarang
maupun nanti.

**Diam kalau tidak bisa memastikan** (tak ada baris katalog · `isi_satuan_kecil`
kosong · `satuan_beli` tak memetakan ke tingkat satuan mana pun, mis. PRINTER
THERMAL `unit`). Menolak berdasarkan ketidaktahuan lebih buruk daripada tidak
menolak.

**Aman memblokir — diukur, bukan diasumsikan:** seluruh katalog aktif dicek, tiap
baris `isi_satuan_kecil` COCOK dengan turunan master, kecuali FOIL/Altindo.

**Diuji perilaku** (transaksi + `ROLLBACK`, nol perubahan nyata): Altindo **ditolak**
dengan pesan terbaca manusia · Ekadharma **lolos** (nol alarm palsu) · jalur
mayoritas (`adjustment`, `pembelian_supplier` tanpa PO) **tidak terganggu** —
penting karena trigger ini duduk di tabel yang dilewati tiap potongan BOM tiap order.

### 📝 Next
- Koreksi selisih 24 roll FOIL di Gudang Pusat (opname atau `adjustment` −18.240 cm).
- Munculkan `vendor_konflik_spesifikasi` di layar Katalog Harga Vendor — detektornya
  masih **pasif**, harus ada yang membuka view-nya.

**Last updated:** 2026-09-10  
**Owner:** Dev Suka Shawarma
