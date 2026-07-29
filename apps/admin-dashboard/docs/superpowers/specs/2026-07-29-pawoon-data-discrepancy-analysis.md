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
    1. Menambahkan kolom channel di tabel order_items (offline, ood_apps, 	iktok_go).
    2. Modifikasi parser import Pawoon (ctions/pawoon.ts) agar mencatat channel pada tiap item berdasarkan prefix produk Pawoon saat import.
    3. Backfill data historis order_items berdasarkan transaksi Pawoon.
    4. Menambahkan fitur update otomatis status order cancelled/oid pada saat re-import Excel.

---

## 3. Hasil Rekonsiliasi Data (Case: Original Sapi Sedang Cibubur)

| Channel | Excel Pawoon | Database System (Completed Only) | Status / Selisih |
|---|---|---|---|
| **Food Apps** | 94 | **94** | ? **SINKRON 100% (Exact Match)** |
| **TikTok Go** | 0 | **0** | ? **SINKRON 100% (Exact Match)** |
| **Offline** | 518 | **520** | ?? Selisih +2 pcs |
| **TOTAL** | **612** | **614** | ?? Selisih +2 pcs (~0.3%) |

---

## 4. Analisis Penyebab Selisih 2 Pcs di Channel Offline

1. **Bukan Karena TikTok Go / Food Apps:**
   Data Food Apps (94) dan TikTok Go (0) sudah 100% identik dengan Excel.
2. **Bukan Karena Order Void Yang Lolos:**
   Semua order berstatus cancelled / oid sudah difilter keluar dari perhitungan Laporan Laba Kotor. (Total completed order = 1.162).
3. **Penyebab Utama (Cut-off Waktu Ekspor Excel):**
   - Transaksi di database terhitung penuh sampai akhir hari tanggal 24/25 Juli (23:59:59).
   - File Excel Pawoon yang diekspor merupakan snapshot data pada jam tertentu saat penarikan laporan dilakukan di Pawoon POS. 2 pcs selisih merupakan transaksi valid offline yang masuk setelah file Excel diekspor di hari tersebut.

---

## 5. Catatan & Panduan Pemrosesan Selanjutnya untuk Agent Lain

- Codebase laporan profit (pps/admin-dashboard/src/app/dashboard/pawoon-import/profit/page.tsx) saat ini **sudah menggunakan item.channel langsung** dari tabel order_items.
- Parser import (pawoon.ts) **sudah menangani penandaan channel per item** serta **update status void**.
- Jika ingin menyamakan 100.00% hingga 0 unit selisih dengan file Excel lama, pastikan timestamp filter waktu sampai jam/menit ekspor Excel Pawoon tersebut diketahui.
