# DOKUMEN STANDAR HARGA POKOK PENJUALAN (HPP) PER MENU
## Suka Shawarma Indonesia — Standar Costing & Profitabilitas Produk

> **Status Dokumen:** Resmi & Terverifikasi (Production Ready)  
> **Basis Data:** Kalkulator COGS Resmi, Sistem Resep (BOM Database Supabase), Master Harga Bahan Baku, & Rekonsiliasi Distribusi  
> **Terakhir Diperbarui:** Agustus 2026  
> **Target Pengguna:** Direksi / Owner, Tim Finance & Accounting, Supervisor Operasional / Outlet, & Tim IT / POS

---

## 1. PENDAHULUAN & METODOLOGI HPP

### 1.1 Definisi HPP Suka Shawarma
**Harga Pokok Penjualan (HPP) / *Cost of Goods Sold (COGS)*** per menu adalah total akumulasi biaya langsung yang dikeluarkan untuk memproduksi 1 (satu) porsi menu siap saji kepada pelanggan.

Komponen penyusun HPP per porsi di Suka Shawarma terdiri dari 4 elemen utama:
$$\text{HPP Total} = \text{Biaya Bahan Baku (Food Cost)} + \text{Biaya Kemasan (Packaging)} + \text{Biaya Utilitas Masak (Gas LPG)} + \text{Buffer Susut (Waste / Shrinkage)}$$

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KOMPONEN HPP PER PORSI                          │
├───────────────────┬───────────────────┬────────────────┬───────────────┤
│ 1. Raw Materials  │ 2. Packaging      │ 3. Utilities   │ 4. Buffer     │
│ - Daging marinasi │ - Paper Wrap      │ - Gas LPG 3Kg  │ - Susut masak │
│ - Kulit Tortilla  │ - Aluminium Foil  │   (berbasis    │ - Drip loss   │
│ - Saus & Mayones  │ - Kantong Plastik │   gramasi gas/ │   (defrost)   │
│ - Sayuran/Lettuce │ - Cup & Tutup     │   porsi)       │ - Trimming &  │
│ - Minyak & Tum    │ - Stiker Logo     │                │   transfer    │
│ - Kentang / Mie   │ - Dus & Vacum     │                │   loss        │
└───────────────────┴───────────────────┴────────────────┴───────────────┘
```

### 1.2 Rumus & Metrik Finansial
1. **Food Cost Ratio (%):**
   $$\text{Food Cost Ratio} = \left( \frac{\text{HPP Total}}{\text{Harga Jual}} \right) \times 100\%$$
   *Standar Ideal Industri F&B: 30% – 45% (Tergantung Kategori Produk & Saluran Penjualan).*

2. **Laba Kotor / Gross Profit (Rp):**
   $$\text{Gross Profit} = \text{Harga Jual (Nett)} - \text{HPP Total}$$

3. **Gross Profit Margin (%):**
   $$\text{Gross Margin} = \left( \frac{\text{Gross Profit}}{\text{Harga Jual (Nett)}} \right) \times 100\%$$

4. **Metode Valuasi Stok Sesuai ADR-011:**
   Menggunakan metode **Last Purchase Price (Harga Terakhir)** yang di-snapshot pada setiap sesi Order / Surat Jalan Distribusi, kemudian direkonsiliasi dengan **Stock Opname Harian** di setiap outlet.

---

## 2. MASTER BIAYA BAHAN BAKU & KEMASAN TERKINI

Berikut adalah daftar acuan harga beli per satuan besar (kemasan pembelian supplier), faktor konversi sistem, dan biaya dasar per satuan pemakaian terkecil:

| No | Nama Bahan Baku / Kemasan | Kategori | Satuan Beli | Isi / Faktor Konversi | Satuan Resep | Harga Beli (Rp) | Biaya Satuan Terkecil |
|:--:|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | **AYAM (Marinasi)** | Protein | kg | 1.000 | gram | Rp 47.800 | **Rp 47,80 / gram** |
| 2 | **SAPI (Blok Kebab)** | Protein | blok | 2.000 | gram | Rp 100.000 | **Rp 50,00 / gram** |
| 3 | **KULIT 25 cm** | Kulit | pack | 20 | lembar | Rp 27.000 | **Rp 1.350,00 / lbr** |
| 4 | **KULIT 28 cm** | Kulit | pack | 20 | lembar | Rp 32.000 | **Rp 1.600,00 / lbr** |
| 5 | **KULIT 32 cm** | Kulit | pack | 20 | lembar | Rp 38.000 | **Rp 1.900,00 / lbr** |
| 6 | **MAYONES** | Saus/Bumbu | kg | 1.000 | gram | Rp 22.000 | **Rp 22,00 / gram** |
| 7 | **SAOS CABE / TOMAT** | Saus/Bumbu | kg | 1.000 | gram | Rp 15.000 | **Rp 15,00 / gram** |
| 8 | **SAOS SAMYANG** | Saus/Bumbu | kg | 1.000 | gram | Rp 14.500 | **Rp 14,50 / gram** |
| 9 | **TUM (Garlic Paste)** | Bumbu | kg | 1.000 | gram | Rp 100.000 | **Rp 100,00 / gram** |
| 10 | **MINYAK SAYUR** | Bahan Goreng | kg | 1.000 | gram | Rp 23.000 | **Rp 23,00 / gram** |
| 11 | **KENTANG GORENG** | Karbohidrat | kg | 1.000 | gram | Rp 24.000 | **Rp 24,00 / gram** |
| 12 | **LETTUCE (Sayur Segar)**| Sayuran | kg | 1.000 | gram | Rp 28.000 | **Rp 28,00 / gram** |
| 13 | **KEJU SLICE** | Pelengkap | dus (pack) | 20 (240 lbr) | lembar | Rp 288.000 | **Rp 1.200,00 / lbr** |
| 14 | **MIE INSTAN KHUSUS** | Karbohidrat | dus (40 pcs)| 40 | pcs | Rp 120.000 | **Rp 3.000,00 / pcs** |
| 15 | **TEPUNG BUMBU** | Bumbu | kg | 1.000 | gram | Rp 18.000 | **Rp 18,00 / gram** |
| 16 | **POWDER MIX DRINK** | Minuman | kg | 1.000 | gram | Rp 56.000 | **Rp 56,00 / gram** |
| 17 | **ES BATU KRISTAL** | Minuman | bal | 25 | cup/porsi | Rp 10.080 | **Rp 403,23 / porsi**|
| 18 | **PAPER WRAP** | Kemasan | pack | 500 | lembar | Rp 80.000 | **Rp 160,00 / lbr** |
| 19 | **ALUMINIUM FOIL** | Kemasan | roll (7,5 m)| 750 | cm | Rp 11.800 | **Rp 15,73 / cm** |
| 20 | **PLASTIK MERAH** | Kemasan | ikat | 100 | lembar | Rp 20.000 | **Rp 200,00 / lbr** |
| 21 | **PLASTIK VACUM** | Kemasan | pack | 100 | lembar | Rp 70.000 | **Rp 700,00 / lbr** |
| 22 | **DUS PACKING ONLINE** | Kemasan | pack | 100 | pcs | Rp 130.000 | **Rp 1.300,00 / pcs** |
| 23 | **CUP + TUTUP MINUMAN**| Kemasan | pack | 50 | set | Rp 82.500 | **Rp 1.650,00 / set** |
| 24 | **STIKER LOGO CUP** | Kemasan | roll | 100 | pcs | Rp 40.000 | **Rp 400,00 / pcs** |
| 25 | **GAS LPG 3 KG** | Utilitas | tabung | 3.000 | gram | Rp 23.000 | **Rp 7,67 / gram** |

---

## 3. MASTER SUMMARY TABEL HPP & PROFITABILITAS PER MENU

Tabel berikut menyajikan ringkasan HPP, Harga Jual Kasir (POS Offline), Harga Online (TikTok Shop / ShopeeFood / GoFood), Gross Profit, dan Gross Margin untuk seluruh menu Suka Shawarma:

### 3.1 Menu Single (Ala Carte)

| No | Kategori | Nama Menu | Ukuran Tortilla | Total HPP (Rp) | Harga POS Kasir (Rp) | Gross Profit POS (Rp) | Margin POS (%) | Harga Online Channel (Rp) | Margin Online (%) |
|:--:|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | **Original Ayam** | Shawarma Ayam Sedang | 25 cm | **14.051** | 24.000 | 9.949 | **41,5%** | 29.000 | **51,5%** |
| 2 | **Original Ayam** | Shawarma Ayam Besar | 28 cm | **16.896** | 29.000 | 12.104 | **41,7%** | 35.000 | **51,7%** |
| 3 | **Original Ayam** | Shawarma Ayam Jumbo | 32 cm | **21.130** | 31.000 | 9.870 | **31,8%** | 38.000 | **44,4%** |
| 4 | **Original Sapi** | Shawarma Sapi Sedang | 25 cm | **16.391** | 24.000 | 7.609 | **31,7%** | 29.000 | **43,5%** |
| 5 | **Original Sapi** | Shawarma Sapi Besar | 28 cm | **18.729** | 27.000 | 8.271 | **30,6%** | 33.000 | **43,2%** |
| 6 | **Original Sapi** | Shawarma Sapi Jumbo | 32 cm | **23.793** | 34.000 | 10.207 | **30,0%** | 41.000 | **42,0%** |
| 7 | **Original Mix** | Shawarma Mix Besar | 28 cm | **20.480** | 30.000 | 9.520 | **31,7%** | 36.000 | **43,1%** |
| 8 | **Original Mix** | Shawarma Mix Jumbo | 32 cm | **26.870** | 39.000 | 12.130 | **31,1%** | 47.000 | **42,8%** |
| 9 | **Shawarmie** | Shawarmie Ayam (Kebab Mie) | 25 cm | **14.722** | 22.000 | 7.278 | **33,1%** | 27.000 | **45,5%** |
| 10 | **Shawarmie** | Shawarmie Sapi (Kebab Mie) | 25 cm | **16.464** | 24.000 | 7.536 | **31,4%** | 29.000 | **43,2%** |
| 11 | **Suka-Suka** | Suka Beef (Double Cheese) | 25 cm | **18.174** | 26.000 | 7.826 | **30,1%** | 32.000 | **43,2%** |
| 12 | **Suka-Suka** | Suka Chicken (Double Cheese)| 25 cm | **16.932** | 25.000 | 8.068 | **32,3%** | 30.000 | **43,6%** |
| 13 | **Suka-Suka** | Suka Fried Chicken | 25 cm | **17.845** | 26.000 | 8.155 | **31,4%** | 32.000 | **44,2%** |
| 14 | **Suka-Suka** | Suka Samyang (Pedas Korea) | 25 cm | **17.860** | 26.000 | 8.140 | **31,3%** | 32.000 | **44,2%** |
| 15 | **Minuman** | Suka Drink Ice Tea | Cup 16oz | **4.793** | 10.000 | 5.207 | **52,1%** | 12.000 | **60,1%** |
| 16 | **Minuman** | Suka Drink Orange Jus | Cup 16oz | **4.793** | 10.000 | 5.207 | **52,1%** | 12.000 | **60,1%** |
| 17 | **Reguler/Subsidi**| Shawarma Subsidi | 25 cm | **10.171** | 17.000 | 6.829 | **40,2%** | - | - |
| 18 | **Reguler/Subsidi**| Ayam Sedang Subsidi | 25 cm | **9.789** | 16.500 | 6.711 | **40,7%** | - | - |
| 19 | **Frozen Online** | Shawarma Online Ayam (Vacum) | 25 cm | **8.308** | - | - | - | 15.000 | **44,6%** |
| 20 | **Frozen Online** | Shawarma Online Sapi (Vacum) | 25 cm | **9.115** | - | - | - | 16.500 | **44,8%** |
| 21 | **Frozen Online** | Shawarma Online Mix (Vacum) | 25 cm | **9.405** | - | - | - | 17.000 | **44,7%** |

---

### 3.2 Menu Paket, Combo & Best Seller

| No | Nama Paket Combo | Komponen Menu Penyusun | Total HPP (Rp) | Harga POS Kasir (Rp) | Gross Profit POS (Rp) | Margin POS (%) | Harga Online Channel (Rp) | Margin Online (%) |
|:--:|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | **SHAWARMA DUO COMBO** | 1x Ayam Sedang + 1x Sapi Sedang | **30.442** | 42.000 | 11.558 | **27,5%** | 52.000 | **41,5%** |
| 2 | **SHAWARMA TRIPLE COMBO**| 1x Ayam Sedang + 1x Sapi Sedang + 1x Mix Besar | **50.922** | 68.000 | 17.078 | **25,1%** | 82.000 | **37,9%** |
| 3 | **SUKA DUO FAVORITE** | 1x Suka Beef + 1x Suka Chicken | **35.106** | 48.000 | 12.894 | **26,9%** | 58.000 | **39,5%** |
| 4 | **MIX CHEESE COMBO** | 1x Mix Besar + 1x Suka Chicken + 1x Suka Drink | **42.205** | 60.000 | 17.795 | **29,7%** | 72.000 | **41,4%** |
| 5 | **PAKET COUPLE** | 1x Sapi Sedang + 1x Shawarmie Ayam + 1x Suka Drink | **35.906** | 48.000 | 12.094 | **25,2%** | 58.000 | **38,1%** |
| 6 | **PAKET NONGKI 1** | 1x Sapi Sedang + 2x Ice Tea | **25.977** | 38.000 | 12.023 | **31,6%** | 46.000 | **43,5%** |
| 7 | **PAKET NIKMAT** | 1x Mix Jumbo + 1x Suka Samyang + 1x Suka Drink | **49.523** | 68.000 | 18.477 | **27,2%** | 82.000 | **39,6%** |
| 8 | **BEST SELLER 2 (Up Size Sapi)** | 1x Sapi Jumbo + 1x Suka Drink | **28.586** | 45.000 | 16.414 | **36,5%** | 52.000 | **45,0%** |
| 9 | **BEST SELLER (Mix Jumbo)** | 1x Shawarma Mix Jumbo | **26.870** | 39.000 | 12.130 | **31,1%** | 47.000 | **42,8%** |

---

### 3.3 Add-On & Topping Tambahan

| No | Nama Add-On / Topping | Komposisi Gramasi / Satuan | Total HPP (Rp) | Harga Jual POS (Rp) | Gross Profit (Rp) | Margin (%) |
|:--:|---|---|:---:|:---:|:---:|:---:|
| 1 | **Extra Keju Slice (1 Lembar)** | 1 Lembar Keju Slice | **1.200** | 4.000 | 2.800 | **70,0%** |
| 2 | **Extra Keju Slice (2 Lembar)** | 2 Lembar Keju Slice | **2.400** | 7.000 | 4.600 | **65,7%** |
| 3 | **Extra Kentang Goreng (French Fries)**| 80g Kentang + 20g Minyak + Bumbu | **2.500** | 8.000 | 5.500 | **68,8%** |
| 4 | **Extra Daging Ayam** | 50g Daging Ayam Marinasi + Gas | **2.500** | 7.000 | 4.500 | **64,3%** |
| 5 | **Extra Daging Sapi** | 50g Daging Sapi Blok + Gas | **2.650** | 8.000 | 5.350 | **66,9%** |

---

## 4. RINCIAN STRUKTUR BOM & HPP DETAIL PER MENU

Bagian ini memaparkan resep baku, gramasi bahan per porsi, dan kalkulasi biaya terperinci dari masing-masing menu.

### 4.1 Kategori Original Ayam

#### A. Shawarma Ayam Sedang (Tortilla 25 cm)
* **Total HPP:** `Rp 14.051` | **Harga Jual Rekomendasi:** `Rp 24.000` | **Margin:** `41,5%`
* **Karakteristik Produk:** Menu entry-level ayam paling populer dengan tortilla 25cm.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Ayam Marinasi | 100 | gram | Rp 47,80 / g | Rp 4.780 | 34,0% |
| Kulit Tortilla 25 cm | 1 | lembar | Rp 1.350,00 / lbr | Rp 1.350 | 9,6% |
| Kentang Goreng | 65 | gram | Rp 24,00 / g | Rp 1.560 | 11,1% |
| Lettuce (Sayur Segar) | 60 | gram | Rp 28,00 / g | Rp 1.680 | 12,0% |
| Mayones | 50 | gram | Rp 22,00 / g | Rp 1.100 | 7,8% |
| Saos Cabe / Tomat | 50 | gram | Rp 15,00 / g | Rp 750 | 5,3% |
| Tum (Garlic Paste) | 5 | gram | Rp 100,00 / g | Rp 500 | 3,6% |
| Minyak Sayur | 25 | gram | Rp 23,00 / g | Rp 575 | 4,1% |
| Gas LPG 3Kg | 45 | gram | Rp 7,67 / g | Rp 345 | 2,5% |
| Aluminium Foil (35 cm) | 35 | cm | Rp 15,73 / cm | Rp 551 | 3,9% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 1,1% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 1,4% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 500,00 | Rp 500 | 3,6% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 14.051** | **100,0%** |

---

#### B. Shawarma Ayam Besar (Tortilla 28 cm)
* **Total HPP:** `Rp 16.896` | **Harga Jual Rekomendasi:** `Rp 29.000` | **Margin:** `41,7%`
* **Karakteristik Produk:** Porsi ayam 125g dengan tortilla 28cm.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Ayam Marinasi | 125 | gram | Rp 47,80 / g | Rp 5.975 | 35,4% |
| Kulit Tortilla 28 cm | 1 | lembar | Rp 1.600,00 / lbr | Rp 1.600 | 9,5% |
| Kentang Goreng | 88 | gram | Rp 24,00 / g | Rp 2.112 | 12,5% |
| Lettuce (Sayur Segar) | 65 | gram | Rp 28,00 / g | Rp 1.820 | 10,8% |
| Mayones | 40 | gram | Rp 22,00 / g | Rp 880 | 5,2% |
| Saos Cabe / Tomat | 40 | gram | Rp 15,00 / g | Rp 600 | 3,6% |
| Tum (Garlic Paste) | 10 | gram | Rp 100,00 / g | Rp 1.000 | 5,9% |
| Minyak Sayur | 25 | gram | Rp 23,00 / g | Rp 575 | 3,4% |
| Gas LPG 3Kg | 45 | gram | Rp 7,67 / g | Rp 345 | 2,0% |
| Aluminium Foil (40 cm) | 40 | cm | Rp 15,73 / cm | Rp 629 | 3,7% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 0,9% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 1,2% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 1.000,00 | Rp 1.000 | 5,9% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 16.896** | **100,0%** |

---

#### C. Shawarma Ayam Jumbo (Tortilla 32 cm)
* **Total HPP:** `Rp 21.130` | **Harga Jual Rekomendasi:** `Rp 31.000` | **Margin:** `31,8%`
* **Karakteristik Produk:** Porsi ayam 155g, kentang 140g, kulit jumbo 32cm.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Ayam Marinasi | 155 | gram | Rp 47,80 / g | Rp 7.409 | 35,1% |
| Kulit Tortilla 32 cm | 1 | lembar | Rp 1.900,00 / lbr | Rp 1.900 | 9,0% |
| Kentang Goreng | 140 | gram | Rp 24,00 / g | Rp 3.360 | 15,9% |
| Lettuce (Sayur Segar) | 80 | gram | Rp 28,00 / g | Rp 2.240 | 10,6% |
| Mayones | 50 | gram | Rp 22,00 / g | Rp 1.100 | 5,2% |
| Saos Cabe / Tomat | 50 | gram | Rp 15,00 / g | Rp 750 | 3,6% |
| Tum (Garlic Paste) | 10 | gram | Rp 100,00 / g | Rp 1.000 | 4,7% |
| Minyak Sayur | 40 | gram | Rp 23,00 / g | Rp 920 | 4,4% |
| Gas LPG 3Kg | 50 | gram | Rp 7,67 / g | Rp 383 | 1,8% |
| Aluminium Foil (45 cm) | 45 | cm | Rp 15,73 / cm | Rp 708 | 3,4% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 0,8% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 0,9% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 1.000,00 | Rp 1.000 | 4,7% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 21.130** | **100,0%** |

---

### 4.2 Kategori Original Sapi

#### A. Shawarma Sapi Sedang (Tortilla 25 cm)
* **Total HPP:** `Rp 16.391` | **Harga Jual Rekomendasi:** `Rp 24.000` | **Margin:** `31,7%`
* **Karakteristik Produk:** Daging sapi blok 110g dengan kulit 25cm.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Sapi Blok | 110 | gram | Rp 50,00 / g | Rp 5.500 | 33,6% |
| Kulit Tortilla 25 cm | 1 | lembar | Rp 1.350,00 / lbr | Rp 1.350 | 8,2% |
| Kentang Goreng | 70 | gram | Rp 24,00 / g | Rp 1.680 | 10,3% |
| Lettuce (Sayur Segar) | 60 | gram | Rp 28,00 / g | Rp 1.680 | 10,3% |
| Mayones | 50 | gram | Rp 22,00 / g | Rp 1.100 | 6,7% |
| Saos Cabe / Tomat | 50 | gram | Rp 15,00 / g | Rp 750 | 4,6% |
| Tum (Garlic Paste) | 5 | gram | Rp 100,00 / g | Rp 500 | 3,1% |
| Minyak Sayur | 25 | gram | Rp 23,00 / g | Rp 575 | 3,5% |
| Gas LPG 3Kg | 45 | gram | Rp 7,67 / g | Rp 345 | 2,1% |
| Aluminium Foil (35 cm) | 35 | cm | Rp 15,73 / cm | Rp 551 | 3,4% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 1,0% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 1,2% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 2.000,00 | Rp 2.000 | 12,2% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 16.391** | **100,0%** |

---

#### B. Shawarma Sapi Besar (Tortilla 28 cm)
* **Total HPP:** `Rp 18.729` | **Harga Jual Rekomendasi:** `Rp 27.000` | **Margin:** `30,6%`
* **Karakteristik Produk:** Daging sapi 125g dengan kulit 28cm.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Sapi Blok | 125 | gram | Rp 50,00 / g | Rp 6.250 | 33,4% |
| Kulit Tortilla 28 cm | 1 | lembar | Rp 1.600,00 / lbr | Rp 1.600 | 8,5% |
| Kentang Goreng | 90 | gram | Rp 24,00 / g | Rp 2.160 | 11,5% |
| Lettuce (Sayur Segar) | 70 | gram | Rp 28,00 / g | Rp 1.960 | 10,5% |
| Mayones | 50 | gram | Rp 22,00 / g | Rp 1.100 | 5,9% |
| Saos Cabe / Tomat | 50 | gram | Rp 15,00 / g | Rp 750 | 4,0% |
| Tum (Garlic Paste) | 10 | gram | Rp 100,00 / g | Rp 1.000 | 5,3% |
| Minyak Sayur | 25 | gram | Rp 23,00 / g | Rp 575 | 3,1% |
| Gas LPG 3Kg | 45 | gram | Rp 7,67 / g | Rp 345 | 1,8% |
| Aluminium Foil (40 cm) | 40 | cm | Rp 15,73 / cm | Rp 629 | 3,4% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 0,9% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 1,1% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 2.000,00 | Rp 2.000 | 10,7% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 18.729** | **100,0%** |

---

#### C. Shawarma Sapi Jumbo (Tortilla 32 cm)
* **Total HPP:** `Rp 23.793` | **Harga Jual Rekomendasi:** `Rp 34.000` | **Margin:** `30,0%`
* **Karakteristik Produk:** Porsi daging sapi 170g, kentang 150g, tortilla jumbo 32cm.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Sapi Blok | 170 | gram | Rp 50,00 / g | Rp 8.500 | 35,7% |
| Kulit Tortilla 32 cm | 1 | lembar | Rp 1.900,00 / lbr | Rp 1.900 | 8,0% |
| Kentang Goreng | 150 | gram | Rp 24,00 / g | Rp 3.600 | 15,1% |
| Lettuce (Sayur Segar) | 80 | gram | Rp 28,00 / g | Rp 2.240 | 9,4% |
| Mayones | 60 | gram | Rp 22,00 / g | Rp 1.320 | 5,5% |
| Saos Cabe / Tomat | 60 | gram | Rp 15,00 / g | Rp 900 | 3,8% |
| Tum (Garlic Paste) | 10 | gram | Rp 100,00 / g | Rp 1.000 | 4,2% |
| Minyak Sayur | 35 | gram | Rp 23,00 / g | Rp 805 | 3,4% |
| Gas LPG 3Kg | 60 | gram | Rp 7,67 / g | Rp 460 | 1,9% |
| Aluminium Foil (45 cm) | 45 | cm | Rp 15,73 / cm | Rp 708 | 3,0% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 0,7% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 0,8% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 2.000,00 | Rp 2.000 | 8,4% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 23.793** | **100,0%** |

---

### 4.3 Kategori Original Mix (Ayam + Sapi)

#### A. Shawarma Mix Besar (Tortilla 28 cm)
* **Total HPP:** `Rp 20.480` | **Harga Jual Rekomendasi:** `Rp 30.000` | **Margin:** `31,7%`
* **Karakteristik Produk:** Kombinasi 70g Daging Ayam + 60g Daging Sapi.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Sapi Blok | 60 | gram | Rp 50,00 / g | Rp 3.000 | 14,6% |
| Daging Ayam Marinasi | 70 | gram | Rp 47,80 / g | Rp 3.346 | 16,3% |
| Kulit Tortilla 28 cm | 1 | lembar | Rp 1.600,00 / lbr | Rp 1.600 | 7,8% |
| Kentang Goreng | 150 | gram | Rp 24,00 / g | Rp 3.600 | 17,6% |
| Lettuce (Sayur Segar) | 70 | gram | Rp 28,00 / g | Rp 1.960 | 9,6% |
| Mayones | 60 | gram | Rp 22,00 / g | Rp 1.320 | 6,4% |
| Saos Cabe / Tomat | 60 | gram | Rp 15,00 / g | Rp 900 | 4,4% |
| Tum (Garlic Paste) | 10 | gram | Rp 100,00 / g | Rp 1.000 | 4,9% |
| Minyak Sayur | 35 | gram | Rp 23,00 / g | Rp 805 | 3,9% |
| Gas LPG 3Kg | 60 | gram | Rp 7,67 / g | Rp 460 | 2,2% |
| Aluminium Foil (40 cm) | 40 | cm | Rp 15,73 / cm | Rp 629 | 3,1% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 0,8% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 1,0% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 1.500,00 | Rp 1.500 | 7,3% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 20.480** | **100,0%** |

---

#### B. Shawarma Mix Jumbo (Tortilla 32 cm)
* **Total HPP:** `Rp 26.870` | **Harga Jual Rekomendasi:** `Rp 39.000` | **Margin:** `31,1%`
* **Karakteristik Produk:** Kombinasi 110g Daging Ayam + 120g Daging Sapi + 160g Kentang.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Sapi Blok | 120 | gram | Rp 50,00 / g | Rp 6.000 | 22,3% |
| Daging Ayam Marinasi | 110 | gram | Rp 47,80 / g | Rp 5.258 | 19,6% |
| Kulit Tortilla 32 cm | 1 | lembar | Rp 1.900,00 / lbr | Rp 1.900 | 7,1% |
| Kentang Goreng | 160 | gram | Rp 24,00 / g | Rp 3.840 | 14,3% |
| Lettuce (Sayur Segar) | 80 | gram | Rp 28,00 / g | Rp 2.240 | 8,3% |
| Mayones | 60 | gram | Rp 22,00 / g | Rp 1.320 | 4,9% |
| Saos Cabe / Tomat | 60 | gram | Rp 15,00 / g | Rp 900 | 3,3% |
| Tum (Garlic Paste) | 10 | gram | Rp 100,00 / g | Rp 1.000 | 3,7% |
| Minyak Sayur | 35 | gram | Rp 23,00 / g | Rp 805 | 3,0% |
| Gas LPG 3Kg | 60 | gram | Rp 7,67 / g | Rp 460 | 1,7% |
| Aluminium Foil (50 cm) | 50 | cm | Rp 15,73 / cm | Rp 787 | 2,9% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 0,6% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 0,7% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 2.000,00 | Rp 2.000 | 7,4% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 26.870** | **100,0%** |

---

### 4.4 Kategori Shawarmie (Kebab Isi Mie)

#### A. Shawarmie Ayam
* **Total HPP:** `Rp 14.722` | **Harga Jual Rekomendasi:** `Rp 22.000` | **Margin:** `33,1%`
* **Karakteristik Produk:** Kebab fusion dengan isian 110g Ayam + 1 bungkus Mie.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Ayam Marinasi | 110 | gram | Rp 47,80 / g | Rp 5.258 | 35,7% |
| Mie Instan Khusus | 1 | pcs | Rp 3.000,00 / pcs | Rp 3.000 | 20,4% |
| Kulit Tortilla 25 cm | 1 | lembar | Rp 1.350,00 / lbr | Rp 1.350 | 9,2% |
| Lettuce (Sayur Segar) | 60 | gram | Rp 28,00 / g | Rp 1.680 | 11,4% |
| Saos Cabe / Tomat | 30 | gram | Rp 15,00 / g | Rp 450 | 3,1% |
| Minyak Sayur | 30 | gram | Rp 23,00 / g | Rp 690 | 4,7% |
| Gas LPG 3Kg | 50 | gram | Rp 7,67 / g | Rp 383 | 2,6% |
| Aluminium Foil (35 cm) | 35 | cm | Rp 15,73 / cm | Rp 551 | 3,7% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 1,1% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 1,4% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 1.000,00 | Rp 1.000 | 6,8% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 14.722** | **100,0%** |

---

#### B. Shawarmie Sapi
* **Total HPP:** `Rp 16.464` | **Harga Jual Rekomendasi:** `Rp 24.000` | **Margin:** `31,4%`
* **Karakteristik Produk:** Kebab fusion dengan isian 120g Sapi + 1 bungkus Mie.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Sapi Blok | 120 | gram | Rp 50,00 / g | Rp 6.000 | 36,4% |
| Mie Instan Khusus | 1 | pcs | Rp 3.000,00 / pcs | Rp 3.000 | 18,2% |
| Kulit Tortilla 25 cm | 1 | lembar | Rp 1.350,00 / lbr | Rp 1.350 | 8,2% |
| Lettuce (Sayur Segar) | 60 | gram | Rp 28,00 / g | Rp 1.680 | 10,2% |
| Saos Cabe / Tomat | 30 | gram | Rp 15,00 / g | Rp 450 | 2,7% |
| Minyak Sayur | 30 | gram | Rp 23,00 / g | Rp 690 | 4,2% |
| Gas LPG 3Kg | 50 | gram | Rp 7,67 / g | Rp 383 | 2,3% |
| Aluminium Foil (35 cm) | 35 | cm | Rp 15,73 / cm | Rp 551 | 3,3% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 1,0% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 1,2% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 2.000,00 | Rp 2.000 | 12,1% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 16.464** | **100,0%** |

---

### 4.5 Kategori Suka-Suka (Signature Series)

#### A. Suka Beef (Double Cheese)
* **Total HPP:** `Rp 18.174` | **Harga Jual Rekomendasi:** `Rp 26.000` | **Margin:** `30,1%`
* **Karakteristik Produk:** Daging sapi 120g + 2 lembar Keju Slice + Saus Mayo & Tum kental.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Sapi Blok | 120 | gram | Rp 50,00 / g | Rp 6.000 | 33,0% |
| Keju Slice | 2 | lembar | Rp 1.200,00 / lbr | Rp 2.400 | 13,2% |
| Kulit Tortilla 25 cm | 1 | lembar | Rp 1.350,00 / lbr | Rp 1.350 | 7,4% |
| Lettuce (Sayur Segar) | 60 | gram | Rp 28,00 / g | Rp 1.680 | 9,2% |
| Mayones | 60 | gram | Rp 22,00 / g | Rp 1.320 | 7,3% |
| Tum (Garlic Paste) | 10 | gram | Rp 100,00 / g | Rp 1.000 | 5,5% |
| Saos Cabe / Tomat | 60 | gram | Rp 15,00 / g | Rp 900 | 5,0% |
| Minyak Sayur | 25 | gram | Rp 23,00 / g | Rp 575 | 3,2% |
| Gas LPG 3Kg | 60 | gram | Rp 7,67 / g | Rp 460 | 2,5% |
| Aluminium Foil (40 cm) | 40 | cm | Rp 15,73 / cm | Rp 629 | 3,5% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 0,9% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 1,1% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 1.500,00 | Rp 1.500 | 8,3% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 18.174** | **100,0%** |

---

#### B. Suka Chicken (Double Cheese)
* **Total HPP:** `Rp 16.932` | **Harga Jual Rekomendasi:** `Rp 25.000` | **Margin:** `32,3%`
* **Karakteristik Produk:** Daging ayam 110g + 2 lembar Keju Slice.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Ayam Marinasi | 110 | gram | Rp 47,80 / g | Rp 5.258 | 31,1% |
| Keju Slice | 2 | lembar | Rp 1.200,00 / lbr | Rp 2.400 | 14,2% |
| Kulit Tortilla 25 cm | 1 | lembar | Rp 1.350,00 / lbr | Rp 1.350 | 8,0% |
| Lettuce (Sayur Segar) | 60 | gram | Rp 28,00 / g | Rp 1.680 | 9,9% |
| Mayones | 60 | gram | Rp 22,00 / g | Rp 1.320 | 7,8% |
| Tum (Garlic Paste) | 10 | gram | Rp 100,00 / g | Rp 1.000 | 5,9% |
| Saos Cabe / Tomat | 60 | gram | Rp 15,00 / g | Rp 900 | 5,3% |
| Minyak Sayur | 25 | gram | Rp 23,00 / g | Rp 575 | 3,4% |
| Gas LPG 3Kg | 60 | gram | Rp 7,67 / g | Rp 460 | 2,7% |
| Aluminium Foil (40 cm) | 40 | cm | Rp 15,73 / cm | Rp 629 | 3,7% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 0,9% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 1,2% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 1.000,00 | Rp 1.000 | 5,9% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 16.932** | **100,0%** |

---

#### C. Suka Fried Chicken (Crispy Chicken Kebab)
* **Total HPP:** `Rp 17.845` | **Harga Jual Rekomendasi:** `Rp 26.000` | **Margin:** `31,4%`
* **Karakteristik Produk:** Ayam tepung crispy 120g + kentang 70g + saus spesial.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Ayam Marinasi | 120 | gram | Rp 47,80 / g | Rp 5.736 | 32,1% |
| Kentang Goreng | 70 | gram | Rp 24,00 / g | Rp 1.680 | 9,4% |
| Lettuce (Sayur Segar) | 60 | gram | Rp 28,00 / g | Rp 1.680 | 9,4% |
| Kulit Tortilla 25 cm | 1 | lembar | Rp 1.350,00 / lbr | Rp 1.350 | 7,6% |
| Minyak Sayur (Deep Fry) | 50 | gram | Rp 23,00 / g | Rp 1.150 | 6,4% |
| Tepung Bumbu Crispy | 50 | gram | Rp 18,00 / g | Rp 900 | 5,0% |
| Saos Cabe / Tomat | 60 | gram | Rp 15,00 / g | Rp 900 | 5,0% |
| Gas LPG 3Kg | 60 | gram | Rp 7,67 / g | Rp 460 | 2,6% |
| Aluminium Foil (40 cm) | 40 | cm | Rp 15,73 / cm | Rp 629 | 3,5% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 0,9% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 1,1% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 3.000,00 | Rp 3.000 | 16,8% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 17.845** | **100,0%** |

---

#### D. Suka Samyang (Korean Spicy Chicken)
* **Total HPP:** `Rp 17.860` | **Harga Jual Rekomendasi:** `Rp 26.000` | **Margin:** `31,3%`
* **Karakteristik Produk:** Ayam crispy 120g + Saus Samyang pedas 70g.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Ayam Marinasi | 120 | gram | Rp 47,80 / g | Rp 5.736 | 32,1% |
| Kentang Goreng | 70 | gram | Rp 24,00 / g | Rp 1.680 | 9,4% |
| Lettuce (Sayur Segar) | 60 | gram | Rp 28,00 / g | Rp 1.680 | 9,4% |
| Kulit Tortilla 25 cm | 1 | lembar | Rp 1.350,00 / lbr | Rp 1.350 | 7,6% |
| Minyak Sayur (Deep Fry) | 50 | gram | Rp 23,00 / g | Rp 1.150 | 6,4% |
| Saos Samyang Korea | 70 | gram | Rp 14,50 / g | Rp 1.015 | 5,7% |
| Tepung Bumbu Crispy | 50 | gram | Rp 18,00 / g | Rp 900 | 5,0% |
| Saos Cabe / Tomat | 60 | gram | Rp 15,00 / g | Rp 900 | 5,0% |
| Gas LPG 3Kg | 60 | gram | Rp 7,67 / g | Rp 460 | 2,6% |
| Aluminium Foil (40 cm) | 40 | cm | Rp 15,73 / cm | Rp 629 | 3,5% |
| Paper Wrap | 1 | lembar | Rp 160,00 / lbr | Rp 160 | 0,9% |
| Kantong Plastik Merah | 1 | lembar | Rp 200,00 / lbr | Rp 200 | 1,1% |
| Allowance / Loss & Shrinkage | 1 | porsi | Rp 2.000,00 | Rp 2.000 | 11,2% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 17.860** | **100,0%** |

---

### 4.6 Kategori Minuman (Suka Drink)

#### Suka Drink (Ice Tea / Orange Jus)
* **Total HPP:** `Rp 4.793` | **Harga Jual Rekomendasi:** `Rp 10.000` | **Margin:** `52,1%`
* **Karakteristik Produk:** Minuman segar 16oz dengan powder mix khusus dan es batu kristal.

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Powder Mix (Teh / Jeruk) | 40 | gram | Rp 56,00 / g | Rp 2.240 | 46,7% |
| Cup + Tutup Seal/Dome | 1 | set | Rp 1.650,00 / set | Rp 1.650 | 34,4% |
| Stiker Logo Suka Drink | 1 | pcs | Rp 400,00 / pcs | Rp 400 | 8,3% |
| Es Batu Kristal | 1 | porsi | Rp 403,23 / porsi | Rp 403 | 8,4% |
| Kantong Plastik Cup | 1 | lembar | Rp 100,00 / lbr | Rp 100 | 2,1% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 4.793** | **100,0%** |

---

### 4.7 Kategori Online & Frozen Vacuum Pack

#### A. Shawarma Online Reguler (Ayam Frozen)
* **Total HPP:** `Rp 8.308` | **Harga Jual Online:** `Rp 15.000` | **Margin:** `44,6%`

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Ayam | 60 | gram | Rp 47,80 / g | Rp 2.868 | 34,5% |
| Kulit Tortilla 25 cm | 1 | lembar | Rp 1.350,00 / lbr | Rp 1.350 | 16,3% |
| Dus Kemasan Online | 1 | pcs | Rp 1.300,00 / pcs | Rp 1.300 | 15,6% |
| Plastik Vacum Seal | 1 | lembar | Rp 700,00 / lbr | Rp 700 | 8,4% |
| Saos Cabe / Tomat | 40 | gram | Rp 15,00 / g | Rp 600 | 7,2% |
| Minyak Sayur | 20 | gram | Rp 23,00 / g | Rp 460 | 5,5% |
| Tum (Garlic Paste) | 3 | gram | Rp 100,00 / g | Rp 300 | 3,6% |
| Gas LPG 3Kg | 30 | gram | Rp 7,67 / g | Rp 230 | 2,8% |
| Allowance / Loss | 1 | porsi | Rp 500,00 | Rp 500 | 6,0% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 8.308** | **100,0%** |

---

#### B. Shawarma Online Reguler Sapi (Frozen)
* **Total HPP:** `Rp 9.115` | **Harga Jual Online:** `Rp 16.500` | **Margin:** `44,8%`

| Komponen Bahan / Kemasan | Qty Resep | Satuan | Harga Satuan (Rp) | Subtotal (Rp) | Proporsi % |
|---|:---:|:---:|:---:|:---:|:---:|
| Daging Sapi Blok | 70 | gram | Rp 52,50 / g | Rp 3.675 | 40,3% |
| Kulit Tortilla 25 cm | 1 | lembar | Rp 1.350,00 / lbr | Rp 1.350 | 14,8% |
| Dus Kemasan Online | 1 | pcs | Rp 1.300,00 / pcs | Rp 1.300 | 14,3% |
| Plastik Vacum Seal | 1 | lembar | Rp 700,00 / lbr | Rp 700 | 7,7% |
| Saos Cabe / Tomat | 40 | gram | Rp 15,00 / g | Rp 600 | 6,6% |
| Minyak Sayur | 20 | gram | Rp 23,00 / g | Rp 460 | 5,0% |
| Tum (Garlic Paste) | 3 | gram | Rp 100,00 / g | Rp 300 | 3,3% |
| Gas LPG 3Kg | 30 | gram | Rp 7,67 / g | Rp 230 | 2,5% |
| Allowance / Loss | 1 | porsi | Rp 500,00 | Rp 500 | 5,5% |
| **TOTAL BIAYA PRODUKSI** | - | - | - | **Rp 9.115** | **100,0%** |

---

## 5. ANALISIS BUNDLING & PROFITABILITAS MENU PAKET (COMBO)

Menu paket merupakan generator volume transaksi terbesar di outlet (mencapai >40% dari total order). Berikut rincian HPP paket komposit dan strategi marginnya:

```
                            ANALISIS PAKET COMBO
