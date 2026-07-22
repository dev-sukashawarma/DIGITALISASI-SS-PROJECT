# Dual Packaging Variant untuk Bahan Baku

**Tanggal**: 2026-07-22  
**Status**: Disetujui — siap implementasi  
**Scope**: SAOS CABE & SAOS TOMAT (dapat di-extend ke bahan lain nanti)

---

## Latar Belakang

Bahan baku tertentu (saat ini: SAOS CABE & SAOS TOMAT) bisa datang dari supplier dalam dua bentuk packaging fisik yang berbeda:

1. **Dus Kompan** — 1 dus berisi 3 kompan, total ±16.5 kg → **1 kompan = 5.5 kg**
2. **Dus Pouch** — 1 dus berisi 12 pouch, setiap pouch = 1 kg → **1 pouch = 1 kg**

Saat ini sistem tidak bisa membedakan dua packaging ini — semua masuk ke saldo dalam satuan dasar `kg` tanpa keterangan asal packaging. Akibatnya gudang dan admin tidak tahu ada berapa kompan dan berapa pouch stok yang tersisa.

Satuan dasar kedua bahan ini sudah `kg` (bukan liter), sesuai dokumen VERIFIKASI-FAKTOR-KONVERSI.md.

---

## Tujuan

1. Staff gudang bisa input terima kiriman secara detail: berapa kompan + berapa pouch
2. Staff gudang bisa opname secara detail: kompan penuh + pouch + sisa terbuka (kg)
3. Admin dan SPV bisa melihat breakdown "X kompan + Y pouch" di monitoring
4. Admin dapat mendefinisikan packaging variant baru dari admin-dashboard tanpa perlu code change

---

## Keputusan Desain

| Aspek | Keputusan |
|-------|-----------|
| Satuan dasar | `kg` (sudah ada, tidak berubah) |
| Saldo utama | Tetap di `stok_balance` (tidak berubah) |
| Tracking breakdown | Tabel baru `stok_balance_packaging` |
| Update saldo breakdown | Hanya saat terima kiriman & opname (BUKAN saat konsumsi) |
| Scope awal | SAOS CABE & SAOS TOMAT saja |
| Admin config | Tambah section di `BahanBakuDetailModal` yang sudah ada |
| Konversi opname | kompan × 5.5 + pouch × 1 + sisa_kg = total kg |

---

## Database Schema

### Tabel Baru 1: `bahan_baku_packaging_variant`

Menyimpan definisi packaging variant per bahan baku. Ini adalah **master data** yang dikelola admin.

```sql
CREATE TABLE bahan_baku_packaging_variant (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_baku_id   uuid NOT NULL REFERENCES bahan_baku(id) ON DELETE CASCADE,
  nama_variant    text NOT NULL,        -- "Kompan", "Pouch"
  satuan_variant  text NOT NULL,        -- "kompan", "pouch"
  faktor_ke_kg    numeric NOT NULL,     -- 5.5 untuk kompan, 1.0 untuk pouch
  is_active       boolean DEFAULT true,
  urutan          int DEFAULT 0,        -- urutan tampil di UI (ascending)
  created_at      timestamptz DEFAULT now(),
  UNIQUE(bahan_baku_id, satuan_variant)
);

CREATE INDEX idx_bbpv_bahan_baku_id ON bahan_baku_packaging_variant(bahan_baku_id);
```

### Tabel Baru 2: `stok_balance_packaging`

Menyimpan saldo breakdown per packaging per outlet. Diupdate hanya saat terima kiriman dan opname.

```sql
CREATE TABLE stok_balance_packaging (
  outlet_id       uuid NOT NULL REFERENCES outlets(id),
  bahan_baku_id   uuid NOT NULL REFERENCES bahan_baku(id),
  variant_id      uuid NOT NULL REFERENCES bahan_baku_packaging_variant(id),
  saldo_variant   numeric NOT NULL DEFAULT 0,  -- dalam satuan variant (jumlah kompan/pouch)
  updated_at      timestamptz DEFAULT now(),
  PRIMARY KEY (outlet_id, bahan_baku_id, variant_id)
);
```

### Seed Data Awal

