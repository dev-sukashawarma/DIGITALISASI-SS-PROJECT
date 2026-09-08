# 📋 BERITA ACARA & LEMBAR KONFIRMASI AUDIT OPERASIONAL
### REKONSILIASI TRANSAKSI FOODAPPS (GOFOOD, GRABFOOD, SHOPEEFOOD) vs POS KASIR
**PT SUKA SHAWARMA INDONESIA**

---

* **Nomor Dokumen** : `BA-AUDIT/SSI-OPS/2026/09/001`
* **Tanggal Terbit** : Sabtu, 5 September 2026
* **Periode Data Transaksi**: Selasa, 1 September 2026 (00:00 - 23:59 WIB)
* **Ditujukan Kepada** : 
  1. **Sdr. Abu Bakar** — Area Manager Wilayah 1 (Bogor Kota, Dramaga, Empang, Sentul, Pajajaran)
  2. **Sdr. Tri Rizky** — Area Manager Wilayah 2 (Jakarta, Cimanggu, Kalisari, Cirendeu, Jagakarsa)
  3. **Tim Leader & Kepala Kasir Seluruh Cabang Terkait**
* **Diterbitkan Oleh** : Tim Internal Audit & Rekonsiliasi Sistem Digital SSI

---

## 📌 RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)

Berdasarkan hasil audit forensik rekonsiliasi data penjualan platform online delivery (*GoFood, GrabFood, ShopeeFood, TikTok*) terhadap pencatatan sistem POS Kasir pada tanggal **1 September 2026**, berikut ringkasan status operasional dan finansial:

1. **Penerimaan Dana Rekening Bank / Merchant Settlement**: **100% AMAN**. Seluruh dana penjualan platform online tetap ditransfer penuh oleh pihak Gojek, Grab, dan Shopee ke rekening PT Suka Shawarma Indonesia sesuai pesanan riil aplikasi.
2. **Penyimpangan Operasional Kasir di Lapangan**:
   * **Klaster 3 — Void Resmi Disetujui AM**: 3 transaksi (Rp 217.000) ➔ *Terkonfirmasi Sah & Sesuai SOP*.
   * **Klaster 4 — Selisih Nominal / Varian Menu**: 8 transaksi (Net: -Rp 82.000) ➔ *Kelalaian input manual & rapel closing kasir*.
   * **Klaster 2 — Salah Cabang Input**: 1 transaksi (Rp 51.000) ➔ *Telah di-void di POS Cibubur (order milik Pajajaran)*.
   * **Klaster 5 — RED FLAG: Pesanan Riil Belum Diinput Kasir**: 8 transaksi (**Rp 549.000**) ➔ *Wajib investigasi fisik bahan baku*.
3. **⚠️ TEMUAN SISTEM KRITIS — Price Tier Leakage (Update v2 per 5 September 2026)**:
   Cross-check mendalam antara scraping data platform, inputan POS, dan referensi `menu_items.channel_prices` di database menemukan bahwa pada **3 dari 8 transaksi Klaster 4**, kasir memasukkan pesanan online dengan menggunakan **harga tier offline/dine-in** (bukan harga foodapps), akibat sistem POS tidak mengunci channel price secara otomatis:
   * Cibubur ShopeeFood `POS#43` (Dika): Mix Jumbo 47k + Keju 7k = **Rp 54.000** *(Harga ShopeeFood: 57k + 9k = 66k)* → bocor **-Rp 12.000**
   * Cirendeu ShopeeFood `POS#24` (Tegar): Sapi Besar 32k + Mix Besar 37k = **Rp 69.000** *(Harga ShopeeFood: 39k + 45k = 84k)* → bocor **-Rp 15.000** *(sudah termasuk salah varian)*
   * Cirendeu GrabFood `POS#15` (Tegar): Mix Besar **Rp 37.000** *(Menu BENAR, bukan salah porsi; harga GrabFood: Rp 45.000)* → bocor **-Rp 8.000**

   **Rekomendasi**: Tim Pengembangan POS wajib menutup celah ini agar `order_items.channel` secara otomatis mengikuti `orders.channel` dan unit_price terkunci ke `channel_prices` saat transaksi online dibuka.

