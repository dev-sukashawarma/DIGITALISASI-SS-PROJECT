# MASTER DOKUMEN: SATUAN PO VENDOR, DISTRIBUSI OUTLET & BOM RESEP

**Suka Shawarma Indonesia — Sistem Manajemen Rantai Pasok (Supply Chain & Inventory)**

* **Tanggal Ditetapkan:** 8 September 2026
* **Status:** Berlaku Aktif (Single Source of Truth)
* **Dasar Keputusan:** Catatan Riil Beli Vendor (PO), Surat Jalan Distribusi Operasional, & Standardisasi BOM Menu POS
* **Migrasi Database Terkait:**
  - `20260908151500_update_satuan_distribusi_master.sql`
  - `20260908155000_update_satuan_master_dan_po.sql`

---

## 1. Arsitektur & Prinsip Hierarki Satuan 4-Tingkat

Untuk menjamin keakuratan biaya (HPP), kelancaran pengadaan, dan kemudahan pencatatan di lapangan, sistem menerapkan rantai satuan yang terintegrasi:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TINGKAT 1: PURCHASING / PO VENDOR (satuan_po)                           │
│ Satuan transaksi beli ke supplier (cth: Dus, Bal, Roll, Kompan, Pack)    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ (Penyimpanan Gudang / Base Master)
┌────────────────────────────────────▼────────────────────────────────────┐
│ TINGKAT 2: DISTRIBUSI KE OUTLET (satuan_distribusi)                     │
│ Satuan fisik pengiriman via Surat Jalan (cth: kg, pack, roll, box)      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ (Konversi otomatis getDistribusiFactor)
┌────────────────────────────────────▼────────────────────────────────────┐
│ TINGKAT 3: OPERASIONAL OUTLET (satuan_kecil & faktor_tampilan)          │
│ Satuan terkecil untuk stok balance & opname harian (Gram, Pcs, Lembar)  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ (Pemotongan otomatis saat menu terjual)
┌────────────────────────────────────▼────────────────────────────────────┐
│ TINGKAT 4: BOM RESEP MENU POS (resep_item.satuan)                       │
│ Satuan porsi saji per menu (cth: 100 gram ayam, 35 cm foil, 1 pcs mie)  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Aturan Konversi Otomatis Sistem
1. **Gudang Pusat ⭢ Outlet (Surat Jalan):**
   Pengiriman dicatat dalam unit `satuan_distribusi`. Saat outlet melakukan verifikasi penerimaan di modul Distribusi:
   $$\text{qty\_base} = \frac{\text{qty\_distribusi}}{\text{getDistribusiFactor()}}$$
2. **Outlet ⭢ Saldo Riil (Stok Balance):**
   Saldo persediaan di outlet (`stok_balance`) **selalu disimpan dalam `satuan_kecil`** (skala terkecil: gram, ml, lembar, pcs, cm):
   $$\text{saldo\_stok} = \text{qty\_base} \times \text{faktor\_tampilan}$$
3. **BOM Resep Menu (POS Kasir):**
   Pemotongan otomatis saat menu terjual menggunakan **`satuan_bom`** (misal: 35 cm foil, 1 lembar wrapper, 40 gram saus), sehingga akurasi pemakaian bahan baku tidak terpengaruh oleh ukuran kemasan pembelian besar.

---

## 2. Katalog Lengkap Satuan Master (52 Bahan Baku Aktif)

### A. Kategori Food & Beverage (23 Bahan)

