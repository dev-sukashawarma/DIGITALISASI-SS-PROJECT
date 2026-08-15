# BUG HUNT DEEP DIVE REPORT
**Tanggal:** 15 Agustus 2026 | **Status:** In Progress

---

## 🔴 KRITIS — Bug #1: `trg_process_bom_stok` Masih Mengandung Old Division Pattern

**Temuan:**
```
trg_process_bom_stok: waterfall=true | scale=true | old_div=true ← ❌
```

Migration fix kita (`20300108000002`) memang sudah menambahkan pemanggilan `process_waterfall_deduction` (waterfall=true, scale=true), **TAPI fungsi masih juga mengandung pola lama `/ r_item.faktor_konversi`** (old_div=true).

**Root Cause:** Script migrasi fix kita masih menggunakan formula lama `r_item.qty_per_porsi * rec.quantity / r_item.faktor_konversi` sebagai *input* ke `process_waterfall_deduction`. Itu sebenarnya **correct** — input ke waterfall memang harus dalam satuan besar. Jadi `old_div=true` **bukan bug baru**, melainkan bagian yang benar dari fix. ✅

**Verdict:** FALSE ALARM — `old_div` di dalam input parameter ke waterfall adalah disengaja.

---

## 🔴 KRITIS — Bug #2: Mitra Cibubur Masih Kena Bug Lama (Data 14 Aug)

**Temuan — Ledger pemakaian dengan nilai suspiciously small:**
```
MITRA CIBUBUR | AYAM       | qty: -0.400  | est_gram: 400g  | Order #50 (2026-08-14)
MITRA CIBUBUR | SAPI       | qty: -0.125  | est_gram: 125g  | Order #51 (2026-08-14)
MITRA CIBUBUR | MAYONAISE  | qty: -0.050  | est_gram: 50g   | Order #51 (2026-08-14)
...
```

**Ini masalah serius!** Entri tanggal **14 Agustus 2026** (kemarin) masih menggunakan format lama: `qty` dalam satuan besar (e.g., -0.125 kg) bukan gram.

**Kenapa?** Karena **Mitra Cibubur** mungkin tidak ada dalam `bom_automation_allowed_outlets`, atau fix baru diterapkan hari ini (15 Aug) sehingga order kemarin belum terkena fix.

**Dampak:** Saldo Mitra Cibubur saat ini **sangat tidak akurat** — terlalu besar. Harus opname segera.

---

## 🔴 KRITIS — Bug #3: 20 Outlet dengan Saldo Negatif

**Temuan:**
| Outlet | Bahan | Saldo | Unit |
|---|---|---|---|
| SUKA SHAWARMA BNR | KULIT 32 | **-14.95** | satuan_besar |
| SUKA SHAWARMA BNR | LETTUCE | **-43.945** | satuan_besar |
| SUKA SHAWARMA BNR | FOIL | **-892.67** | satuan_besar |
| SUKA SHAWARMA BNR | MINYAK | **-13.98** | satuan_besar |
| SUKA SHAWARMA CIRENDEU | MAYONES | **-0.10** | satuan_besar |
| MITRA PALEDANG | FOIL | **-161.67** | gram |
| SUKA SHAWARMA DRAMAGA | FOIL | **-478.46** | gram |
| SUKA SHAWARMA CIMANGGU | FOIL | **-425.83** | gram |
| SUKA SHAWARMA BNR | FOIL | **-892.67** | satuan_besar |
| JAGAKARSA | SAPI | **-0.36** | gram |
| ... | ... | ... | ... |

**Root Cause:**
1. **BNR** — saldo besar-scale yang negatif menunjukkan pernah ada operasi yang memotong terlalu banyak (bisa dari mutasi, waste, atau opname yang salah input).
2. **FOIL** di beberapa outlet — foil dihitung dalam `cm` (faktor_konversi = 24 per roll). Kemungkinan formula pemakaian FOIL selama ini sudah dalam gram-scale yang benar (24cm/roll = 24) tapi satuan di sistem membingungkan.
3. **ES BATU, MIE, STIKER** — nilai negatif sangat kecil (-0.016, -0.025, -0.05) — kemungkinan floating point rounding error.

**Tindakan:** Opname akan fix ini secara otomatis.

---

## 🟡 MEDIUM — Bug #4: 14 Menu Items Terjual Tanpa Resep (BOM Blind Spots)

