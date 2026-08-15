# BUG REPORT & FIX: BOM Unit Conversion Error pada `trg_process_bom_stok`

**Tanggal Ditemukan:** 15 Agustus 2026  
**Tanggal Fix Diterapkan:** 15 Agustus 2026  
**Severity:** Critical — menyebabkan selisih opname besar di semua outlet BOM-aktif  
**Status:** ✅ Fixed (migration `20300108000002_fix_bom_trg_use_waterfall.sql` sudah di-push ke production)

---

## Ringkasan Masalah

Sistem BOM (Bill of Materials) yang seharusnya memotong saldo stok secara otomatis setiap kali ada penjualan, **tidak berfungsi dengan benar** untuk outlet yang saldo stoknya disimpan dalam satuan gram (`saldo_is_gram = true`).

Akibatnya:
- Saldo stok di sistem hampir **tidak berkurang** meskipun penjualan terus berjalan
- Selisih opname terlihat sangat besar, seolah-olah bahan baku hilang dalam jumlah besar
- Data COGS / HPP teoritis yang dihitung dari ledger menjadi **tidak akurat**

---

## Root Cause (Penyebab Utama)

### Lokasi Bug
**DB Function:** `public.trg_process_bom_stok()` (trigger pada tabel `orders`)  
**Migration terakhir yang mengandung bug:** `20300105000009_restore_package_bom_after_pawoon_guard.sql`

### Formula yang Salah

```sql
-- ❌ SALAH (sebelum fix):
qty = -(r_item.qty_per_porsi * rec.quantity / r_item.faktor_konversi)
```

### Penjelasan Teknis

| Variabel | Nilai | Keterangan |
|---|---|---|
| `resep_item.qty_per_porsi` | `155` | Dalam **gram** |
| `bahan_baku.faktor_konversi` | `1000` | gram per Kg |
| Hasil formula lama | `155 / 1000 = 0.155` | Ditulis ke ledger sebagai **0.155** |
| `stok_balance.saldo` outlet gram-scale | `40000` | Dalam **gram** (40 Kg) |

Nilai `-0.155` yang tersimpan di `ledger_stok` kemudian dibandingkan terhadap saldo `40000` gram. Karena `0.155 << 40000`, saldo hampir tidak pernah berkurang secara signifikan.

### Verifikasi Matematis

Semua 11 bahan dalam resep "Original Ayam Jumbo" menunjukkan pola yang sama:

| Bahan | qty_resep | / faktor | Tersimpan | Match |
|---|---|---|---|---|
| AYAM | 155 gram | 1000 | -0.155 | ✅ |
| TUM | 10 gram | 1000 | -0.010 | ✅ |
| LETTUCE | 80 gram | 1000 | -0.080 | ✅ |
| KENTANG | 140 gram | 1000 | -0.140 | ✅ |
| MAYONAISE | 50 gram | 1000 | -0.050 | ✅ |
| SAOS CABE | 25 gram | 5500 | -0.004545 | ✅ |
| KULIT 32 | 1 lembar | 20 | -0.050 | ✅ |
| PAPER WRAP | 1 lembar | 500 | -0.002 | ✅ |
| FOIL | 45 cm | 24 | -1.875 | ✅ |
| GAS 3Kg | 50 gram | 3000 | -0.016667 | ✅ |

**Semua bahan terkonfirmasi mengalami bug yang sama (11/11 ✅).**

---

## Dampak Nyata (Studi Kasus: Cireundeu)

### Perbandingan Kamis vs Jumat (14 Agustus 2026)

Selisih opname Cireundeu yang terlihat besar antara hari Kamis dan Jumat sebagian besar disebabkan oleh bug ini:

| Kondisi | Saldo Sistem | Selisih Opname |
|---|---|---|
| **BOM Salah (sebelum fix)** | ~40.00 Kg (hampir tidak berkurang) | **-6.99 Kg** 🔴 |
| **BOM Benar (setelah fix)** | ~35.85 Kg (berkurang 4.15 Kg) | **-2.85 Kg** 🟡 |

> **Kesimpulan:** Dari -6.99 Kg selisih opname, sekitar **4.14 Kg adalah error sistem**, bukan kehilangan stok nyata.

---

## Mengapa Bug Ini Tidak Terdeteksi Lebih Awal

1. **Migration `20300105000017_scale_aware_ledger_writers.sql`** sudah memperbaiki fungsi-fungsi lain (PO, waste, mutasi, surat jalan) dengan helper `to_ledger_scale()`, **tetapi** tidak memperbaiki `trg_process_bom_stok`.

2. **Migration `20300105000009`** me-override `trg_process_bom_stok` secara penuh untuk memulihkan logika package/combo, namun tidak mengadopsi pola `to_ledger_scale` dari `20300105000017`.

3. Nilai yang tersimpan (misal `-0.155`) **terlihat valid** jika satuan diasumsikan "Kg" — bug hanya tampak jelas saat membandingkan saldo sistem vs fisik di opname.

---

## Fix yang Diterapkan