| Nama Bahan | Satuan PO Vendor | Satuan Master (`satuan`) | Satuan Tengah (Faktor) | Satuan Distribusi Outlet | Satuan BOM (Resep Menu) | Satuan Opname Terkecil (Faktor) | Rasio Konversi Dist (`factor`) | Harga Master Beli |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **AYAM** | `kg` | `Kg` | - | `kg` | **`gram`** | `Gram (1000)` | `1` (1:1 (satuan besar)) | Rp 53.500 / Kg |
| **BAWANG PUTIH BUBUK** | `dus` | `Dus` | `Bungkus (6)` | `bungkus` | **`sachet (batch/CK)`** | `Sachet (432)` | `6` (Faktor Tengah (x6)) | Rp 90.000 / Dus |
| **ES BATU** | `bal` | `Bal` | `Kg (20)` | `bal` | **`pcs`** | `Gram (20000)` | `1` (1:1 (satuan besar)) | Rp 30.000 / Bal |
| **GAS 3Kg** | `tabung` | `tabung` | - | `tabung` | **`gram`** | `gram (3000)` | `1` (1:1 (satuan besar)) | Rp 22.000 / tabung |
| **KEJU** | `dus` | `Dus` | `Pack (24)` | `pack` | **`lembar`** | `Lembar (240)` | `24` (Faktor Tengah (x24)) | Rp 289.056 / Dus |
| **KENTANG** | `dus` | `Dus` | `Kg (10)` | `kg` | **`gram`** | `Gram (10000)` | `10` (Faktor Tengah (x10)) | Rp 250.000 / Dus |
| **KULIT 25** | `pack` | `Pack` | - | `pack` | **`lembar`** | `Lembar (20)` | `1` (1:1 (satuan besar)) | Rp 27.000 / Pack |
| **KULIT 28** | `pack` | `Pack` | - | `pack` | **`lembar`** | `Lembar (20)` | `1` (1:1 (satuan besar)) | Rp 32.000 / Pack |
| **KULIT 32** | `pack` | `Pack` | - | `pack` | **`lembar`** | `Lembar (20)` | `1` (1:1 (satuan besar)) | Rp 38.000 / Pack |
| **MAYONAISE** | `dus` | `Dus` | `Kg (12)` | `kg` | **`gram`** | `Gram (12000)` | `12` (Faktor Tengah (x12)) | Rp 248.004 / Dus |
| **MIE** | `bungkus` | `Dus` | - | `bungkus` | **`pcs`** | `Bungkus (40)` | `40` (Faktor Tampilan (x40)) | Rp 120.000 / Dus |
| **MINYAK** | `kompan` | `kompan` | `Kg (16)` | `kompan` | **`gram`** | `Gram (16000)` | `1` (1:1 (satuan besar)) | Rp 376.000 / kompan |
| **POWDER JERUK** | `kg` | `Kg` | - | `kg` | **`gram`** | `Gram (1000)` | `1` (1:1 (satuan besar)) | Rp 48.474 / Kg |
| **POWDER TEH** | `kg` | `Kg` | - | `kg` | **`gram`** | `Gram (1000)` | `1` (1:1 (satuan besar)) | Rp 53.950 / Kg |
| **SAOS CABE** | `dus` | `Dus` | `Kompan (3)` | `kg` | **`gram`** | `Gram (16500)` | `16.5` (Gram ke Kg (x16.5)) | Rp 244.002 / Dus |
| **SAOS CABE POUCH** | `dus` | `Dus` | `Kg (12)` | `kg` | **`gram (batch/CK)`** | `Gram (12000)` | `12` (Faktor Tengah (x12)) | Rp 170.148 / Dus |
| **SAOS SAMYANG** | `dus` | `Dus` | `Kg (5)` | `kg` | **`gram`** | `Gram (5000)` | `5` (Faktor Tengah (x5)) | Rp 280.000 / Dus |
| **SAOS TOMAT KOMPAN** | `dus` | `Dus` | `Kompan (3)` | `kg` | **`gram (batch/CK)`** | `Gram (16500)` | `16.5` (Gram ke Kg (x16.5)) | Rp 187.677 / Dus |
| **SAOS TOMAT POUCH** | `dus` | `Dus` | `Kg (12)` | `kg` | **`gram`** | `Gram (12000)` | `12` (Faktor Tengah (x12)) | Rp 141.000 / Dus |
| **SAPI** | `blok` | `Blok` | `Kg (2)` | `blok` | **`gram`** | `Gram (2000)` | `1` (1:1 (satuan besar)) | Rp 103.000 / Blok |
| **Sayur (lettuce)** | `kg` | `kg` | - | `kg` | **`gram`** | `gram (1000)` | `1` (1:1 (satuan besar)) | Rp 22.000 / kg |
| **TEPUNG** | `kg` | `Kg` | - | `kg` | **`gram`** | `Gram (1000)` | `1` (1:1 (satuan besar)) | Rp 18.000 / Kg |
| **TUM** | `kg` | `Kg` | - | `kg` | **`gram`** | `Gram (1000)` | `1` (1:1 (satuan besar)) | Rp 100.000 / Kg |