**Temuan — 7 hari terakhir, tidak ada BOM cut:**
| Menu Item | Porsi Terjual | Keterangan |
|---|---|---|
| **BEST SELLER 2 (SAPI JUMBO)** | **288 porsi** | 🔴 Volume tinggi! |
| **SHAWARMA DUO COMBO** | **269 porsi** | 🔴 Ini paket/combo |
| **BEST SELLER (MIX JUMBO)** | **132 porsi** | 🔴 Volume tinggi! |
| BEST SELLER 2 | 65 porsi | ⚠️ |
| SUKA DUO FAVORIT | 54 porsi | ⚠️ Kemungkinan paket |
| Combo #1 | 44 porsi | ⚠️ |
| SHAWARMA TRIPLE COMBO | 43 porsi | ⚠️ |
| SUKA TRIPLE FAVORIT | 14 porsi | |
| SUKA PREMIUM CRISPY | 14 porsi | |
| MIX CHEESE COMBO | 8 porsi | |
| SHAWARMIE DUO VARIAN | 6 porsi | |
| MEGABITE COMBO | 2 porsi | |
| Combo #2 UP SIZE | 1 porsi | |
| Combo #3 | 1 porsi | |

**Root Cause Potensial:**
- Menu item ini adalah **paket** (is_package=true) tapi `is_active=false` di tabel `menu_packages` query — sehingga komponen-nya tidak terbaca.
- Atau menu item ini punya `menu_item_ref` yang salah format (UUID vs string mismatch).
- BEST SELLER 2 (SAPI JUMBO) terjual 288x tanpa BOM cut = **ratusan kilogram stok tidak terpotong** dalam 7 hari!

---

## 🟡 MEDIUM — Bug #5: 3+ Orphan Resep Aktif

**Temuan:**
```
🔴 ACTIVE | Shawarma Subsidi       | global  (no menu_item_ref)
🔴 ACTIVE | Ayam Sedang Subsidi    | global
🔴 ACTIVE | Shawarma Online Reguler | global
🔴 ACTIVE | Shawarma Online Reguler Mix | global
🔴 ACTIVE | Shawarma Online Reguler Sapi | global
```

Resep ini `is_active=true` tapi **tidak pernah bisa dipakai** karena tidak ada `menu_item_ref`. Resep "Shawarma Online Reguler" dll kemungkinan seharusnya terhubung ke menu item BEST SELLER / online variants yang ada di Bug #4.

**Tindakan:** Set `menu_item_ref` untuk resep ini agar BOM berjalan.

---

## ✅ OK — Tidak Ada Masalah

| Check | Status |
|---|---|
| Bahan dengan faktor_konversi = 0/NULL | ✅ None |
| Resep duplikat per menu item | ✅ None |
| Trigger functions exists | ✅ |
| process_waterfall_deduction & to_ledger_scale | ✅ Exists |

---

## 🔍 Investigasi Tambahan Diperlukan

### Bug #4 Deep Dive: Kenapa BEST SELLER 2 tidak punya resep?

Kemungkinan:
1. Menu item ini adalah **paket** (combo) yang komponen-nya punya resep, tapi `menu_packages` tidak terdaftar dengan benar
2. `menu_item_ref` di resep ada tapi formatnya berbeda (misalnya ada `|ID|xxx` suffix di nama)
3. Menu item baru yang belum dibuatkan resepnya

### Bug #3 Deep Dive: BNR Foil -892 satuan besar

FOIL di BNR saldo `-892.67` dalam satuan besar. Jika faktor_konversi FOIL = 24 (roll/cm), maka ini setara **21.4 roll FOIL negatif** — tidak masuk akal. Kemungkinan ada mutasi atau opname yang salah input negatif/positif terbalik.

---

## Prioritas Tindakan

| # | Tindakan | Prioritas | Dampak |
|---|---|---|---|
| 1 | **Investigasi & fix resep BEST SELLER 2 / SAPI JUMBO** — 288 porsi tanpa BOM cut | 🔴 URGENT | HPP tidak terhitung ratusan porsi/minggu |
| 2 | **Hubungkan orphan resep** (Shawarma Online Reguler) ke menu_item_ref yang benar | 🔴 HIGH | BOM blind spot |
| 3 | **Opname Mitra Cibubur** — data kemarin masih pakai format lama | 🔴 HIGH | Saldo tidak akurat |
| 4 | **Opname semua outlet** — reset saldo ke fisik aktual | 🟡 MEDIUM | Baseline baru |
| 5 | **Investigate saldo negatif BNR** — terutama FOIL & LETTUCE | 🟡 MEDIUM | Anomali data |
| 6 | Cek format `is_package` di SHAWARMA DUO COMBO & paket lainnya | 🟡 MEDIUM | BOM blind spot |
