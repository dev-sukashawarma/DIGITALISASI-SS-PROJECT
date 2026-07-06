# Case Real COGS/HPP — Outlet Suka Shawarma Empang

> Data nyata dari sistem. Outlet: **SUKA SHAWARMA EMPANG** (`550e8400-e29b-41d4-a716-446655440002`)

---

## CASE A — BOM Auto-Deduction per Order

### Skenario: Order #4213 — Shawarma Sapi Sedang (qty: 1)

Ini adalah order nyata yang berhasil diuji langsung lewat UI `pos-kasir` pada 2026-07-04.

---

#### Step 1: Kasir menyelesaikan order

```sql
-- orders table sebelum trigger jalan
order_number = 4213
outlet_id    = '550e8400-e29b-41d4-a716-446655440002'  -- Empang
status       = 'completed'   ← UPDATE ini yang fire trigger
total_amount = 30000
```

---

#### Step 2: Trigger `trg_orders_bom_stok` jalan

```
1. Cek allowlist → '550e8400...' ADA di global_settings → LANJUT
2. Ambil order_items → { menu_item_id: 'Original Sapi Sedang', quantity: 1 }
3. Cari resep aktif → ketemu 'Shawarma Sapi Sedang' (global, is_active=true)
4. Loop resep_item → 12 bahan
5. INSERT 12 baris ke ledger_stok
```

---

#### Step 3: Perhitungan tiap bahan

Resep **Shawarma Sapi Sedang** (COGS total: **Rp 16.391**):

| Bahan | Qty Resep | Satuan Resep | Faktor Konversi | Satuan Stok | **qty Ledger** |
|-------|----------:|:------------|----------------:|:------------|:--------------|
| SAPI | 100 | gram | 2000 (1 blok=2kg) | pcs (blok) | **−0.05** |
| KULIT 25 | 1 | lembar | 20 (1 pack=20lbr) | pack | **−0.05** |
| SAUS CABE/TOMAT | 50 | gram | 1000 (kg→gram) | kg | **−0.05** |
| MAYONES | 40 | gram | 1000 (kg→gram) | kg | **−0.04** |
| TUM | 5 | gram | 1000 (kg→gram) | kg | **−0.005** |
| MINYAK SAYUR | 25 | gram | 16000 (1 kompan=16L) | kompan | **−0.0015625** |
| KENTANG | 65 | gram | 1000 (kg→gram) | kg | **−0.065** |
| PAPER WRAP | 1 | lembar | 1 (1:1) | lembar | **−1** |
| PLASTIK MERAH | 1 | lembar | 1 (1:1) | pcs | **−1** |
| GAS 3Kg | 45 | gram | 3000 (1 tabung=3kg) | pcs | **−0.015** |
| FOIL | 35 | cm | 760 (1 roll=760cm) | pcs (roll) | **−0.046052...** |
| LETTUCE | 60 | gram | 1000 (kg→gram) | kg | **−0.06** |

> Formula: `qty_ledger = -(qty_per_porsi × quantity_order / faktor_konversi)`
> Contoh FOIL: `-(35 × 1 / 760)` = **−0.046052631578947366** ← angka desimal panjang ini tersimpan **utuh** di DB (terbukti di testing)

---

#### Step 4: Ledger stok yang terbentuk (12 baris)

```
ledger_stok
┌─────────────────┬──────────────┬───────────────┬──────────────┬────────────────┐
│ bahan           │ tipe         │ qty           │ saldo_sebelum│ saldo_sesudah  │
├─────────────────┼──────────────┼───────────────┼──────────────┼────────────────┤
│ SAPI            │ pemakaian    │ -0.05         │ 25           │ 24.95          │
│ KULIT 25        │ pemakaian    │ -0.05         │ 33           │ 32.95          │
│ SAUS CABE/TOMAT │ pemakaian    │ -0.05         │ 45           │ 44.95          │
│ MAYONES         │ pemakaian    │ -0.04         │ 30           │ 29.96          │
│ TUM             │ pemakaian    │ -0.005        │ 6            │ 5.995          │
│ MINYAK SAYUR    │ pemakaian    │ -0.0015625    │ 2            │ 1.9984375      │
│ KENTANG         │ pemakaian    │ -0.065        │ 56           │ 55.935         │
│ PAPER WRAP      │ pemakaian    │ -1            │ 800          │ 799            │
│ PLASTIK MERAH   │ pemakaian    │ -1            │ 850          │ 849            │
│ GAS 3Kg         │ pemakaian    │ -0.015        │ 15           │ 14.985         │
│ FOIL            │ pemakaian    │ -0.04605...   │ 42           │ 41.9539...     │
│ LETTUCE         │ pemakaian    │ -0.06         │ 50           │ 49.94          │
└─────────────────┴──────────────┴───────────────┴──────────────┴────────────────┘
catatan: 'Penjualan Otomatis #4213'
ref_order_id: <uuid order #4213>
```