```sql
INSERT INTO bahan_baku_packaging_variant (bahan_baku_id, nama_variant, satuan_variant, faktor_ke_kg, urutan)
SELECT id, 'Kompan', 'kompan', 5.5, 1 FROM bahan_baku WHERE nama = 'SAOS CABE'
UNION ALL
SELECT id, 'Pouch',  'pouch',  1.0, 2 FROM bahan_baku WHERE nama = 'SAOS CABE'
UNION ALL
SELECT id, 'Kompan', 'kompan', 5.5, 1 FROM bahan_baku WHERE nama = 'SAOS TOMAT'
UNION ALL
SELECT id, 'Pouch',  'pouch',  1.0, 2 FROM bahan_baku WHERE nama = 'SAOS TOMAT';
```

### RLS Policy

```sql
ALTER TABLE bahan_baku_packaging_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE stok_balance_packaging ENABLE ROW LEVEL SECURITY;
-- Read: authenticated users
-- Write: admin/owner only (mengikuti pola RLS yang sudah ada)
```

---

## Komponen yang Berubah

### 1. Admin Dashboard — `BahanBakuDetailModal.tsx`

Tambahkan section baru **"📦 Packaging Variant"** di bawah section Satuan yang sudah ada.

**Tampilan:**
```
📦 Packaging Variant
┌─────────────────────────────────────────────────┐
│  Nama       Satuan    Faktor ke kg    Aksi       │
│  Kompan     kompan    5.5 kg          ✏️ 🗑️      │
│  Pouch      pouch     1.0 kg          ✏️ 🗑️      │
│                                                  │
│  [+ Tambah Variant]                              │
└─────────────────────────────────────────────────┘
```

**Fitur:**
- List semua variant aktif untuk bahan yang sedang dibuka
- Tombol Tambah Variant → inline form (nama, satuan, faktor_ke_kg)
- Tombol Edit → inline edit row
- Tombol Hapus → konfirmasi, set `is_active = false` (soft delete, agar data historis tidak rusak)

**Hook baru:** `usePackagingVariantMutations` di admin-dashboard

---

### 2. Stok App — Terima Kiriman (Surat Jalan / Mutasi Masuk)

Untuk bahan yang punya packaging variant, ganti input tunggal dengan input per packaging:

**Sebelum:**
```
SAOS CABE   [_____ kg]
```

**Sesudah:**
```
SAOS CABE
  Kompan  [___] buah  (= ___ kg)
  Pouch   [___] buah  (= ___ kg)
  Total diterima: ___ kg
```

**Logic:**
- Total kg = (kompan × 5.5) + (pouch × 1)
- Nilai ini yang masuk ke `ledger_stok` (tipe: `terima_kiriman`) dengan qty dalam kg
- Setelah ledger dicommit, upsert `stok_balance_packaging`:
  - `kompan.saldo_variant += jumlah_kompan_diterima`
  - `pouch.saldo_variant += jumlah_pouch_diterima`

---

### 3. Stok App — Opname

Untuk bahan yang punya packaging variant, ganti input qty_fisik tunggal dengan 3 field:

```
SAOS CABE — Hitung Stok Fisik
┌───────────────────────────────────────┐
│ 🗳️ Kompan (penuh)    [___] buah       │
│ 🛍️ Pouch             [___] buah       │
│ 🥄 Sisa Terbuka      [___] kg         │
│                                       │
│ → Total: ___ kg                       │
└───────────────────────────────────────┘
```

**Logic konversi:**
```
qty_fisik_total = (kompan × 5.5) + (pouch × 1.0) + sisa_terbuka_kg
```

- `qty_fisik_total` yang disimpan ke `opname_item.qty_fisik`
- Setelah opname difinalize, replace (bukan +=) `stok_balance_packaging`:
  - `kompan.saldo_variant = kompan_penuh`
  - `pouch.saldo_variant = pouch_penuh`
  - Sisa terbuka tidak ditrack per packaging (sudah menjadi kg murni)

---

### 4. Monitoring — Tampilan Breakdown

**Di Stok App (monitoring harian):**
```
SAOS CABE    27.5 kg  ●aman
             3 kompan + 10 pouch
```

