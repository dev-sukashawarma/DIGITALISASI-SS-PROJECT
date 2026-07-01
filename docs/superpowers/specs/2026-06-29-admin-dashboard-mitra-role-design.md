# Design: `mitra` role — outlet-scoped read-only partner dashboard

**Date:** 2026-06-29
**App:** `apps/admin-dashboard` (+ `packages/auth`, Supabase)
**Status:** Approved (design), pending implementation plan

## Goal

Tambah role baru **`mitra`** (partner/investor sebuah outlet). Mitra hanya bisa
melihat dashboard untuk **outlet yang dia pegang** — view-only, tanpa bisa
melihat angka outlet lain.

## Decisions (hasil brainstorming)

| Pertanyaan | Keputusan |
|---|---|
| Isi dashboard mitra | Owner Dashboard yang sudah ada, **di-scope** ke outlet mitra |
| Mapping mitra ↔ outlet | **1 mitra = 1 outlet** via `outlet_staff.outlet_id` (seperti crew/kasir) |
| Halaman yang dilihat | Ringkasan Bisnis, Target Harian, Profitabilitas, Pengeluaran — **read-only**. TIDAK termasuk "Pesan ke Kasir" |
| Isolasi data | **Server-enforced** (DB-level), bukan UI-only |
| Strategi isolasi | **Approach A** — scope via `accessible_outlet_ids()` + scoped views + RLS |

## Non-goals (YAGNI)

- Tidak ada perhitungan bagi-hasil / ROI partner.
- Tidak ada mitra multi-outlet (1 mitra = 1 outlet).
- Mitra tidak bisa mengedit apa pun (target, pesan, dll).
- Tidak mengubah perilaku dashboard owner/admin/SPV yang sudah ada.

## Data sources yang disentuh 4 halaman mitra

| Halaman | Membaca dari | Status RLS saat ini |
|---|---|---|
| Ringkasan Bisnis | `sales_hourly_spv`, `menu_sales_spv`, `daily_target_progress_spv`, `outlets` | SPV definer views → semua outlet |
| Profitabilitas | `sales_hourly_spv`, `expenses`, `outlets` | view bypass + tabel `expenses` |
| Pengeluaran | `expenses`, `outlets` | tabel |
| Target Harian | RPC `get_current_targets`, `daily_sales_targets` | tabel + RPC |

Edit surface yang harus disembunyikan untuk mitra: RPC `set_daily_target` &
`clear_daily_target_override` (dipakai halaman Target **dan** modal "Set Target"
di komponen `DailyTargetBoard` pada halaman Ringkasan).

## Architecture — Approach A

Manfaatkan primitive `accessible_outlet_ids()` yang sudah dipakai untuk scoping
leader/crew. Untuk admin/owner helper mengembalikan **semua** outlet, jadi
dashboard mereka tidak berubah; untuk mitra helper mengembalikan **satu** outlet.

### 1. Role plumbing (central)

- `packages/auth/src/types.ts`: tambah `'mitra'` ke union `Role`.
- `packages/auth/src/access.ts`: `ROLE_APP_ACCESS.mitra = ['admin-dashboard']`.
  (Portal role-redirect chokepoint sudah mengarahkan role ke app-nya.)
- **Rebuild `@suka/auth`** (`dist/` gotcha — consumer impor hasil build, bukan `src/`).
- DB: perluas constraint/enum `outlet_staff.role` agar menerima `'mitra'`
  (pola sama dengan migrasi `add_admin_hr_role` / `add_kitchen_role`).

### 2. Data scoping (satu migration)

- `accessible_outlet_ids()`: tambah cabang `mitra` → kembalikan `me.outlet_id`
  (single home outlet), mirip cabang crew/kasir/kiosk.
- Buat scoped views yang dikonsumsi admin-dashboard:
  - `sales_hourly_scoped`
  - `menu_sales_scoped`
  - `daily_target_progress_scoped`

  Masing-masing `SELECT * FROM <base> WHERE outlet_id IN (SELECT accessible_outlet_ids())`,
  dibuat dengan `security_invoker = true` agar `auth.uid()` resolve per pemanggil
  (helper-nya sendiri `SECURITY DEFINER`).