---

### Skenario: Order #4215 — Shawarma Mix Jumbo, lalu di-VOID

#### Order masuk (completed):

Resep **Shawarma Mix Jumbo** (COGS: **Rp 26.870**, 13 bahan):

| Bahan | Qty Resep | Faktor | qty Ledger |
|-------|----------:|-------:|----------:|
| SAPI | 60 | 2000 | −0.03 |
| AYAM | 95 | 1000 | −0.095 |
| KULIT 28 | 1 | 20 | −0.05 |
| SAUS CABE/TOMAT | 60 | 1000 | −0.06 |
| MAYONES | 60 | 1000 | −0.06 |
| TUM | 15 | 1000 | −0.015 |
| MINYAK SAYUR | 40 | 16000 | −0.0025 |
| KENTANG | 200 | 1000 | −0.2 |
| PAPER WRAP | 1 | 1 | −1 |
| PLASTIK MERAH | 1 | 1 | −1 |
| GAS 3Kg | 50 | 3000 | −0.01666... |
| FOIL | 55 | 760 | −0.07236... |
| LETTUCE | 100 | 1000 | −0.1 |

→ **13 baris `pemakaian`** masuk ke `ledger_stok`

#### Order di-VOID (completed → cancelled):

```sql
UPDATE orders SET status = 'cancelled' WHERE id = '<order_id_4215>';
```

→ Trigger jalan lagi, temukan 13 baris `pemakaian` dengan `ref_order_id = order_4215`:

```
ledger_stok (pengembalian)
┌─────────────────┬──────────────┬───────────────────────────────────────────────┐
│ bahan           │ tipe         │ qty (positif, cermin sempurna dari pemakaian) │
├─────────────────┼──────────────┼───────────────────────────────────────────────┤
│ SAPI            │ adjustment   │ +0.03                                         │
│ AYAM            │ adjustment   │ +0.095                                        │
│ KULIT 28        │ adjustment   │ +0.05                                         │
│ ...             │ ...          │ ...                                           │
│ FOIL            │ adjustment   │ +0.07236842105263158 (presisi penuh)          │
└─────────────────┴──────────────┴───────────────────────────────────────────────┘
catatan: 'Pengembalian Void #4215'
```

> ✅ Saldo akhir = saldo **sebelum order #4215** — identik sempurna.

---

## CASE B — Opname Periodik HPP (Metode 1)

### Skenario: HPP Outlet Empang, Kamis 2026-07-03

Ini simulasi kalkulasi `get_hpp_periode('2026-07-03', '2026-07-03')`.

---

#### Data yang terlibat:

**Stok Awal** (dari opname finalized 2026-07-02, nilai harga snapshot):

| Bahan | Qty Fisik | Harga Snapshot | Nilai |
|-------|----------:|---------------:|------:|
| AYAM | 58.5 kg | Rp 38.000/kg | Rp 2.223.000 |
| SAPI | 23.9 blok | Rp 75.000/blok | Rp 1.792.500 |
| KULIT 25 | 30 pack | Rp 15.000/pack | Rp 450.000 |
| ... | ... | ... | ... |
| **Total Stok Awal** | | | **Rp 9.800.000** |

---

**Barang Masuk** (dari Surat Jalan terverifikasi tanggal 2026-07-03):

| Bahan | Qty Terima | Harga Snapshot SJ | Nilai Masuk |
|-------|----------:|------------------:|------------:|
| AYAM | 20 kg | Rp 38.000/kg | Rp 760.000 |
| KULIT 28 | 5 pack | Rp 17.500/pack | Rp 87.500 |
| LETTUCE | 10 kg | Rp 12.000/kg | Rp 120.000 |
| GAS 3Kg | 2 pcs | Rp 22.000/pcs | Rp 44.000 |
| **Total Barang Masuk** | | | **Rp 1.011.500** |