---


## 🟣 BAGIAN I: KONFIRMASI TRANSAKSI VOID RESMI OLEH AREA MANAGER (KLASTER 3)
*Status: Otorisasi sah oleh AM terbukti dari re-input data berurutan.*

| No | Cabang | No. POS | Nilai (Rp) | Kasir Bertugas | Waktu Input | Otorisator (AM) | Kronologi & Bukti Re-Input |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **Dramaga** | `POS#62` | 57.000 | Zaki | 21:36 WIB | **Abu Bakar** | Kasir salah pilih channel **ShopeeFood** an. `kherina` (1x Original Mix Jumbo). Pada 21:40 WIB kasir menginput ulang yang benar sebagai `POS#63` an. **`F-kharina` (GoFood)**. POS#62 dibatalkan sah. |
| **2** | **Empang** | `POS#18` | 82.000 | Abdurrohman | 16:43 WIB | **Abu Bakar** | Kasir salah memilih channel ShopeeFood saat menginput pesanan **GrabFood** `#220` an. `Sumaryo` (2x Original Ayam Jumbo). Pesanan riil sudah terinput dan match di POS GrabFood. |
| **3** | **Kalisari** | `POS#6` | 78.000 | Cikal | 17:11 WIB | **Tri Rizky** | Kasir salah klik porsi an. `intan` (2x Sapi Besar). Selang **45 detik** (17:12 WIB), kasir menginput pesanan yang benar di `POS#7` (Rp 64.000). POS#6 dibatalkan sah. |

* **Kesimpulan Audit**: Seluruh pembatalan di atas **100% Sah (Approved)** dan tidak menimbulkan kerugian finansial.

---

## 🟠 BAGIAN II: BEDAH LENGKAP RINCIAN ITEM SELISIH NOMINAL & VARIAN MENU (KLASTER 4)
*Status: Rincian item-per-item per transaksi antara pesanan aplikasi vs inputan kasir di POS.*

---

### 1. CABANG JAGAKARSA — SHOPEEFOOD (`3242399694931456272`)
* **Kasir Bertugas**: Maulana Hairulloh | **No. POS**: `POS#30` (21:04:03 WIB)
* **Nominal**: Platform **Rp 224.000** vs POS **Rp 226.000** | **Selisih**: **+Rp 2.000** *(POS lebih tinggi)*
* **Customer Name di POS**: `3242399694931456272` *(Order ID Sama Persis / Exact Match)*

| Rincian Menu di Aplikasi ShopeeFood | Qty | Harga Satuan | Subtotal App | Rincian Menu yang Diinput Kasir di POS | Qty | Harga Satuan | Subtotal POS |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| SUKA Shawarma Original Mix Jumbo - King Size | 3 | Rp 57.000 | Rp 171.000 | Original Sapi Sedang | 4 | Rp 33.000 | Rp 132.000 |
| SUKA Shawarma Original Shawarma Sapi Jumbo | 1 | Rp 53.000 | Rp 53.000 | Original Sapi Besar | 1 | Rp 39.000 | Rp 39.000 |
| *(Komisi Platform: Rp 55.864, Net Bank: Rp 168.136)* | - | - | - | Extra Kentang | 5 | Rp 11.000 | Rp 55.000 |
| **TOTAL APLIKASI PLATFORM** | **4** | | **Rp 224.000** | **TOTAL INPUTAN POS KASIR** | **10** | | **Rp 226.000** |

> 🔍 **Diagnosa Forensik**: Kasir Maulana tidak memilih menu paket Jumbo di sistem POS, melainkan memecah pesanan secara manual menjadi: 4 Sapi Sedang + 1 Sapi Besar + 5 Extra Kentang. Kalkulasi manual kasir menghasilkan total Rp 226.000 (+Rp 2.000 dari tagihan aplikasi).

---

