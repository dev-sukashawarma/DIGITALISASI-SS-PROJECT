# Laporan Analisis Diskrepansi Data Pawoon vs Database System

**Tanggal:** 29 Juli 2026  
**Topik:** Rekonsiliasi Channel Penjualan & Perhitungan Qty Item (Studi Kasus: Original Sapi Sedang - Mitra Cibubur Periode 1-25 Juli)

---

## 1. Latar Belakang & Aturan Bisnis Channel

Suka Shawarma memiliki 3 channel utama:
1. **Offline / Web**: Harga jual standar, HPP standar (Pusat) / HPP + 10% (Mitra).
2. **Food Apps (GoFood, GrabFood, ShopeeFood)**: Harga jual lebih tinggi, HPP **sama dengan Offline**.
3. **TikTok Go**: Paket combo/promo tertentu (diawali nama BEST SELLER), Harga jual standar, HPP **sama dengan Offline**.

---

## 2. Cara Pawoon Menandai Channel vs Implementasi DB

* **Di File Excel Pawoon:** Channel terdeteksi dari **Prefix Nama Produk**:
  - Diawali FOOD APPS ... -> Channel **Food Apps**
  - Diawali BEST SELLER ... -> Channel **TikTok Go**
  - Lainnya -> Channel **Offline**

* **Di Database System:**
  - Sebelumnya, nama produk disamakan ke Master Menu (Original Sapi Sedang), sehingga prefix nama hilang dan channel tidak bisa dibedakan secara akurat dari DB.
  - **Solusi yang Sudah Diterapkan:**
    1. Menambahkan kolom channel di tabel order_items (offline, food_apps, tiktok_go).
    2. Modifikasi parser import Pawoon (actions/pawoon.ts) agar mencatat channel pada tiap item berdasarkan prefix produk Pawoon saat import.
    3. Backfill data historis order_items berdasarkan transaksi Pawoon.
    4. Menambahkan fitur update otomatis status order cancelled/void pada saat re-import Excel.

---

## 3. Hasil Rekonsiliasi Data (Case: Original Sapi Sedang Cibubur)

| Channel | Excel Pawoon | Database System (Completed Only) | Status / Selisih |
|---|---|---|---|
| **Food Apps** | 94 | **94** | SINKRON 100% (Exact Match) |
| **TikTok Go** | 0 | **0** | SINKRON 100% (Exact Match) |
| **Offline** | 518 | **520** | Selisih +2 pcs |
| **TOTAL** | **612** | **614** | Selisih +2 pcs (~0.3%) |

---

## 4. Analisis Penyebab Selisih 2 Pcs di Channel Offline

1. **Bukan Karena TikTok Go / Food Apps:**
   Data Food Apps (94) dan TikTok Go (0) sudah 100% identik dengan Excel.
2. **Bukan Karena Order Void Yang Lolos:**
   Semua order berstatus cancelled / void sudah difilter keluar dari perhitungan Laporan Laba Kotor. (Total completed order = 1.162).
3. **Penyebab Utama (Cut-off Waktu Ekspor Excel):**
   - Transaksi di database terhitung penuh sampai akhir hari tanggal 24/25 Juli (23:59:59).
   - File Excel Pawoon yang diekspor merupakan snapshot data pada jam tertentu saat penarikan laporan dilakukan di Pawoon POS. 2 pcs selisih merupakan transaksi valid offline yang masuk setelah file Excel diekspor di hari tersebut.

---

## 4b. UPDATE 2026-07-29 (verifikasi ulang dengan file Excel asli): Selisih 518 vs 520 BUKAN bug — kesalahan metodologi perbandingan

**Kesimpulan poin 4 versi awal di atas (teori "cutoff waktu ekspor Excel") TERBUKTI SALAH** setelah file Excel asli
(`DTP_-_SUKA_Shawarma_PARTNERSHIP_-_SUKA_SHAWARMA_KOTA_WISATA_-_29-07-26_10.30.02_-_Pawoon_POS.xls`) dibaca baris-per-baris
dan dicocokkan langsung ke DB live via `supabase db query`.

