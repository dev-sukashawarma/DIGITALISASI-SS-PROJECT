# Spec: HPP Bahan Baku — Master Harga Beli (Tahap 1)

**Tanggal:** 2026-06-30
**App:** `apps/admin-dashboard` (+ migration DB, tipe `apps/stok`)
**Status:** Design disetujui, siap masuk implementation plan.

## Latar Belakang

Project belum punya konsep biaya/HPP untuk bahan baku. Tabel `bahan_baku`
([20260609000600_create_bahan_baku.sql](../../../supabase/migrations/20260609000600_create_bahan_baku.sql))
tidak punya kolom harga, dan `ledger_stok` hanya melacak kuantitas bertanda
tanpa nilai rupiah. "HPP" selama ini hanya tercatat sebagai rencana M4/Fase 2 di
docs, bukan fitur yang dibangun. Ini **gap**, bukan bug.

Tahap ini membangun fondasi paling dasar: **mencatat harga beli per bahan baku**
yang bisa dikelola admin. Tahap lanjutan (valuation stok, COGS penjualan, HPP
per menu) berada **di luar scope** spec ini.

## Tujuan & Non-Tujuan

**Tujuan:**
- Admin bisa melihat & memperbarui harga beli setiap bahan baku lewat UI.
- Harga tersimpan di data model dan bisa dibaca konsumen lain nanti.
- Menutup kebocoran data biaya ke publik (anon).

**Non-tujuan (ditunda ke tahap berikutnya):**
- Nilai stok / inventory valuation (saldo × harga).
- HPP penjualan / COGS (pemakaian × harga) untuk laba kotor.
- HPP per menu dari resep (Σ qty_per_porsi × harga bahan).
- Riwayat perubahan harga / harga per-outlet / harga per-supplier.

## Keputusan Desain

| Topik | Keputusan | Alasan |
|-------|-----------|--------|
| Scope | Biaya per bahan (master) saja | Fondasi; opsi lain bergantung ke ini |
| Granularitas | Global, 1 harga per bahan | Pengadaan dianggap seragam; paling sederhana |
| Riwayat | Harga terkini saja (timpa) | Belum butuh tren/HPP historis |
| Penyimpanan | Kolom di `bahan_baku` | Hindari tabel terpisah (YAGNI untuk harga global tanpa riwayat) |
| Input | UI admin di admin-dashboard | Admin bisa update mandiri tanpa minta dev |
| Hak edit | Admin saja | Konsisten dengan grup System & Admin |

**Alternatif yang ditolak:**
- *Tabel `harga_bahan_baku` terpisah* — overkill untuk satu harga global tanpa riwayat.
- *UI di pos-kasir admin* — admin-dashboard sudah jadi hub master data (Outlet, Staff).
- *Seed via SQL saja* — admin tidak mandiri; tiap update harus minta dev.

## Arsitektur & Perubahan

### 1. Database — satu migration aditif

File: `supabase/migrations/<timestamp>_bahan_baku_harga_beli.sql`

```sql
-- 1a. Kolom harga (global, terkini)
ALTER TABLE bahan_baku
  ADD COLUMN harga_beli NUMERIC NOT NULL DEFAULT 0 CHECK (harga_beli >= 0),
  ADD COLUMN harga_updated_at TIMESTAMPTZ;

-- 1b. Write → admin only (ganti policy 'leader' yang tidak terpakai)
DROP POLICY IF EXISTS bahan_baku_write ON bahan_baku;
CREATE POLICY bahan_baku_write ON bahan_baku FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'));

-- 1c. Tutup kebocoran biaya: hapus anon read (legacy, tak terpakai)
DROP POLICY IF EXISTS bahan_baku_read_anon ON bahan_baku;
```

**Catatan:**
- `harga_updated_at` nullable; di-set ke `now()` oleh aplikasi saat harga diubah
  (bukan riwayat penuh, hanya "kapan terakhir diubah").
- Policy write lama hanya `role = 'leader'` (hasil rename di
  [20260620000000](../../../supabase/migrations/20260620000000_rename_role_kepala_outlet_to_leader.sql))
  dan **tidak terpakai** karena belum ada UI tulis bahan baku.
- `bahan_baku_read` (authenticated, USING true) tetap ada — meng-cover semua
  konsumen nyata (stok, distribusi) yang sudah di balik login. `bahan_baku_read_anon`
  aman dihapus karena tak ada konsumen anon.