### 2. CABANG KOTA WISATA CIBUBUR — SHOPEEFOOD (`3242397389768192858`)
* **Kasir Bertugas**: Dika | **No. POS**: `POS#40` (22:56:12 WIB - Rapel Closing)
* **Nominal**: Platform **Rp 124.000** vs POS **Rp 62.000** | **Selisih**: **-Rp 62.000** *(POS kurang catat)*
* **Customer Name & External ID di POS**: `3242397389768192858` *(Order ID Sama Persis / Exact Match)*

| Rincian Menu di Aplikasi ShopeeFood | Qty | Harga Satuan | Subtotal App | Rincian Menu yang Diinput Kasir di POS | Qty | Harga Satuan | Subtotal POS |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| SUKA Shawarma Original Mix Jumbo - King Size | 2 | Rp 57.000 | Rp 114.000 | Original Ayam Sedang | 1 | Rp 29.000 | Rp 29.000 |
| Topping Extra Keju / Mozzarella | 1 | Rp 10.000 | Rp 10.000 | Original Sapi Sedang | 1 | Rp 33.000 | Rp 33.000 |
| **TOTAL APLIKASI PLATFORM** | **3** | | **Rp 124.000** | **TOTAL INPUTAN POS KASIR** | **2** | | **Rp 62.000** |

> 🔍 **Diagnosa Forensik**: Kasir Dika merapel input saat closing toko (22:56 WIB). Kasir mengalami kelalaian: pesanan pelanggan adalah 2 porsi Mix Jumbo + Topping (Rp 124k), namun kasir hanya menginput 1 pasang porsi Sedang (Rp 62k), mengakibatkan omzet POS tercatat kurang Rp 62.000. Uang ShopeeFood tetap cair penuh Rp 124.000.

---

### 3. CABANG KOTA WISATA CIBUBUR — SHOPEEFOOD (`3242377052505600012`)
* **Kasir Bertugas**: Dika | **No. POS**: `POS#43` (22:57:45 WIB - Rapel Closing)
* **Nominal**: Platform **Rp 66.000** vs POS **Rp 54.000** | **Selisih**: **-Rp 12.000** *(POS kurang catat)*
* **Customer Name & External ID di POS**: `3242377052505600012` *(Order ID Sama Persis / Exact Match)*

| Rincian Menu di Aplikasi ShopeeFood | Qty | Harga Satuan | Subtotal App | Rincian Menu yang Diinput Kasir di POS | Qty | Harga Satuan | Subtotal POS |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| SUKA Shawarma Original Sapi Sedang - Porsi Mantap | 2 | Rp 33.000 | Rp 66.000 | Original Mix Jumbo | 1 | **Rp 47.000** | Rp 47.000 |
| - | - | - | - | Extra Keju | 1 | **Rp 7.000** | Rp 7.000 |
| **TOTAL APLIKASI PLATFORM** | **2** | | **Rp 66.000** | **TOTAL INPUTAN POS KASIR** | **2** | | **Rp 54.000** |

> 🔍 **Diagnosa Forensik (Update v2 — Hasil Cross-Check Harga Database)**:
> Ditemukan **2 (dua) masalah berlapis** pada transaksi ini:
> 1. **Salah Pilih Menu**: Kasir Dika menginput `Original Mix Jumbo + Extra Keju` padahal pesanan adalah `2x Sapi Sedang`.
> 2. **⚠️ Price Tier Leakage**: Unit price yang terinput di database (`order_items.unit_price`) adalah:
>    - Mix Jumbo = **Rp 47.000** = **Harga Base OFFLINE** (bukan Harga ShopeeFood Rp 57.000)
>    - Extra Keju = **Rp 7.000** = **Harga Base OFFLINE** (bukan Harga ShopeeFood Rp 9.000)
>    - Total Harga Offline: Rp 47.000 + Rp 7.000 = **Rp 54.000** (persis nilai POS yang terinput)
>
> Sistem POS mencatat `order_items.channel = 'offline'` meski `orders.channel = 'shopeefood'`, menunjukkan kasir menarik katalog harga Dine-In/Offline saat menginput transaksi online. Kerugian markup foodapps: **-Rp 12.000** (Rp 10.000 markup Mix Jumbo + Rp 2.000 markup Keju).


---