### B. Kategori Bumbu & Rempah (9 Bahan)

| Nama Bahan | Satuan PO Vendor | Satuan Master (`satuan`) | Satuan Tengah (Faktor) | Satuan Distribusi Outlet | Satuan BOM (Resep Menu) | Satuan Opname Terkecil (Faktor) | Rasio Konversi Dist (`factor`) | Harga Master Beli |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **BAWANG** | `bal` | `Bal` | `Kg (20)` | `kg` | **`gram (batch/CK)`** | `Gram (20000)` | `20` (Faktor Tengah (x20)) | Rp 650.000 / Bal |
| **CENGKEH** | `kg` | `kg` | - | `kg` | **`gram (batch/CK)`** | `gram (1000)` | `1` (1:1 (satuan besar)) | Rp 165.000 / kg |
| **GARAM** | `bal` | `Bal` | `Pack (20)` | `pack` | **`gram (batch/CK)`** | `Gram (5000)` | `20` (Faktor Tengah (x20)) | Rp 90.000 / Bal |
| **JINTEN** | `kg` | `Kg` | - | `kg` | **`gram (batch/CK)`** | `gram (1000)` | `1` (1:1 (satuan besar)) | Rp 75.000 / Kg |
| **KAYU MANIS** | `kg` | `kg` | - | `kg` | **`gram (batch/CK)`** | `gram (1000)` | `1` (1:1 (satuan besar)) | Rp 90.000 / kg |
| **KETUMBAR** | `bal` | `Bal` | `Kg (25)` | `kg` | **`gram (batch/CK)`** | `gram (25000)` | `25` (Faktor Tengah (x25)) | Rp 812.500 / Bal |
| **KUNYIT** | `dus` | `Dus` | `Pack (18)` | `pack` | **`sachet (batch/CK)`** | `Sachet (432)` | `18` (Faktor Tengah (x18)) | Rp 395.000 / Dus |
| **MERICA** | `kg` | `Kg` | - | `kg` | **`gram (batch/CK)`** | `Gram (1000)` | `1` (1:1 (satuan besar)) | Rp 195.000 / Kg |
| **SASA** | `pack` | `Pack` | - | `pack` | **`gram (batch/CK)`** | `Gram (1000)` | `1` (1:1 (satuan besar)) | Rp 51.000 / Pack |


### C. Kategori Packaging & Kemasan (11 Bahan)

| Nama Bahan | Satuan PO Vendor | Satuan Master (`satuan`) | Satuan Tengah (Faktor) | Satuan Distribusi Outlet | Satuan BOM (Resep Menu) | Satuan Opname Terkecil (Faktor) | Rasio Konversi Dist (`factor`) | Harga Master Beli |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **CUP** | `pack` | `Pack` | - | `pcs` | **`pcs`** | `Pcs (25)` | `25` (Faktor Tampilan (x25)) | Rp 42.800 / Pack |
| **DUS PACKING** | `pack` | `Pack` | - | `pack` | **`- (non-menu)`** | `Pcs (250)` | `1` (1:1 (satuan besar)) | Rp 271.250 / Pack |
| **FOIL** | `roll` | `Dus` | `Roll (48)` | `roll` | **`cm`** | `cm (36480)` | `48` (Faktor Tengah (x48)) | Rp 421.977,6 / Dus |
| **PAPER WRAP** | `pack` | `Pack` | - | `pack` | **`lembar`** | `Lembar (500)` | `1` (1:1 (satuan besar)) | Rp 92.500 / Pack |
| **PLASTIK 24** | `pack` | `Pack` | - | `pack` | **`- (non-menu)`** | `-` | `1` (1:1 (satuan besar)) | Rp 13.000 / Pack |
| **PLASTIK BESAR** | `pack` | `Ikat` | `Pack (5)` | `pack` | **`- (non-menu)`** | `Lembar (250)` | `5` (Faktor Tengah (x5)) | Rp 6.000 / Ikat |
| **PLASTIK KECIL** | `pack` | `Pack` | - | `pack` | **`- (non-menu)`** | `Pcs (100)` | `1` (1:1 (satuan besar)) | Rp 6.996 / Pack |
| **PLASTIK MERAH** | `pack` | `Pack` | - | `pack` | **`lembar`** | `Lembar (20)` | `1` (1:1 (satuan besar)) | Rp 18.000 / Pack |
| **PLASTIK SUKA DRINK** | `pack` | `Pack` | - | `pack` | **`- (non-menu)`** | `Lembar (200)` | `1` (1:1 (satuan besar)) | Rp 40.000 / Pack |
| **STIKER** | `lembar` | `Lembar` | - | `lembar` | **`lembar`** | `Pcs (70)` | `1` (1:1 (satuan besar)) | Rp 5.300 / Lembar |
| **TUTUP PACK** | `pack` | `Pack` | - | `pcs` | **`- (non-menu)`** | `Pcs (25)` | `25` (Faktor Tampilan (x25)) | Rp 89.000 / Pack |