### Migration Baru
**File:** `supabase/migrations/20300108000002_fix_bom_trg_use_waterfall.sql`

### Perubahan Inti

```sql
-- ❌ SEBELUM (INSERT langsung, tidak scale-aware):
INSERT INTO public.ledger_stok (..., qty, ...) VALUES (
  ...,
  -(r_item.qty_per_porsi * rec.quantity / r_item.faktor_konversi),
  ...
);

-- ✅ SESUDAH (via process_waterfall_deduction yang sudah scale-aware):
PERFORM public.process_waterfall_deduction(
  NEW.outlet_id,
  r_item.bahan_baku_id,
  r_item.qty_per_porsi * rec.quantity / r_item.faktor_konversi,  -- satuan besar
  'Penjualan Otomatis #...',
  NEW.id
);
```

### Cara Kerja Fix

`process_waterfall_deduction` secara internal memanggil `to_ledger_scale()`:

```
to_ledger_scale(outlet, bahan, qty_besar):
  IF saldo_is_gram(outlet, bahan):
    RETURN qty_besar * faktor_tampilan   -- konversi ke gram ✅
  ELSE:
    RETURN qty_besar                     -- tetap satuan besar ✅
```

Hasilnya:
- **Outlet gram-scale** (Cireundeu, Empang, dll): `0.155 × 1000 = 155 gram` ✅
- **Outlet besar-scale** (lama): `0.155` (tidak berubah, backward-compatible) ✅

### Verifikasi di Production

```
Verification result: {"message":"WATERFALL_FOUND"}
```
✅ Fungsi `trg_process_bom_stok` di DB production sudah mengandung `process_waterfall_deduction`.

---

## Tindakan Lanjutan yang Diperlukan

### ⚠️ Wajib: Opname Ulang Semua Outlet BOM-Aktif

Data historis ledger yang salah **tidak terkoreksi otomatis** oleh migration ini. Saldo `stok_balance` saat ini terlalu besar (karena pemakaian yang dicatat terlalu kecil sejak awal sistem berjalan).

**Outlet yang perlu opname ulang segera:**
- Cireundeu
- Empang
- Semua outlet lain yang ada di `bom_automation_allowed_outlets`

**Langkah:** Lakukan opname fisik menyeluruh, kemudian set saldo sistem = stok fisik aktual.

### Opsional: Analisis Selisih Historis

Jika diperlukan audit, gunakan query berikut untuk menghitung total under-deduction per bahan per outlet sejak BOM aktif:

```sql
-- Estimasi total pemakaian yang seharusnya dicatat (dalam gram)
-- vs yang aktual dicatat (dalam satuan besar)
SELECT 
  b.outlet_id,
  bb.nama,
  SUM(ABS(ls.qty)) AS dicatat_satuan_besar,
  SUM(ABS(ls.qty)) * bb.faktor_tampilan AS seharusnya_dalam_gram,
  (SUM(ABS(ls.qty)) * bb.faktor_tampilan - SUM(ABS(ls.qty))) AS selisih_gram
FROM ledger_stok ls
JOIN stok_balance b ON b.outlet_id = ls.outlet_id AND b.bahan_baku_id = ls.bahan_baku_id
JOIN bahan_baku bb ON bb.id = ls.bahan_baku_id
WHERE ls.tipe = 'pemakaian'
  AND saldo_is_gram(b) = true
  AND ls.created_at >= '2026-07-04'  -- sejak BOM diaktifkan
GROUP BY b.outlet_id, bb.nama, bb.faktor_tampilan
ORDER BY selisih_gram DESC;
```

---

## Riwayat Migration Terkait

| Migration | Isi | Relevansi |
|---|---|---|
| `20260703000000_bom_automation.sql` | BOM automation awal | Versi pertama trigger |
| `20260704170000_cogs_bom_automation_with_allowlist.sql` | Tambah allowlist outlet | — |
| `20300103000008_bom_package_component_label.sql` | Tambah logika paket/combo, perbaiki label | Mengandung bug `/faktor_konversi` |
| `20300105000009_restore_package_bom_after_pawoon_guard.sql` | Restore logika paket setelah regresi Pawoon | **Versi terakhir yang mengandung bug** |
| `20300105000017_scale_aware_ledger_writers.sql` | Fix scale untuk PO, waste, mutasi, SJ | Fix fungsi lain, **tidak termasuk trg_process_bom_stok** |
| **`20300108000002_fix_bom_trg_use_waterfall.sql`** | **Fix trg_process_bom_stok** | **← Migration fix ini** |

---

## Kontak & Referensi

- **Ditemukan oleh:** Analisis perbedaan opname Cireundeu Kamis-Jumat 14 Agustus 2026
- **Dikonfirmasi oleh:** Verifikasi matematis 11 bahan resep (100% match)
- **Diterapkan oleh:** Antigravity AI coding assistant
- **Sesi analisis:** [Conversation b0c4bbd3](conversation://b0c4bbd3-f8eb-4ce6-94d2-96cb77551dd9)