**Bukti:**
- File Excel: header "Tanggal: 01-07-2026 - 24-07-2026" (bukan sampai 25 Juli — periode "1-25 Juli" di judul laporan tidak akurat).
- Produk offline "Original Sapi Sedang" tercatat di Excel sebagai `SAPI SEDANG` (bukan "Original Sapi Sedang" — nama beda karena mapping via `pawoon_item_map.json`).
- 351 baris `SAPI SEDANG` di Excel: **520 qty status `Success`**, **-2 qty status `Void`** (2 struk: `YBGQF8QLPMJ64` 12 Juli, `RQLV27Z4NPJZJ` 2 Juli) → **net 518** kalau qty Void dikurangkan.
- Di DB, kedua receipt tersebut (`YBGQF8QLPMJ64`, `RQLV27Z4NPJZJ`) **sudah berstatus `cancelled`**, persis sesuai status Void di Excel.

**Akar masalah sebenarnya:** laporan versi awal membandingkan **DB completed-only (520)** vs **Excel net-setelah-void (518)** — dua metodologi berbeda, bukan data yang benar-benar berbeda. Kalau dibandingkan apples-to-apples (completed-only vs status `Success`), **520 = 520, exact match, 0 selisih**. Aturan bisnis "exclude cancelled/void dari laporan" (commit 9d03a728) sudah diterapkan **benar** di kedua sisi.

**Kesimpulan final: data DB dan Excel Pawoon SUDAH 100% sinkron untuk kasus item ini. Tidak ada bug kode untuk diperbaiki di titik ini.** Poin 4 versi awal (teori cutoff waktu) dibiarkan di atas untuk jejak audit, tapi sudah disupersede oleh section ini — jangan dipakai sebagai rujukan.

**Pelajaran untuk analisis serupa ke depan:** saat membandingkan angka Excel vs DB, selalu pastikan filter status kedua sisi identik (completed-only vs completed-only). Jangan bandingkan angka "net setelah void" dari satu sisi dengan angka "completed-only" dari sisi lain — akan selalu terlihat ada selisih palsu sebesar total qty void.

---

## 6. UPDATE 2026-07-29 (lanjutan): Bug data nyata ditemukan & DIPERBAIKI — channel salah pada struk multi-channel

Setelah section 4b menyimpulkan item "Original Sapi Sedang" 100% sinkron, dilakukan verifikasi menyeluruh **seluruh 1.820 baris `order_items`** outlet Cibubur (bukan cuma 1 item) terhadap file Excel asli — kali ini ketemu bug data sungguhan, bukan cuma metodologi.

**Temuan:** 102 baris `order_items` (309 unit) punya `channel` yang SALAH. Semuanya berasal dari **struk yang isinya campur beberapa channel dalam satu transaksi** (mis. 1 struk berisi item `BEST SELLER...` dan `FOOD APPS...` sekaligus). Contoh struk `GDLZSZM4MVYNY`: item `BEST SELLER - ORI SAPI JUMBO` (harusnya `tiktok_go` — kategori Excel "SS TIKTOK GO") tersimpan di DB sebagai `food_apps`, ikut channel item FOOD APPS lain di struk yang sama.

**Root cause:** parser `pawoon.ts` yang berjalan **sekarang** SUDAH benar — disimulasikan persis terhadap baris Excel yang sama, hasilnya benar per-baris (setiap baris independen, tidak tercampur). Data yang salah berasal dari **backfill historis yang tidak tercatat di repo** (disebut di section 2 poin 3, tapi tidak ada file scriptnya) — kemungkinan backfill itu menyamaratakan SATU channel untuk SEMUA item dalam satu struk (bukan per-baris), sehingga struk multi-channel jadi salah kategori.

**Fix yang sudah dijalankan:** 102 `order_items.id` (semua target `tiktok_go`) di-`UPDATE` langsung ke DB live, tervalidasi dari cross-check exact terhadap file Excel `DTP_-_SUKA_Shawarma_PARTNERSHIP_-_SUKA_SHAWARMA_KOTA_WISATA_-_29-07-26_10.30.02_-_Pawoon_POS.xls`. Re-verifikasi setelah update: **0 mismatch dari 1.820 baris** — Cibubur (1-24 Juli) sekarang 100% sinkron per-item per-channel dengan Excel.

