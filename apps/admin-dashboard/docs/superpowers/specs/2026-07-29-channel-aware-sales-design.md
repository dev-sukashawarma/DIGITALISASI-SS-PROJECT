# Channel-Aware Sales & Profit Tracking

**Date:** 2026-07-29  
**Status:** Approved  
**Scope:** Pawoon Import + Laporan Laba Kotor

---

## Background

Suka Shawarma memiliki 3 channel penjualan:

| Channel | Harga Jual | HPP |
|---|---|---|
| Offline / Web | Standar | hpp (pusat) atau hpp x 1.1 (mitra) |
| Food Apps (GoFood, GrabFood, ShopeeFood) | Lebih tinggi | Sama dengan Offline |
| TikTok Go | Standar | Sama dengan Offline |

Perbedaan HPP HANYA antara outlet Pusat vs Mitra (x1.1). Channel tidak mempengaruhi HPP.

### Masalah Saat Ini

Data channel hilang setelah import Pawoon karena:
1. Nama produk Pawoon (misal 'FOOD APPS ORIGINAL SAPI SEDANG') disamakan ke nama sistem ('Original Sapi Sedang')
2. Informasi channel dari prefix nama produk tidak ikut tersimpan di database
3. Laporan Laba Kotor tidak bisa memisahkan Offline vs Food Apps vs TikTok Go secara akurat

### Cara Pawoon Menandai Channel (dari prefix nama produk)

- 'FOOD APPS ...' -> Food Apps
- 'BEST SELLER ...' -> TikTok Go
- Semua lainnya -> Offline

---

## Desain Solusi

### 1. Database: Tambah Kolom channel di order_items
- Nilai: 'offline' | 'food_apps' | 'tiktok_go', default 'offline'
- Diisi saat import Pawoon berdasarkan prefix nama produk
- Untuk data dari POS Kasir: default 'offline'

### 2. Backfill Data Lama
Update order_items.channel dari orders.sales_source (best effort):
- sales_source = 'grabfood' atau channel = 'food_apps' -> 'food_apps'
- sales_source = 'tiktokgo' atau channel = 'tiktok' -> 'tiktok_go'
- else -> 'offline'

### 3. Pawoon Import: Isi channel Saat Insert
Deteksi dari prefix nama produk di pawoon.ts, tambahkan ke setiap order_items.

### 4. Laporan Laba Kotor: Pakai item.channel Langsung
Hapus logika deteksi channel dari orders.channel/sales_source yang tidak akurat.
Ganti dengan item.channel dari order_items.

### 5. Kalkulasi HPP Tetap Tidak Berubah
HPP = menu_item.hpp (pusat) atau x1.1 (mitra). Tidak ada perubahan di sistem resep.

---

## File yang Dimodifikasi

| File | Perubahan |
|---|---|
| order_items (Supabase) | Tambah kolom channel TEXT DEFAULT 'offline' |
| apps/admin-dashboard/src/app/actions/pawoon.ts | Deteksi & isi channel per item saat insert |
| apps/admin-dashboard/src/app/dashboard/pawoon-import/profit/page.tsx | Pakai item.channel |
| Script backfill (one-time) | Update channel untuk data lama |

---

## Verification Plan

1. Import ulang Excel Pawoon Cibubur -> cek channel di order_items terisi benar
2. Laporan Laba Kotor -> expand 'Original Sapi Sedang' -> tidak ada TikTok Go row
3. Expand menu dengan Food Apps -> qty match Excel Pawoon
4. Total qty semua channel per menu = total di Excel