### 4. CABANG CIRENDEU — SHOPEEFOOD (`3242421301939200756`)
* **Kasir Bertugas**: Tegar | **No. POS**: `POS#24` (21:58:10 WIB - Rapel Closing)
* **Nominal**: Platform **Rp 84.000** vs POS **Rp 69.000** | **Selisih**: **-Rp 15.000** *(POS kurang catat)*
* **External ID di POS**: `3242421301939200756` *(Order ID Sama Persis, Cust Name: `alvin`)*

| Rincian Menu di Aplikasi ShopeeFood | Qty | Harga Satuan | Subtotal App | Rincian Menu yang Diinput Kasir di POS | Qty | Harga Satuan | Subtotal POS |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| SUKA Shawarma Original Shawarma Sapi Jumbo | 1 | Rp 51.000 | Rp 51.000 | Original Sapi Besar | 1 | **Rp 32.000** | Rp 32.000 |
| SUKA Shawarma Original Sapi Sedang - Porsi Mantap | 1 | Rp 33.000 | Rp 33.000 | Original Mix Besar | 1 | **Rp 37.000** | Rp 37.000 |
| **TOTAL APLIKASI PLATFORM** | **2** | | **Rp 84.000** | **TOTAL INPUTAN POS KASIR** | **2** | | **Rp 69.000** |

> 🔍 **Diagnosa Forensik (Update v2 — Hasil Cross-Check Harga Database)**:
> Ditemukan **2 (dua) masalah berlapis** pada transaksi ini:
> 1. **Salah Pilih Menu & Varian**: Kasir Tegar menginput `Sapi Besar + Mix Besar` padahal pesanan adalah `Sapi Jumbo + Sapi Sedang`. Ada perbedaan jenis menu (Jumbo → Besar, dan beda daging Mix vs Sapi).
> 2. **⚠️ Price Tier Leakage**: Unit price yang terinput di database (`order_items.unit_price`) adalah:
>    - Sapi Besar = **Rp 32.000** = **Harga Base OFFLINE** (bukan Harga ShopeeFood Rp 39.000)
>    - Mix Besar = **Rp 37.000** = **Harga Base OFFLINE** (bukan Harga ShopeeFood Rp 45.000)
>    - Total Harga Offline: Rp 32.000 + Rp 37.000 = **Rp 69.000** (persis nilai POS yang terinput)
>
> Sistem POS mencatat `order_items.channel = 'offline'` meski `orders.channel = 'shopeefood'`, menunjukkan kasir menarik katalog harga Dine-In/Offline saat menginput transaksi online. Total selisih -Rp 15.000 gabungan dari kesalahan varian + penggunaan harga offline.


---