**PERHATIAN: kemungkinan bug ini juga ada di 18 outlet lain** (struk mitra dengan banyak channel campur dalam satu transaksi kemungkinan besar terjadi di outlet lain juga) — belum diverifikasi karena file Excel outlet lain belum tersedia di sesi ini. Untuk memperbaiki outlet lain, perlu file Excel asli per-outlet per-periode, lalu ulangi proses cross-check yang sama (bandingkan `order_items.channel` vs channel yang dihitung ulang dari `productName`/`kategori` per baris Excel, group by `receipt|menu_item_id`).

---

## 5. Catatan & Panduan Pemrosesan Selanjutnya untuk Agent Lain

- Codebase laporan profit (apps/admin-dashboard/src/app/dashboard/pawoon-import/profit/page.tsx) saat ini **sudah menggunakan item.channel langsung** dari tabel order_items.
- Parser import (pawoon.ts) **sudah menangani penandaan channel per item dengan benar** serta **update status void**. Parser TIDAK perlu diperbaiki — bug ada di data historis (lihat section 6), bukan di kode yang berjalan sekarang.
- Jika ingin menyamakan 100.00% hingga 0 unit selisih dengan file Excel lama, pastikan timestamp filter waktu sampai jam/menit ekspor Excel Pawoon tersebut diketahui — TAPI perhatikan section 4b dulu: pastikan metodologi filter status (completed-only vs net-setelah-void) sama di kedua sisi sebelum menyimpulkan ada selisih.
- **Untuk outlet selain Cibubur:** kemungkinan ada bug channel yang sama (lihat section 6) di struk multi-channel historis. Cross-check dengan file Excel asli per-outlet sebelum percaya angka breakdown channel di laporan profit.

---

## 7. UPDATE 2026-07-29 (keputusan final): Laba Kotor diubah ke metodologi NET (ikut Grand Total Excel)

Setelah section 4b/6 mendokumentasikan Completed Only sebagai metodologi profit report (sesuai commit 9d03a728), owner secara eksplisit memutuskan SEBALIKNYA: Laporan Laba Kotor (`apps/admin-dashboard/src/app/dashboard/pawoon-import/profit/page.tsx`) harus pakai NET (order completed dikurangi order cancelled/void), supaya persis match Grand Total Excel Pawoon. Ini membalikkan aturan bisnis commit 9d03a728.

Perubahan diterapkan:
- Query orders: dari `.eq('status', 'completed')` menjadi `.in('status', ['completed', 'cancelled'])`.
- Saat agregasi per item: `sign = order.status === 'cancelled' ? -1 : 1`, diterapkan ke qty, omset (subtotal), DAN kontribusi HPP (supaya margin tidak timpang saat order void ikut dikurangkan).
- Divalidasi: Original Sapi Sedang Cibubur (1-24 Juli) sekarang **612** (bukan 614 lagi) — cocok persis dengan kolom Net di halaman Migrasi Pawoon (518 offline + 94 food apps).

**Penting untuk sesi lain:** kalau ada yang bertanya kenapa Laba Kotor tidak exclude void total padahal ada catatan lama bilang begitu — INI KEPUTUSAN BARU yang menggantikannya. Jangan revert ke Completed Only tanpa konfirmasi ulang ke owner.

---

## 8. UPDATE 2026-07-29 (perbaikan DB-wide, semua outlet): item combo dikonfirmasi selalu TikTok Go, 832 baris diperbaiki