### 2. RLS — verifikasi keamanan

| Role | Read `bahan_baku` | Write `harga_beli` |
|------|-------------------|--------------------|
| anon | ❌ (setelah drop) | ❌ |
| authenticated (semua staff) | ✅ | ❌ |
| admin | ✅ | ✅ |

Write lewat **browser client RLS-bound** (pola
[useOutletMutations.ts](../../../apps/admin-dashboard/src/hooks/useOutletMutations.ts)),
jadi RLS adalah penegak utama; admin non-admin akan ditolak di DB.

### 3. UI — halaman kelola harga (admin-dashboard)

**Route:** `/dashboard/bahan-baku`

**Nav:** tambah item ke grup `System & Admin` di
[navConfig.ts](../../../apps/admin-dashboard/src/components/layout/navConfig.ts),
`roles: ['ADMIN']`, sebelah "Manajemen Outlet". Tidak butuh page guard ekstra —
mengikuti pola halaman outlets (nav + redirect RoleContext sudah cukup; read
bahan_baku terbuka untuk authenticated, write dijaga RLS).

**Komponen:**
- `useBahanBaku` (read) — reuse pola yang ada (react-query, `select('*')`,
  `order('nama')`, `staleTime` panjang). Kolom baru otomatis ikut karena `select('*')`.
- `useBahanBakuMutations` (baru) — mutation `updateHarga({ id, harga_beli })`:
  `update({ harga_beli, harga_updated_at: new Date().toISOString() }).eq('id', id)`,
  `onSuccess` → `invalidateQueries(['bahan_baku'])`. Pola sama dengan `useOutletMutations`.
- Halaman `page.tsx` — tabel: **Nama · Kategori · Satuan · Harga (edit inline, Rp) · Terakhir diubah**.
  - Edit inline: klik harga → input number → simpan (Enter/blur) → optimistic + toast.
  - Format rupiah untuk tampilan; validasi `harga_beli >= 0` di klien.
  - Filter/search nama (opsional, ikut pola filter outlets bila ringkas).
  - `export const dynamic = 'force-dynamic'`.

### 4. Tipe

- [apps/stok/src/types/stok.ts](../../../apps/stok/src/types/stok.ts) — interface
  `BahanBaku` tambah `harga_beli: number` dan `harga_updated_at: string | null`.
- admin-dashboard — tipe lokal `BahanBaku` (atau reuse) memuat dua field di atas.

## Aliran Data

```
Admin buka /dashboard/bahan-baku
  → useBahanBaku() baca semua bahan (RLS authenticated) + kolom harga_beli
  → render tabel, edit inline harga
  → useBahanBakuMutations.updateHarga() → UPDATE via browser client
      → RLS cek role=admin → commit harga_beli + harga_updated_at
  → invalidate cache → tabel refresh
```

## Error Handling

- Harga negatif → ditolak di klien (validasi input) sebelum kirim; CHECK DB
  `harga_beli >= 0` sebagai jaring pengaman.
- Write oleh non-admin → RLS menolak; tampilkan toast error ramah (pola `friendly()`
  di useOutletMutations).
- Gagal jaringan → toast error, biarkan nilai lama (rollback optimistic update).

## Testing

- **navConfig** ([navConfig.test.ts](../../../apps/admin-dashboard/src/components/layout/navConfig.test.ts))
  — item baru muncul untuk `ADMIN`, tidak untuk `OWNER`/`ADMIN_HR`/`MITRA`.
- **useBahanBakuMutations** — `updateHarga` memanggil update dengan `harga_beli` +
  `harga_updated_at` ter-set; invalidate dipanggil onSuccess.
- **Validasi** — harga negatif ditolak di lapisan klien.

## Isolasi & Dampak

- **Aditif murni.** Tidak mengubah `ledger_stok`, `resep`, `stok_balance`, views.
- Konsumen `bahan_baku` lain tak rusak: `stok` (`select('*')`), `distribusi` &
  `threshold.ts` (kolom eksplisit tanpa harga).
- Perubahan RLS terbatas pada tabel `bahan_baku`; tidak menyentuh app lain.

## Catatan Migration

- Ikuti playbook history-drift: cek `supabase migration list` & `migration repair`
  bila perlu sebelum `db push` (lihat [CLAUDE.md](../../../CLAUDE.md) bagian Database).
- Migration ini aditif & idempoten (`ADD COLUMN`, `DROP POLICY IF EXISTS`).
