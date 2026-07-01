# Spec: HPP Bahan Baku — Master Harga Beli (Tahap 1)

**Tanggal:** 2026-06-30
**App:** `apps/admin-dashboard` (+ migration DB)
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
- **Harga hanya bisa dilihat oleh admin** (rahasia biaya/margin). Nama & satuan
  bahan tetap terlihat semua staff seperti sekarang.
- Harga tersimpan di data model dan bisa dibaca konsumen lain (admin) nanti.

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
| Visibilitas | **Harga admin-only**; nama/satuan tetap publik-staff | Rahasia biaya; jangan putus alur stok/permintaan |
| Penyimpanan | **Tabel terpisah `bahan_baku_harga`** | RLS row-level tak bisa sembunyikan 1 kolom dari tabel yang dibaca semua staff |
| Input | UI admin di admin-dashboard | Admin bisa update mandiri tanpa minta dev |
| Hak edit | Admin saja | Konsisten dengan grup System & Admin |

**Alternatif yang ditolak:**
- *Kolom `harga_beli` langsung di `bahan_baku`* — ditolak karena tabel itu dibaca
  semua staff (stok, permintaan, surat jalan); RLS row-level tak bisa menyembunyikan
  satu kolom, jadi harga akan ikut bocor ke crew/leader. Tabel terpisah dengan RLS
  sendiri menyelesaikan ini.
- *UI di pos-kasir admin* — admin-dashboard sudah jadi hub master data (Outlet, Staff).
- *Seed via SQL saja* — admin tidak mandiri; tiap update harus minta dev.

## Arsitektur & Perubahan

### 1. Database — satu migration aditif

File: `supabase/migrations/<timestamp>_bahan_baku_harga.sql`

```sql
-- 1a. Tabel harga terpisah (1:1 ke bahan_baku), admin-only.
CREATE TABLE bahan_baku_harga (
  bahan_baku_id    UUID PRIMARY KEY REFERENCES bahan_baku(id) ON DELETE CASCADE,
  harga_beli       NUMERIC NOT NULL DEFAULT 0 CHECK (harga_beli >= 0),
  harga_updated_at TIMESTAMPTZ,
  updated_by       UUID REFERENCES outlet_staff(id)
);

ALTER TABLE bahan_baku_harga ENABLE ROW LEVEL SECURITY;

-- 1b. Read: admin only.
CREATE POLICY bbh_read ON bahan_baku_harga FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'));

-- 1c. Write: admin only.
CREATE POLICY bbh_write ON bahan_baku_harga FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'));
```

**Catatan:**
- Tidak ada `INSERT` seed. Baris dibuat saat admin pertama kali set harga sebuah
  bahan (upsert). Bahan tanpa harga = belum diatur (tampil "—" di UI).
- `harga_updated_at` di-set ke `now()` oleh aplikasi saat upsert; `updated_by` =
  id admin yang mengubah.
- **Tabel `bahan_baku` tidak disentuh** — tak ada perubahan kolom maupun policy di
  sana. Alur stok/permintaan/surat jalan untuk semua staff tetap utuh.
- Kebocoran ke `anon`: tak relevan lagi karena harga bukan di `bahan_baku`. Policy
  `bahan_baku_read_anon` (legacy) dibiarkan apa adanya — di luar scope spec ini.

### 2. RLS — verifikasi keamanan

| Role | Lihat nama/satuan (`bahan_baku`) | Lihat harga (`bahan_baku_harga`) | Edit harga |
|------|----------------------------------|----------------------------------|------------|
| crew/leader/kasir/kiosk | ✅ (tak berubah) | ❌ | ❌ |
| spv/owner/mitra/admin_hr | ✅ | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ |

Read & write `bahan_baku_harga` lewat **browser client RLS-bound** (pola
[useOutletMutations.ts](../../../apps/admin-dashboard/src/hooks/useOutletMutations.ts)),
jadi RLS adalah penegak utama: non-admin tak akan menerima baris harga sama sekali.

### 3. UI — halaman kelola harga (admin-dashboard)

**Route:** `/dashboard/bahan-baku`