### D. Kategori Operasional, Gas & Perlengkapan (9 Bahan)

| Nama Bahan | Satuan PO Vendor | Satuan Master (`satuan`) | Satuan Tengah (Faktor) | Satuan Distribusi Outlet | Satuan BOM (Resep Menu) | Satuan Opname Terkecil (Faktor) | Rasio Konversi Dist (`factor`) | Harga Master Beli |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **PRINTER THERMAL** | `unit` | `Unit` | - | `-` | **`- (non-menu)`** | `-` | `1` (1:1 (satuan besar)) | Rp 305.317 / Unit |
| **Cling Wrap** | `roll` | `Roll` | - | `roll` | **`- (non-menu)`** | `cm (300)` | `1` (1:1 (satuan besar)) | Rp 10.135 / Roll |
| **GALON AIR** | `galon` | `Galon` | `Liter (19)` | `galon` | **`- (non-menu)`** | `Ml (19000)` | `1` (1:1 (satuan besar)) | Rp 7.000 / Galon |
| **HAND GLOVE** | `dus` | `Dus` | `Box (75)` | `box` | **`- (non-menu)`** | `Lembar (7500)` | `75` (Faktor Tengah (x75)) | Rp 448.125 / Dus |
| **KERTAS STRUK** | `dus` | `Dus` | `Pack (10)` | `roll` | **`- (non-menu)`** | `Roll (100)` | `100` (Faktor Tampilan (x100)) | Rp 160.000 / Dus |
| **PLASTIK VACUM** | `pack` | `Pack` | - | `pack` | **`- (non-menu)`** | `Lembar (100)` | `1` (1:1 (satuan besar)) | Rp 44.000 / Pack |
| **PLASTIK VACUUM JUMBO** | `roll` | `Roll` | - | `roll` | **`- (non-menu)`** | `-` | `1` (1:1 (satuan besar)) | Rp 40.346 / Roll |
| **POLYBAG** | `pack` | `Pack` | - | `pack` | **`- (non-menu)`** | `Pcs (9)` | `1` (1:1 (satuan besar)) | Rp 24.000 / Pack |
| **ID CARD** | `pcs` | `Pcs` | - | `-` | **`- (non-menu)`** | `-` | `1` (1:1 (satuan besar)) | Rp 2.571 / Pcs |


---

## 3. Matriks Khusus & Penanganan Operasional

### 1. Foil & Cling Wrap (Standar Panjang Sentimeter)
* **Foil:** 
  - Satuan PO: **`roll`** (satuan master: Dus isi 48 Roll).
  - Distribusi: **`roll`**.
  - Satuan BOM Resep: **`cm`** (35 cm s.d. 50 cm per porsi shawarma).
* **Cling Wrap:** 
  - Satuan PO: **`roll`** (satuan master: Roll isi 30 cm x 3 meter = 300 cm).
  - Distribusi: **`roll`**.
  - Satuan BOM: **`- (non-menu / operasional wrap kitchen)`**.

### 2. Hand Glove & Kertas Struk (Kemasan Bertingkat Dus ⭢ Box/Pack ⭢ Satuan Terkecil)
* **Hand Glove:** 
  - Dibeli dari vendor per **`Dus`** (1 Dus = 75 Box @ 100 lembar = 7.500 lembar sarung tangan).
  - Outlet dikirim per **`box`** (1 Box = 100 lembar).
  - Konversi sistem: Faktor Tengah = 75.
  - Satuan BOM: **`- (non-menu / operasional kitchen)`**.