```

### 5.1 Shawarma Duo Combo (Best Seller Volume #1)
* **Komposisi:** 1 Porsi Shawarma Ayam Sedang + 1 Porsi Shawarma Sapi Sedang
* **Kalkulasi HPP:** `Rp 14.051 + Rp 16.391 = Rp 30.442`
* **Harga Jual POS:** `Rp 42.000` $\rightarrow$ **Gross Profit POS:** `Rp 11.558 (27,5%)`
* **Harga Jual Online:** `Rp 52.000` $\rightarrow$ **Gross Profit Online:** `Rp 21.558 (41,5%)`
* **Insight Bisnis:** Diskon bundling offline Rp 6.000 dari harga satuan (Rp 24rb + Rp 24rb = Rp 48rb) mendorong basket size pelanggan dengan tetap mempertahankan margin kotor sehat di 27,5%.

---

### 5.2 Shawarma Triple Combo (Paket Keluarga)
* **Komposisi:** 1x Ayam Sedang + 1x Sapi Sedang + 1x Mix Besar
* **Kalkulasi HPP:** `Rp 14.051 + Rp 16.391 + Rp 20.480 = Rp 50.922`
* **Harga Jual POS:** `Rp 68.000` $\rightarrow$ **Gross Profit POS:** `Rp 17.078 (25,1%)`
* **Harga Jual Online:** `Rp 82.000` $\rightarrow$ **Gross Profit Online:** `Rp 31.078 (37,9%)`
* **Insight Bisnis:** Memberikan profit nominal terbesar per transaksi (`Rp 17.078` di kasir, `Rp 31.078` di online).

---

### 5.3 Mix Cheese Combo
* **Komposisi:** 1x Shawarma Mix Besar + 1x Suka Chicken + 1x Suka Drink
* **Kalkulasi HPP:** `Rp 20.480 + Rp 16.932 + Rp 4.793 = Rp 42.205`
* **Harga Jual POS:** `Rp 60.000` $\rightarrow$ **Gross Profit POS:** `Rp 17.795 (29,7%)`
* **Harga Jual Online:** `Rp 72.000` $\rightarrow$ **Gross Profit Online:** `Rp 29.795 (41,4%)`

---

### 5.4 Best Seller 2 (Up Size Sapi Jumbo + Drink)
* **Komposisi:** 1x Shawarma Sapi Jumbo + 1x Suka Drink (Ice Tea / Orange Jus)
* **Kalkulasi HPP:** `Rp 23.793 + Rp 4.793 = Rp 28.586`
* **Harga Jual POS:** `Rp 45.000` $\rightarrow$ **Gross Profit POS:** `Rp 16.414 (36,5%)`
* **Harga Jual Online:** `Rp 52.000` $\rightarrow$ **Gross Profit Online:** `Rp 23.414 (45,0%)`

---

## 6. ANALISIS WASTE, SHRINKAGE & FAKTOR SUSUT MASAK

Agar perhitungan HPP di atas tidak mengalami deviasi di lapangan (antara angka teoritis sistem vs fisik aktual), tim operasional wajib mengontrol 3 titik kritis susut (*shrinkage*):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        3 TITIK RAWAN SUSUT (WASTE)                     │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Thawing / Drip Loss         │ Susut cair es pada daging beku saat   │
│    (Defrost Daging)            │ proses thawing (5% - 10%).            │
├────────────────────────────────┼───────────────────────────────────────┤
│ 2. Cooking Shrinkage           │ Penguapan air & lelehan lemak saat    │
│    (Susut Masak Griddle)       │ daging dipanggang (Ayam 15-20%,       │
│                                │ Sapi 20-30%).                         │
├────────────────────────────────┼───────────────────────────────────────┤
│ 3. Transfer Loss               │ Sisa saus & mayo menempel di dinding  │
│    (Sisa Kemasan/Pouch)        │ pouch/kompan (2% - 5%).               │
└────────────────────────────────┴───────────────────────────────────────┘
```