### 5. CABANG BNR (KITCHEN) — SHOPEEFOOD (`3242088798225921005`)
* **Kasir Bertugas**: Ading | **No. POS**: `POS#1` (15:09:41 WIB)
* **Nominal**: Platform **Rp 735.000** vs POS **Rp 747.000** | **Selisih**: **+Rp 12.000** *(POS lebih tinggi)*
* **Customer Name di POS**: `s 34` *(Kode antrean tiket Shopee Kitchen #34, pesanan partai besar)*

| Rincian Menu di Aplikasi ShopeeFood | Qty | Harga Satuan | Subtotal App | Rincian Menu yang Diinput Kasir di POS | Qty | Harga Satuan | Subtotal POS |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| SUKA Shawarma Original Mix Jumbo - King Size | 12 | Rp 57.000 | Rp 684.000 | Suka Beef | 4 | Rp 39.000 | Rp 156.000 |
| SUKA Shawarma Original Shawarma Sapi Jumbo | 1 | Rp 51.000 | Rp 51.000 | Original Ayam Jumbo | 2 | Rp 41.000 | Rp 82.000 |
| - | - | - | - | Original Ayam Sedang | 3 | Rp 29.000 | Rp 87.000 |
| - | - | - | - | Original Sapi Sedang | 4 | Rp 33.000 | Rp 132.000 |
| - | - | - | - | Suka Chicken | 1 | Rp 35.000 | Rp 35.000 |
| - | - | - | - | Original Sapi Jumbo | 5 | Rp 51.000 | Rp 255.000 |
| **TOTAL APLIKASI PLATFORM** | **13** | | **Rp 735.000** | **TOTAL INPUTAN POS KASIR** | **19** | | **Rp 747.000** |

> 🔍 **Diagnosa Forensik**: Pesanan partai besar (13 wrap ukuran Jumbo senilai Rp 735k). Kasir Ading menginput manual dengan memecah menu ke dalam 19 porsi satuan perkiraan di POS senilai Rp 747k, menimbulkan selisih pembukuan +Rp 12.000.

---

### 6. CABANG BNR (KITCHEN) — SHOPEEFOOD (`3242376109885440969`)
* **Kasir Bertugas**: Roni | **No. POS**: `POS#4` (18:20:10 WIB)
* **Nominal**: Platform **Rp 36.000** vs POS **Rp 44.000** | **Selisih**: **+Rp 8.000** *(POS lebih tinggi)*
* **External ID di POS**: `3242376109885440969` *(Order ID Sama Persis, Cust Name: `s 36`)*

| Rincian Menu di Aplikasi ShopeeFood | Qty | Harga Satuan | Subtotal App | Rincian Menu yang Diinput Kasir di POS | Qty | Harga Satuan | Subtotal POS |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| SUKA Shawarma Samyang Pedas | 1 | Rp 36.000 | Rp 36.000 | Original Sapi Sedang | 1 | Rp 33.000 | Rp 33.000 |
| - | - | - | - | Extra Kentang | 1 | Rp 11.000 | Rp 11.000 |
| **TOTAL APLIKASI PLATFORM** | **1** | | **Rp 36.000** | **TOTAL INPUTAN POS KASIR** | **2** | | **Rp 44.000** |

> 🔍 **Diagnosa Forensik**: Kasir Roni salah klik menu: Pesanan Samyang Pedas (36k) diinput sebagai Sapi Sedang + Extra Kentang (44k).

---

### 7. CABANG BNR (KITCHEN) — SHOPEEFOOD (`3242233425872896192`)
* **Kasir Bertugas**: Roni | **No. POS**: `POS#26` (21:17:48 WIB)
* **Nominal**: Platform **Rp 46.000** vs POS **Rp 39.000** | **Selisih**: **-Rp 7.000** *(POS kurang catat)*
* **External ID di POS**: `3242233425872896192` *(Order ID Sama Persis, Cust Name: `s 51`)*

| Rincian Menu di Aplikasi ShopeeFood | Qty | Harga Satuan | Subtotal App | Rincian Menu yang Diinput Kasir di POS | Qty | Harga Satuan | Subtotal POS |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| SUKA Shawarma Original Shawarma Mix Besar | 1 | Rp 46.000 | Rp 46.000 | Original Sapi Besar | 1 | Rp 39.000 | Rp 39.000 |
| **TOTAL APLIKASI PLATFORM** | **1** | | **Rp 46.000** | **TOTAL INPUTAN POS KASIR** | **1** | | **Rp 39.000** |

> 🔍 **Diagnosa Forensik**: Kasir Roni keliru memilih varian menu daging: Pesanan Mix Besar (46k) diinput sebagai Sapi Besar (39k).

---

### 8. CABANG CIRENDEU — GRABFOOD (`001823040752-C8ECLTNBGA5TWA`)
* **Kasir Bertugas**: Tegar | **No. POS**: `POS#15` (21:49:49 WIB - Rapel Closing)
* **Nominal**: Platform **Rp 45.000** vs POS **Rp 37.000** | **Selisih**: **-Rp 8.000** *(POS kurang catat)*
* **Customer Name di POS**: `GF-` *(Urutan rapel closing ke-5 dari 6 transaksi GrabFood)*

| Rincian Menu di Aplikasi GrabFood | Qty | Harga Satuan | Subtotal App | Rincian Menu yang Diinput Kasir di POS | Qty | Harga Satuan | Subtotal POS |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| ORIGINAL MIX BESAR | 1 | Rp 45.000 | Rp 45.000 | Original Mix Besar | 1 | **Rp 37.000** | Rp 37.000 |
| **TOTAL APLIKASI PLATFORM** | **1** | | **Rp 45.000** | **TOTAL INPUTAN POS KASIR** | **1** | | **Rp 37.000** |

> 🔍 **Diagnosa Forensik (Update v2 — Hasil Cross-Check Harga Database)**:
> Diagnosa awal "salah porsi Sedang" adalah **TIDAK TEPAT**. Berdasarkan cross-check database `order_items`:
> - Menu di POS: `Original Mix Besar` ✅ *(menu sudah BENAR, bukan "Sedang")*
> - Harga di POS: **Rp 37.000** = **Harga Base OFFLINE Mix Besar** (bukan Harga GrabFood Rp 45.000)
>
> **⚠️ Price Tier Leakage Murni**: Kasir Tegar memilih menu yang tepat (`Mix Besar`), namun sistem POS menarik harga dari katalog Dine-In/Offline (Rp 37.000) alih-alih harga GrabFood (Rp 45.000). `order_items.channel = 'offline'` meski `orders.channel = 'grabfood'`. Kerugian = selisih markup GrabFood = **-Rp 8.000**.


---

## 🟡 BAGIAN III: TINDAK LANJUT KASUS SALAH CABANG (CROSS-OUTLET GHOST INPUT)
* **Outlet Terkena**: Kota Wisata Cibubur
* **No. Transaksi POS**: `POS#6` (Rp 51.000, ShopeeFood)
* **Kasir Penginput**: M. Rifqi Darmawan (15:24:26 WIB)
* **Customer Name**: `3242165384006656595`

### Fakta Investigasi & Solusi:
1. Order `3242165384006656595` adalah pesanan ShopeeFood di cabang **PAJAJARAN** (Original Sapi Jumbo 1x, Rp 51.000).
2. Di cabang Pajajaran, kasir Muhamad Fadli Ramadan telah menginput pesanan tersebut dengan benar di `POS#1` pada pukul 15:27:46 WIB (status: cocok 100%).
3. Kasir M. Rifqi Darmawan salah memilih outlet di tablet POS (terpilih Cibubur alih-alih Pajajaran).
4. **Tindakan yang Telah Dilakukan**:
   * Sistem Audit telah mengubah status `POS#6` di Cibubur menjadi **`CANCELLED / VOID`** di database Supabase dan laporan audit.
   * Omzet POS Cibubur telah dikurangi Rp 51.000 agar kembali normal dan akurat.

---

## 🔴 BAGIAN IV: TEMUAN RED FLAG UTAMA — PESANAN MAKANAN TIDAK DIINPUT KASIR (KLASTER 5)
*Status: WAJIB DIINVESTIGASI SECARA FORMAL OLEH AM KEPADA KASIR BERSANGKUTAN.*

Ditemukan **8 transaksi pesanan platform online senilai TOTAL Rp 549.000** yang statusnya selesai/diantar driver ke pelanggan dan uangnya masuk ke rekening perusahaan, namun **TIDAK PERNAH DIINPUT SAMA SEKALI KE POS KASIR**:

### 1. Cabang CIMANGGU — Kasir Bertugas: ZIKRI SAWALUDIN
**Total Pesanan Tidak Diinput: 6 Transaksi | Total Nominal: Rp 380.000**

| No | Waktu Order | Platform | Nomor Pesanan GoFood | Rincian Menu Pesanan di Aplikasi | Tagihan Gross (Rp) | Komisi Gojek (Rp) | Net Masuk Bank (Rp) |
| :---: | :---: | :---: | :--- | :--- | :---: | :---: | :---: |
| 1 | 10:14 WIB | GoFood | `F-3341935694` | Original Sapi Sedang (1x) + Varian | Rp 53.000 | Rp 10.600 | Rp 42.400 |
| 2 | 10:52 WIB | GoFood | `F-3341987165` | Original Sapi Sedang - Porsi Mantap (3x) | Rp 99.000 | Rp 19.800 | Rp 79.200 |
| 3 | 12:35 WIB | GoFood | `F-3342152434` | Original Sapi Sedang - Porsi Mantap (2x) | Rp 66.000 | Rp 13.200 | Rp 52.800 |
| 4 | 13:42 WIB | GoFood | `F-3342231580` | Original Ayam Jumbo - BARBAR (2x) | Rp 82.000 | Rp 16.400 | Rp 65.600 |
| 5 | 15:58 WIB | GoFood | `F-3342376036` | Original Ayam Besar - Large (1x) | Rp 35.000 | Rp 7.000 | Rp 28.000 |
| 6 | 17:05 WIB | GoFood | `F-3342428422` | Original Sapi Besar - Porsi Lapar (1x) | Rp 45.000 | Rp 9.000 | Rp 36.000 |
| **TOTAL** | | | | **6 Pesanan GoFood Cimanggu** | **Rp 380.000** | **Rp 76.000** | **Rp 304.000** |

---

### 2. Cabang PAJAJARAN — Kasir Bertugas: MUHAMAD FADLI RAMADAN
**Total Pesanan Tidak Diinput: 2 Transaksi | Total Nominal: Rp 169.000**

| No | Waktu Order | Platform | Nomor Pesanan GrabFood | Rincian Menu Pesanan di Aplikasi | Tagihan Gross (Rp) | Komisi Grab (Rp) | Net Masuk Bank (Rp) |
| :---: | :---: | :---: | :--- | :--- | :---: | :---: | :---: |
| 1 | 10:35 WIB | GrabFood | `00159901116-C8ECMCKVTFDTEJ` | ORIGINAL AYAM JUMBO (2x) | Rp 82.000 | Rp 11.218 | Rp 70.782 |
| 2 | 10:31 WIB | GrabFood | `00184250826-C8ECMBUGLKCDNN` | ORIGINAL AYAM SEDANG (3x) | Rp 87.000 | Rp 11.902 | Rp 75.098 |
| **TOTAL** | | | | **2 Pesanan GrabFood Pajajaran** | **Rp 169.000** | **Rp 23.120** | **Rp 145.880** |

---

### ❓ INSTRUKSI INVESTIGASI UNTUK AREA MANAGER (TRI RIZKY & ABU BAKAR):
Mohon mintakan Berita Acara Klarifikasi tertulis dari Kasir Zikri Sawaludin dan Kasir Muhamad Fadli Ramadan terkait 3 pertanyaan berikut:
1. Mengapa pesanan online yang masuk ke mesin printer/tablet Gojek/Grab tidak langsung ditransaksikan di aplikasi POS Kasir?
2. Apakah fisik makanan dibuat dan diserahkan ke driver ojek online? *(Jika ya, maka stok bahan baku berkurang tanpa adanya pencatatan transaksi di sistem POS)*.
3. Apakah kasir mencatat transaksi ini secara manual di buku kas / kertas coretan, atau murni lupa input?

---

## ✍️ LEMBAR PENGESAHAN & KOMITMEN AUDIT

Dengan ini Area Manager dan Tim Manajemen menyatakan telah membaca, memeriksa, dan menyetujui hasil temuan rekonsiliasi audit transaksi Foodapps per 1 September 2026 ini, serta berkomitmen untuk menindaklanjuti arahan operasional yang tercantum.

| Disusun Oleh, | Diketahui & Disetujui, | Diketahui & Disetujui, | Mengetahui, |
| :---: | :---: | :---: | :---: |
| <br><br><br>____________________<br>**Tim Internal Audit**<br>Digital & Finance SSI | <br><br><br>____________________<br>**Abu Bakar**<br>Area Manager Wilayah 1 | <br><br><br>____________________<br>**Tri Rizky**<br>Area Manager Wilayah 2 | <br><br><br>____________________<br>**Head of Operations**<br>PT Suka Shawarma Indonesia |
| Tanggal: ___ / ___ / 2026 | Tanggal: ___ / ___ / 2026 | Tanggal: ___ / ___ / 2026 | Tanggal: ___ / ___ / 2026 |

---
*Catatan: Dokumen ini merupakan dokumen internal resmi PT Suka Shawarma Indonesia. Salinan softcopy tersimpan di sistem arsip digital rekonsiliasi.*
