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

## Deployment — cPanel + CloudLinux Node Selector + LiteSpeed

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
- **Reset baseline 2026-07-08:** semua outlet operasional diset `threshold + 5` (Kitchen id `550e8400-e29b-41d4-a716-446655440001` = `+30`) via **643 `adjustment` ledger** (bukan tulis langsung). Exclude `Kantor Pusat` & `SUKA SHAWARMA HQ` (dummy 9999). Threshold efektif = `COALESCE(outlet_reorder_point.reorder_point, bahan_baku.default_reorder_point, 10)`.
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

**Last updated:** 2026-07-18  
**Owner:** Dev Suka Shawarma