### Rekomendasi Operasional untuk Menjaga HPP:
1. **Standar Penimbangan:** Pastikan penimbangan porsi daging di kitchen konsisten (apakah ditimbang dalam kondisi **mentah beku** atau **mentah cair / thawed**). Resep BOM sistem saat ini menggunakan acuan gramasi mentah beku.
2. **FIFO & Defrost Bertahap:** Pindahkan daging dan tortilla dari freezer ke chiller 12 jam sebelum pemakaian untuk meminimalkan robekan kulit dan drip loss daging.
3. **Opname Harian Wajib:** Sesuai kebijakan ADR-011, setiap outlet wajib input Stock Opname Harian di aplikasi POS kasir setiap tutup toko (closing). Sistem akan otomatis menghitung selisih HPP Aktual vs HPP Teoritis.

---

## 7. PROSEDUR PEMELIHARAAN HARGA (SOP UPDATE HPP)

Jika terjadi fluktuasi atau kenaikan harga beli bahan baku dari supplier:
1. **Admin / Finance** memperbarui harga beli di modul **Master Harga Bahan Baku** (`bahan_baku_harga`).
2. Saat Surat Jalan baru diterbitkan ke outlet, sistem akan men-snapshot harga terbaru tersebut.
3. Nilai HPP Harian outlet akan otomatis mengikuti harga snapshot terkini tanpa merusak riwayat HPP transaksi masa lalu (ADR-011 compliance).
4. Jika margin menu tertentu turun di bawah target (misal <28%), Manajemen dapat mempertimbangkan penyesuaian harga jual atau negosiasi ulang ke supplier.

---

*Dokumen ini merupakan standar resmi pembiayaan dan perhitungan HPP Suka Shawarma.*  
*Disahkan untuk penggunaan operasional seluruh cabang dan mitra franchise.*
