# Admin-Dashboard Fase 2 — Outlet Master Data (Design)

**Date:** 2026-06-19
**App:** `apps/admin-dashboard`
**Status:** Design approved, pending implementation plan
**Depends on:** Fase 1 (Staff Management) — shares shell, auth guard, React Query, sidebar.

---

## 1. Goal & Scope

Beri admin satu tempat untuk mengelola **master data outlet** (CRUD penuh atas tabel `outlets`).

**In scope:**
- List + filter outlet (search nama/slug, filter aktif/nonaktif).
- Create outlet baru.
- Edit field outlet: `name, slug, address, lat, lng, type, is_active`.
- Delete dua-tier: **soft delete** (`is_active=false`) default + **hard delete** (permanen) hanya untuk outlet tanpa referensi.

**Out of scope (eksplisit):**
- **Reorder-point per outlet** — tetap di app `stok` (`/stok/settings/threshold`, tulis ke `outlet_reorder_point`). TIDAK dipindah/diduplikasi.
- **Penugasan `kepala_outlet`** — tetap di Staff Management Fase 1 via tabel `staff_outlets` (many-to-many). Satu sumber kebenaran.
- Kolom baru (phone, jam operasional) — belum ada konsumennya; tambah saat ada fitur yang butuh.
- Integrasi edge function `sync-outlets` / Ecosystem sync — tabel `outlets` diperlakukan **canonical / source of truth**. Tidak ada sync dua arah.
- Map-picker untuk lat/lng (pakai input angka + paste-helper; full picker fase lain).

---

## 2. Data Model (existing)

Tabel `outlets` (dari `20260609000000_create_outlets.sql`):

| kolom | tipe | catatan |
|---|---|---|
| `id` | UUID PK | **tanpa default** → generate client-side (`crypto.randomUUID()`) saat create |
| `slug` | TEXT UNIQUE NOT NULL | identifier; auto-slugify dari name, editable |
| `name` | TEXT NOT NULL | |
| `address` | TEXT | opsional |
| `lat` | NUMERIC NOT NULL | dipakai geofence absensi + peta → **wajib** |
| `lng` | NUMERIC NOT NULL | idem |
| `type` | TEXT default `'outlet'` | |
| `is_active` | BOOLEAN NOT NULL default true | soft-delete flag |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**RLS (sudah ada, `20260612000002_fix_outlets_rls.sql`):**
- `outlets_select_authenticated` — semua authenticated boleh SELECT.
- `outlets_all_admin` — admin (`profiles.role='admin'`) boleh INSERT/UPDATE/DELETE.

> **Konsekuensi arsitektur:** Tidak seperti Staff (butuh edge function service-role karena menyentuh `auth.users`), outlet CRUD = data tabel biasa + RLS admin sudah ada → **tulis langsung via browser supabase client dengan sesi admin sendiri**. Tidak ada edge function / penambahan `adminApi`.

---

## 3. Architecture

Mirror struktur Fase 1, write path lebih sederhana (direct PostgREST).

```
src/app/dashboard/outlets/page.tsx     → admin-only guard (pola sama staff/page.tsx)
src/hooks/useOutlets.ts                → EXTEND: read penuh (saat ini hanya {id,name})
src/hooks/useOutletMutations.ts        → create / update / softDelete / hardDelete
src/components/
  OutletTable.tsx        → list, status badge, aksi edit/nonaktif/hapus
  OutletForm.tsx         → create + edit (semua field)
  OutletFilters.tsx      → search + filter aktif (pola StaffFilters)
  DeleteOutletDialog.tsx → soft default + hard-delete bertahap (typed-confirm)
src/lib/
  slugify.ts             → name → slug (pure, TDD)
  parseLatLng.ts         → "−6.59, 106.80" → {lat,lng} (paste-helper, pure, TDD)
  filterOutlets.ts       → search + active filter (pure, TDD; pola filterStaff)
  types.ts               → EXTEND interface Outlet → full row
```

**Sidebar:** tambah `{ href: '/dashboard/outlets', label: 'Outlet', icon: Store }` antara Ringkasan dan Staff.

---

## 4. Data Flow & Logic

### Read
`useOutlets` di-upgrade dari `select('id,name')` → full row, order by `name`.
Konsumen read-only lama (StaffFilters, OutletMultiSelect) pakai `{id,name}` — full row = superset → tetap jalan tanpa perubahan.

### Create
1. Admin ketik `name` → `slugify(name)` auto-isi field `slug` (live, tetap editable & terlihat).
2. Submit: generate `id` via `crypto.randomUUID()`.
3. `lat`/`lng` **wajib** (number input). Tombol **"Paste dari Google Maps"** → `parseLatLng()` mem-parse string `"-6.5971, 106.8060"` mengisi kedua field. Cegah outlet `0,0` (Null Island) yang merusak geofence.
4. Uniqueness slug: pre-check terhadap list ter-load; `UNIQUE` DB = guard sebenarnya → tangkap `23505` → "Slug sudah dipakai outlet lain."

### Edit
- Slug default **read-only** + toggle kecil "ubah slug" disertai peringatan ("mengubah slug bisa memutus link").
- Field lain bebas edit. Set `updated_at = now()` saat update.

### Delete (dua-tier)
- **Nonaktifkan** (default) → `is_active=false`. Reversibel via toggle/edit.
- **Hapus permanen** hanya muncul/enabled untuk outlet **tanpa referensi**.
  - Cek live sebelum enable — count baris di: `outlet_staff`, `staff_outlets`, `ledger_stok` untuk `outlet_id` tsb.
  - Ada referensi (> 0) → tombol disabled + alasan tampil.
  - Semua 0 → enabled di balik dialog **typed-confirmation** (ketik nama outlet untuk konfirmasi).
  - Backstop: FK DB → tangkap `23503` → "Outlet masih punya data terkait, tidak bisa dihapus permanen."

---

## 5. Error Handling

| Kondisi | Pesan |
|---|---|
| `23505` (dup slug) | "Slug sudah dipakai outlet lain." |
| `23503` (FK saat hard delete) | "Outlet masih punya data terkait, tidak bisa dihapus permanen." |
| RLS denial (non-admin) | "Tidak punya akses." |
| lat/lng kosong | validasi form "Koordinat wajib diisi." |

Mutasi: invalidate + refetch (pola Fase 1, tanpa optimistic). Loading skeleton di tabel. Sukses → inline/toast.

---

## 6. Testing (TDD, vitest — infra sudah ada)

- `slugify.test.ts` — spasi→dash, lowercase, strip tanda baca, collapse repeat, trailing dash, accent/unicode.
- `parseLatLng.test.ts` — `"lat, lng"`, dengan spasi/tanpa, minus, derajat-simbol opsional, input invalid → null.
- `filterOutlets.test.ts` — search nama/slug + filter aktif.
- `useOutletMutations.test.tsx` — create/update/soft/hard panggil op supabase benar; surfacing `23505` & `23503` jadi pesan ramah.

---

## 7. Open Items / Notes

- Komentar "sync from Ecosystem" di `20260609000000_create_outlets.sql` & fungsi `sync-outlets` kini menyesatkan (tidak ada sync aktif). Pertimbangkan update komentar saat menyentuh area ini (bukan blocker Fase 2).
- Hard-delete reference check = `outlet_staff` + `staff_outlets` + `ledger_stok` (konservatif). Tabel referensi lain (absensi, permintaan) tidak dicek eksplisit — di-cover FK backstop `23503`.