Setelah fix Cibubur (section 6), dilakukan audit DB-wide (tanpa Excel) untuk 19 outlet:
- Item yang namanya PASTI eksklusif TikTok Go (Best Seller 2, Best Seller (Mix Jumbo) - satu-satunya jalur mapping-nya dari produk berprefix BEST SELLER): 0 kesalahan di semua 15 outlet yang punya item ini.
- Item combo/paket lain (SHAWARMA DUO COMBO, TRIPLE COMBO, Suka duo Favorite, SUKA TRIPLE FAVORIT, SHAWARMIE DUO VARIAN, MIX CHEESE COMBO) - pola mencurigakan ditemukan: hanya 1 outlet (Cibubur) yang punya channel tiktok_go untuk item-item ini, 8-17 outlet lain 100% offline/food_apps.
- Owner mengkonfirmasi: keenam item combo tersebut MEMANG SELALU TikTok Go channel, di outlet manapun (bukan pola bisnis yang wajar berbeda per outlet).

**Fix diterapkan:** UPDATE order_items SET channel='tiktok_go' untuk keenam nama item combo tersebut, WHERE channel != 'tiktok_go', lintas SEMUA outlet (bukan cuma Cibubur). **832 baris (899 unit) diperbaiki.** Verifikasi ulang: 0 sisa non-tiktok_go untuk keenam item combo ini di seluruh DB.

**Catatan:** perbaikan ini TIDAK memvalidasi item-item lain yang masih ambigu (bisa offline ATAU food_apps tergantung prefix Excel, tidak bisa dipastikan dari nama master menu saja - lihat FOOD APPS section 6). Kalau ada Excel outlet lain di masa depan, tetap lakukan cross-check penuh seperti section 6, bukan cuma andalkan nama item.
---

## 9. UPDATE 2026-07-29 (lanjutan): daftar lengkap item yang SELALU TikTok Go (dikonfirmasi owner)

Setelah section 8, owner mengkonfirmasi item combo/paket tambahan yang SELALU TikTok Go apapun outletnya:
- SUKA PREMIUS KRISPY (36 baris/37 unit sebelumnya food_apps di 12 outlet -> diperbaiki ke tiktok_go, diverifikasi 0 sisa).
- PAKET NONGKI 1, PAKET NONGKI 2, PAKET SPESIAL SUKA LOVERS, DOUBLE SUKA, MEGABITE COMBO, PAKET MOOD, TRIPLE SERU, PAKET NIKMAT, PAKET COUPLE (belum ada data terjual sama sekali di DB saat ini -- 0 baris ter-update -- tapi aturan channel-nya sudah dicatat di sini untuk import berikutnya).

**DAFTAR LENGKAP item yang SELALU tiktok_go (kumulatif section 6+8+9), untuk referensi audit/fix ke depan:**
Best Seller 2, Best Seller (Mix Jumbo), SHAWARMA DUO COMBO, TRIPLE COMBO, Suka duo Favorite, SUKA TRIPLE FAVORIT, SHAWARMIE DUO VARIAN, MIX CHEESE COMBO, SUKA PREMIUS KRISPY, PAKET NONGKI 1, PAKET NONGKI 2, PAKET SPESIAL SUKA LOVERS, DOUBLE SUKA, MEGABITE COMBO, PAKET MOOD, TRIPLE SERU, PAKET NIKMAT, PAKET COUPLE.

**Item combo yang TIDAK termasuk daftar ini (dicek, tidak ada anomali, dibiarkan sesuai channel saat ini):**
Combo #1, Combo #2, Combo #3, Combo 4, Combo #1 UP SIZE JUMBO, Combo #1 UP SIZE BESAR, Combo #2 UP SIZE JUMBO, Combo #2 UP SIZE BESAR, Combo #3 UP SIZE JUMBO -- semuanya konsisten offline di semua outlet yang punya data, tidak ada pola outlier seperti item TikTok Go di atas.

**Catatan untuk pawoon.ts ke depan:** parser saat ini menentukan channel HANYA dari prefix nama produk (FOOD APPS/BEST SELLER) atau kategori Excel (FOOD APPS/SS TIKTOK GO) per baris -- itu tetap sumber kebenaran paling akurat untuk import BARU (data actual dari Excel). Daftar di atas hanya dipakai untuk audit/perbaikan data HISTORIS yang sudah kehilangan info prefix/kategori aslinya.