> Harga di-snapshot saat Surat Jalan dibuat (trigger `fill_harga_snapshot`) → **tidak berubah** meski admin update harga master esok hari.

---

**Stok Akhir** (dari opname finalized 2026-07-03, nilai harga snapshot):

| Bahan | Qty Fisik | Harga Snapshot | Nilai |
|-------|----------:|---------------:|------:|
| AYAM | 52.3 kg | Rp 38.000/kg | Rp 1.987.400 |
| SAPI | 21.1 blok | Rp 75.000/blok | Rp 1.582.500 |
| KULIT 25 | 28.5 pack | Rp 15.000/pack | Rp 427.500 |
| ... | ... | ... | ... |
| **Total Stok Akhir** | | | **Rp 8.365.000** |

---

#### Kalkulasi HPP Hari itu:

```
HPP (2026-07-03) = Stok Awal + Barang Masuk − Stok Akhir
                 = Rp 9.800.000 + Rp 1.011.500 − Rp 8.365.000
                 = Rp 2.446.500
```

Ini yang dikembalikan oleh RPC `get_hpp_periode('2026-07-03', '2026-07-03')`.

---

#### Di Owner Dashboard (halaman `/profit`):

```
computeProfit(omzet, hpp, expenses)

Omzet hari itu    = Rp  8.200.000   ← dari sales_hourly_spv
HPP hari itu      = Rp  2.446.500   ← dari get_hpp_periode()
Expenses outlet   = Rp    850.000   ← gaji, listrik, dll (manual)

Laba Kotor   = Rp 8.200.000 − Rp 2.446.500  = Rp 5.753.500
Laba Bersih  = Rp 5.753.500 − Rp 850.000    = Rp 4.903.500
Margin Kotor = 5.753.500 / 8.200.000         = 70.1%
Margin Bersih= 4.903.500 / 8.200.000         = 59.8%
```

---

### Kenapa HPP Periodik Stabil?

```
Senin, SJ dibuat:
  harga_snapshot AYAM = Rp 38.000  ← dikunci di sini

Rabu, admin update harga AYAM → Rp 40.000

Kalau query HPP untuk Senin:
  ✅ tetap pakai Rp 38.000 (snapshot SJ Senin)
  ✅ bukan Rp 40.000 (harga master baru)

→ HPP historis TIDAK berubah meski harga berubah.
```

---

## Hubungan Kedua Metode

```
Order #4213 selesai (Shawarma Sapi Sedang)
        ↓
Trigger BOM potong stok:
  AYAM: −0.05 blok → stok_balance AYAM turun
  ... (11 bahan lain)
        ↓
Malam hari: SPV lakukan Stock Opname harian
  → qty_fisik AYAM dicatat: 52.3 kg (fisik)
        ↓
get_hpp_periode:
  Stok Awal = nilai opname kemarin
  Barang Masuk = SJ hari ini × harga_snapshot
  Stok Akhir = nilai opname malam ini (qty_fisik 52.3 kg × harga snapshot)
        ↓
HPP = Rp 2.446.500 → masuk laporan profit
```

> Metode BOM mempengaruhi `stok_balance` (ledger real-time). Metode Opname mengambil `qty_fisik` aktual (bukan dari ledger) — jadi keduanya saling check & balance: selisih antara stok ledger dan stok fisik = loss/waste yang tidak tercatat.

---

## Catatan Bug & Gap yang Diketahui

> Lihat `docs/COGS-HPP-EVALUASI.md` untuk daftar lengkap bug dan gap yang perlu diperbaiki.

| Bug | Deskripsi | Dampak |
|-----|-----------|--------|
| JOIN LATERAL (Bug #1) | Bahan baru tanpa SJ hilang dari valuasi stok | HPP over-stated, laba under-stated |
| Order Online tanpa BOM (Bug #2) | Penjualan online tidak potong stok | Waste tercatat padahal bukan waste |
| Stok habis = order fail (Bug #3) | RAISE EXCEPTION saat saldo negatif | Kasir tidak bisa complete order |
| Gap Supplier → Pusat | Pembelian bahan dari supplier tidak direkam | Stok pusat tidak pernah bertambah/berkurang otomatis |

*Dibuat: 2026-07-06 — berdasarkan analisis kode dan testing outlet Empang.*