**Di Admin Dashboard (monitoring multi-outlet):**
```
SAOS CABE  |  Empang: 27.5 kg (3 kp + 10 pc)  |  Cicurug: 11 kg (2 kp + 0 pc)
```

Breakdown hanya tampil jika bahan punya packaging variant yang aktif.

---

## Data Flow Diagram

```
Admin Dashboard                    Stok App (Gudang)
      │                                   │
      ▼                                   ▼
Definisi Variant               Terima Kiriman / Opname
(bahan_baku_packaging_variant)  (input per packaging)
      │                                   │
      │                                   ▼
      │                          ledger_stok (qty dalam kg) — tidak berubah
      │                                   │
      │                                   ▼
      │                          stok_balance (total kg) — tidak berubah
      │                                   │
      │                                   ▼
      └──────────────────►  stok_balance_packaging (per variant)
                                          │
                                          ▼
                                  Monitoring Display
                            "27.5 kg (3 kompan + 10 pouch)"
```

---

## File yang Perlu Dibuat / Dimodifikasi

### Admin Dashboard (`apps/admin-dashboard`)
- **[MODIFY]** `src/components/BahanBakuDetailModal.tsx` — tambah section Packaging Variant
- **[NEW]** `src/hooks/usePackagingVariants.ts` — fetch variant list per bahan_baku_id
- **[NEW]** `src/hooks/usePackagingVariantMutations.ts` — CRUD variant (add/edit/soft-delete)

### Stok App (`apps/stok`)
- **[MODIFY]** Komponen input terima kiriman — ganti input qty untuk bahan bervariant
- **[MODIFY]** Komponen opname — ganti qty_fisik input untuk bahan bervariant
- **[MODIFY]** Komponen monitoring — tampilkan breakdown packaging
- **[NEW]** `src/hooks/usePackagingVariants.ts` — fetch variant dari Supabase

### Database
- **[NEW]** Migration SQL: buat tabel `bahan_baku_packaging_variant` dan `stok_balance_packaging`
- **[NEW]** Seed SQL: insert 4 rows variant untuk SAOS CABE & SAOS TOMAT
- **[NEW]** RLS policies untuk 2 tabel baru

### TypeScript Types
- **[MODIFY]** `apps/stok/src/types/stok.ts` — tambah type `PackagingVariant` dan `StokBalancePackaging`

---

## Hal yang TIDAK Berubah

- Satuan dasar (`kg`) untuk SAOS CABE & SAOS TOMAT
- Tabel `stok_balance` — tetap menyimpan total kg
- Tabel `ledger_stok` — qty tetap dalam kg
- Logika BOM / potong stok otomatis — masih per kg
- Resep — tidak berubah

---

## Batasan Saat Ini (Bisa Di-extend Nanti)

- Konsumsi/pemakaian tidak mengurangi breakdown packaging (hanya opname & kiriman yang update breakdown)
- Belum include MINYAK SAYUR dan bahan lain — bisa di-extend dengan arsitektur yang sama
- Breakdown bisa "drift" dari kenyataan jika ada konsumsi paksa tanpa opname — opname akan reset ke kondisi aktual

---

## Verification Plan

### Automated
- Unit test logika konversi: `kompan × 5.5 + pouch × 1 + sisa = total`
- Test upsert `stok_balance_packaging` setelah terima kiriman

### Manual
1. Admin buka `/dashboard/bahan-baku` → buka SAOS CABE → section Packaging Variant muncul
2. Admin tambah variant Kompan (5.5 kg) dan Pouch (1 kg) — seed data sudah ada
3. Gudang input terima kiriman: 2 kompan + 5 pouch SAOS CABE
4. Cek `stok_balance`: bertambah (2×5.5)+(5×1) = 16 kg ✓
5. Cek `stok_balance_packaging`: kompan=2, pouch=5 ✓
6. Monitoring menampilkan: "16 kg (2 kompan + 5 pouch)" ✓
7. Gudang opname: 1 kompan + 3 pouch + 0.5 kg sisa
8. Cek `opname_item.qty_fisik` = (1×5.5)+(3×1)+0.5 = 9 kg ✓
9. Cek `stok_balance_packaging` setelah finalize: kompan=1, pouch=3 ✓