- Tambah SELECT RLS policy pada `expenses` & `daily_sales_targets`:
  `USING (outlet_id IN (SELECT accessible_outlet_ids()) OR outlet_id IS NULL)`.
  Klausa `IS NULL` menjaga baris **target default global** tetap terbaca.
  Verifikasi read owner/admin tetap lolos (helper mengembalikan semua outlet untuk mereka).
- RPC `get_current_targets`: pastikan sudah self-scope via `accessible_outlet_ids()`;
  jika saat ini mengembalikan semua outlet tanpa syarat, scope dengan cara yang sama.
- Repoint hook admin-dashboard ke scoped views: `useSalesSummary`, `useSalesHourly`,
  `useMenuSales`, `useTargetProgress`. Output owner/admin tidak berubah; view `_spv`
  yang dipakai SPV/stok **tidak disentuh**.

### 3. admin-dashboard UI

- **`RoleContext`**: tambah `'MITRA'` ke set role yang diizinkan + tipe `Role` lokal;
  expose `outletId` dan flag `isReadOnly` (true bila `MITRA`) lewat context agar
  halaman/komponen mengonsumsi scope secara terpusat.
  Route-guard: mitra dibatasi ke `/dashboard/owner`, `/dashboard/owner/targets`,
  `/dashboard/owner/profit`, `/dashboard/owner/expenses`; path lain → `replace('/dashboard/owner')`.
- **`navConfig`**: mitra melihat satu grup berlabel **"Dashboard Mitra"** berisi
  tepat 4 item — Ringkasan Bisnis, Target Harian, Profitabilitas, Pengeluaran.
  TANPA "Pesan ke Kasir", tanpa grup HR & System/Admin.
- **Landing** (`/` dan `/dashboard`): mitra → redirect ke `/dashboard/owner`.
- **`PeriodFilter`**: tambah prop `lockedOutletId`. Bila di-set (mitra), render
  outlet sebagai label statis (bukan combobox) dan paksa `filter.outletId` ke
  outlet mitra (tanpa opsi "Semua Outlet").
- **Read-only**: gate semua affordance edit pada `isReadOnly`:
  - Halaman Target: sembunyikan input/Save/Clear + card target default global;
    tampilkan nilai target outlet-nya saja.
  - `DailyTargetBoard`: sembunyikan tombol "Set Target" + modal-nya.
  - Profit / Expenses / Ringkasan sudah murni read.

### 4. Provisioning

- `StaffForm` array `ROLES`: tambah `'mitra'`. (1 mitra = 1 outlet via select
  "Outlet Home" yang sudah ada — tidak perlu UI multi-outlet.)
- Edge function `admin-create-staff`: pastikan menerima `'mitra'`
  (perluas validasi role bila ada whitelist).

## Testing

- Unit: cabang `mitra` di `accessible_outlet_ids()` (atau helper akses), item nav
  yang accessible untuk `MITRA`, dan logika gating read-only.
- DB isolation: query scoped view sebagai sesi mitra → hanya outlet-nya yang muncul;
  query sebagai owner → tetap semua outlet.
- Manual smoke: login mitra → hanya 4 menu tampil, filter outlet terkunci, tak ada
  tombol edit, tak bisa akses route HR/admin.

## Catatan / pre-existing drift

- `accessible_outlet_ids()` masih bercabang pada `'kepala_outlet'`, bukan nama baru
  `'leader'` (drift lama). **Dibiarkan apa adanya** kecuali diminta diperbaiki.
- Outlet bernama `"MITRA SUKA …"` sudah ada di data (konsep partner sudah tersirat).

## Rollout

1. Migration (role constraint + helper + scoped views + RLS).
2. Rebuild & publish `@suka/auth`.
3. Repoint hooks + UI gating di admin-dashboard.
4. `type-check` + `build` admin-dashboard.
5. Seed 1 akun mitra uji → smoke test isolasi.
6. Redeploy `admin-dashboard` ke produksi.