**Nav:** tambah item ke grup `System & Admin` di
[navConfig.ts](../../../apps/admin-dashboard/src/components/layout/navConfig.ts),
`roles: ['ADMIN']`, sebelah "Manajemen Outlet". Mengikuti pola halaman outlets
(nav + redirect RoleContext); read harga sudah dijaga RLS admin-only.

**Komponen:**
- `useBahanBakuHarga` (baru, admin-dashboard) — query gabungan: ambil semua bahan
  aktif + harga-nya via embedded resource Supabase, mis.
  `from('bahan_baku').select('id, nama, satuan, kategori, bahan_baku_harga(harga_beli, harga_updated_at)')`,
  `order('nama')`. Untuk admin, embed terisi; bahan tanpa harga → `bahan_baku_harga`
  null → tampil "—".
- `useBahanBakuHargaMutations` (baru) — mutation `setHarga({ bahan_baku_id, harga_beli })`:
  `upsert({ bahan_baku_id, harga_beli, harga_updated_at: new Date().toISOString(), updated_by })`
  ke `bahan_baku_harga`, `onSuccess` → `invalidateQueries(['bahan_baku_harga'])`.
  Pola sama dengan `useOutletMutations`.
- Halaman `page.tsx` — tabel: **Nama · Kategori · Satuan · Harga (edit inline, Rp) · Terakhir diubah**.
  - Edit inline: klik harga → input number → simpan (Enter/blur) → optimistic + toast.
  - Format rupiah untuk tampilan; validasi `harga_beli >= 0` di klien.
  - Filter/search nama (opsional, ikut pola filter outlets bila ringkas).
  - `export const dynamic = 'force-dynamic'`.

### 4. Tipe

- admin-dashboard — tipe lokal `BahanBakuWithHarga`:
  `{ id, nama, satuan, kategori, bahan_baku_harga: { harga_beli, harga_updated_at } | null }`.
- **Tidak ada perubahan** pada `apps/stok/src/types/stok.ts` — harga bukan bagian
  dari tabel `bahan_baku`, jadi tipe `BahanBaku` yang dipakai lintas-app tetap.

## Aliran Data

```
Admin buka /dashboard/bahan-baku
  → useBahanBakuHarga() baca bahan_baku + embed bahan_baku_harga
      (RLS: admin → harga terbaca; non-admin → tak akan sampai halaman ini)
  → render tabel (nama + harga, "—" bila belum diatur), edit inline harga
  → useBahanBakuHargaMutations.setHarga() → UPSERT bahan_baku_harga via browser client
      → RLS cek role=admin → commit harga_beli + harga_updated_at + updated_by
  → invalidate cache → tabel refresh
```

## Error Handling

- Harga negatif → ditolak di klien (validasi input) sebelum kirim; CHECK DB
  `harga_beli >= 0` sebagai jaring pengaman.
- Write/read oleh non-admin → RLS menolak / tak mengembalikan baris; halaman hanya
  dapat diakses admin via nav + RoleContext.
- Gagal jaringan → toast error, rollback optimistic update.

## Testing

- **navConfig** ([navConfig.test.ts](../../../apps/admin-dashboard/src/components/layout/navConfig.test.ts))
  — item baru muncul untuk `ADMIN`, tidak untuk `OWNER`/`ADMIN_HR`/`MITRA`.
- **useBahanBakuHargaMutations** — `setHarga` melakukan upsert dengan `harga_beli` +
  `harga_updated_at` ter-set; invalidate dipanggil onSuccess.
- **Validasi** — harga negatif ditolak di lapisan klien.

## Isolasi & Dampak

- **Aditif murni & terisolasi.** Hanya membuat tabel baru `bahan_baku_harga`;
  `bahan_baku`, `ledger_stok`, `resep`, `stok_balance`, dan views tidak disentuh.
- Konsumen `bahan_baku` lain (stok, distribusi, threshold) tak terpengaruh sama
  sekali — mereka tak membaca tabel harga.
- Harga terlindung di level DB: non-admin tak bisa membaca `bahan_baku_harga`.

## Catatan Migration

- Ikuti playbook history-drift: cek `supabase migration list` & `migration repair`
  bila perlu sebelum `db push` (lihat [CLAUDE.md](../../../CLAUDE.md) bagian Database).
- Migration ini aditif (`CREATE TABLE`, `CREATE POLICY`).
