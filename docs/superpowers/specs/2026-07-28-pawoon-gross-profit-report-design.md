# Laporan Laba Kotor (Gross Profit) dari Data Pawoon

## Konteks
Setelah data historis penjualan berhasil diimpor dari Pawoon ke sistem (melalui fitur Sinkronisasi Pawoon), kita membutuhkan sebuah laporan tingkat tinggi (*high-level*) untuk menganalisis Gross Profit (Laba Kotor) harian. Laporan ini difokuskan sebagai alat rekonsiliasi dan *cross-check* kilat tanpa perlu perhitungan COGS riil/dinamis yang terlalu kompleks.

## Pendekatan Sistem & Arsitektur
Sesuai hasil *brainstorming*, fitur ini akan dibangun dengan **Pendekatan HPP Fix / Sederhana**.

1. **Sumber Data Penjualan**: 
   Menggunakan tabel `orders` dan `order_items` yang di-_filter_ khusus dengan kondisi `source = 'pos'`.
   
2. **Sumber Data Modal (HPP)**:
   - **Untuk Outlet Internal (Cabang)**: Sistem akan mengambil HPP dari tabel master `menu_items` pada kolom `hpp_override` (HPP Pusat).
   - **Untuk Outlet Mitra**: Sistem akan secara otomatis menghitung `HPP Mitra = HPP Pusat + 10%`. Hal ini mengunci standar margin pusat tanpa harus bergantung pada pengecekan tabel `menu_outlet_prices` yang mungkin belum terisi.

3. **Perhitungan Margin**:
   - `Omset` = `unit_price` × `quantity`
   - `Total HPP` = `HPP` × `quantity`
   - `Laba Kotor` = `Omset` - `Total HPP`

## Spesifikasi Tampilan (UI)
Fitur laporan ini akan diletakkan di rute `/dashboard/pawoon-import/profit`.
Halaman akan terdiri dari:

1. **Filter Kontrol**:
   - Pemilihan Tanggal (Dari - Sampai).
   - Pemilihan Outlet (Tampil berdasarkan Cabang dan Mitra, termasuk outlet yang sudah non-aktif).
   
2. **Kartu Skor (Scorecards)**:
   - **Total Pendapatan** (Total Omset)
   - **Total HPP** (Total Modal)
   - **Laba Kotor** (Gross Profit dalam Rupiah)
   - **Persentase Margin** ((Laba Kotor / Total Pendapatan) × 100%)

3. **Tabel Breakdown Item**:
   Sebuah tabel yang merangkum penjualan per menu (Dikelompokkan berdasarkan nama menu), memuat kolom:
   - Nama Menu
   - Qty Terjual
   - Total Omset
   - Harga HPP per pcs
   - Total HPP
   - Laba Kotor

## Status Idempotensi & Reliabilitas
Karena bergantung murni pada data tarikan `orders` yang sifatnya statis (sudah lewat), laporan ini dapat memuat data jumlah besar dengan sangat cepat. Jika HPP Master diperbarui di kemudian hari, nilai margin di laporan *cross-check* ini akan mengikuti nilai HPP yang baru (bersifat _live_ reference ke `menu_items`), sesuai dengan persetujuan pendekatan "HPP Sederhana".