* **Kertas Struk:** 
  - Dibeli dari vendor per **`Dus`** (1 Dus = 10 Pack @ 10 roll = 100 roll kertas).
  - Outlet dikirim per **`roll`**.
  - Konversi sistem: Faktor Tampilan = 100.
  - Satuan BOM: **`- (non-menu / operasional kasir POS)`**.

### 3. Plastik & Paper Wrap (Kini Standar Satuan Master & PO = Pack)
* **Plastik Kecil:** 1 Pack = 100 Pcs (Satuan PO: Pack, Distribusi: Pack).
* **Plastik Merah:** 1 Pack = 20 Lembar (Satuan PO: Pack, Distribusi: Pack, Satuan BOM: 1 Lembar).
* **Plastik Suka Drink:** 1 Pack = 200 Lembar (Satuan PO: Pack, Distribusi: Pack).
* **Plastik Vacum:** 1 Pack = 100 Lembar (Satuan PO: Pack, Distribusi: Pack).
* **Paper Wrap:** 1 Pack = 500 Lembar (Satuan PO: Pack, Distribusi: Pack, Satuan BOM: 1 Lembar).

### 4. Bumbu Curah Bal (Karung) & Resep Olahan Batch
* **Ketumbar:** 1 Bal = 25 Kg. Vendor PO per `bal`, outlet menerima per `kg`, pemakaian racikan per `gram`.
* **Bawang:** 1 Bal = 20 Kg. Vendor PO per `bal`, outlet menerima per `kg`, pemakaian racikan per `gram`.
* **Garam:** 1 Bal = 20 Pack. Vendor PO per `bal`, outlet menerima per `pack`, pemakaian racikan per `gram`.

### 5. Galon Air
* **Galon Air:** Satuan master & PO resmi **`Galon`** (isi 19 Liter / 19.000 ml). Distribusi ke outlet dalam satuan **`galon`**.

---

## 4. Panduan Teknis & Implementasi Antar Aplikasi

| Aplikasi | File / Modul | Peran Terhadap Satuan |
|---|---|---|
| **admin-dashboard** | `apps/admin-dashboard/src/hooks/usePurchaseOrder.ts` | Menggunakan `satuan_po` sebagai unit default saat membuat PO ke supplier |
| **distribusi** | `apps/distribusi/src/components/distribusi/SuratJalanForm.tsx` | Menggunakan `satuan_distribusi` untuk input qty kirim |
| **distribusi** | `apps/distribusi/src/components/distribusi/VerifikasiForm.tsx` | Menggunakan `satuan_distribusi` untuk verifikasi terima fisik outlet |
| **distribusi** | `apps/distribusi/src/utils/generateSuratJalanExcel.ts` | Mencetak dokumen Surat Jalan fisik & Excel dalam unit `satuan_distribusi` |
| **pos-kasir** | `resep_item` & Trigger BOM POS | Memotong stok outlet otomatis berdasarkan `satuan_bom` saat transaksi penjualan selesai |
| **stok** | `apps/stok/src/lib/format/compositeUnit.ts` | Logika fungsi `getDistribusiFactor()` dan formatter display komposit multi-tier |
| **stok** | `apps/stok/src/hooks/useOpname.ts` | Melakukan opname harian dalam unit distribusi & konversi ke `satuan_kecil` |

---

## 5. Riwayat Perubahan Dokumen (Changelog)

| Tanggal | Versi | Pembaruan | Otorisasi |
|---|:---:|---|:---:|
| **08-09-2026** | **v1.1** | Penambahan kolom **Satuan BOM (Resep Menu)** untuk melengkapi rantai 4-tingkat satuan (PO ⭢ Distribusi ⭢ Opname ⭢ BOM). | Owner & Lead Dev |
| **08-09-2026** | **v1.0** | Rilis perdana Master Dokumen Satuan PO & Distribusi berdasarkan keputusan owner & catatan fisik 8 September 2026. Penambahan kolom `satuan_po` dan standardisasi 52 bahan baku aktif. | Owner & Lead Dev |
