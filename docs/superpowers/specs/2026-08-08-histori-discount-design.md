# Design: Display Discount on History Page (Histori & Bonus)

## Goal
Menampilkan jumlah "Potongan Harga" (diskon) pada card rincian pesanan (expanded view) di halaman Histori & Bonus (`apps/pos-kasir/app/kasir/histori/page.tsx`).

## Context & Current State
Saat ini, di halaman Histori, `order_items` ditampilkan dengan `subtotal` masing-masing item, dan `total_amount` dari order. Namun, jika ada diskon (misalnya dari channel GRABFOOD atau promo lainnya), total dari `subtotal` item bisa lebih besar dari `total_amount`. Selisih ini adalah diskon (potongan harga), namun belum dirender di UI, sehingga kasir/user bingung ke mana selisih harganya. Kolom `discount_amount` di database masih bernilai `null` untuk banyak order lama/baru.

## Proposed Design
1. **Calculation**: 
   - Karena `discount_amount` di database sering bernilai `null`, cara paling aman dan backward-compatible adalah dengan menghitung selisih antara total dari `subtotal` semua item dengan `total_amount` dari pesanan tersebut.
   - `calculatedDiscount = sum(item.subtotal) - order.total_amount`
2. **UI Placement**:
   - Jika `calculatedDiscount > 0`, maka tampilkan baris tambahan "Diskon / Promo" di dalam section *Expanded* dari card pesanan.
   - Posisinya berada setelah daftar items (`order_items`) dan sebelum catatan/alasan batal.
   - Menggunakan warna merah (misal `text-red-500`) untuk menandakan potongan, dengan format: `-Rp X.XXX`.
3. **Styling**:
   - Dibuat senada dengan baris rincian item, tetapi dengan font dan warna yang lebih menonjolkan bahwa itu adalah nilai pengurang (diskon).

## File to Modify
- `apps/pos-kasir/app/kasir/histori/page.tsx`

## Testing
- Buka halaman histori pesanan, cari pesanan yang memiliki potongan harga (misal order GRABFOOD yang total subtotalnya > total bayar).
- Pastikan baris diskon muncul dengan nilai minus yang tepat.
- Pastikan pesanan tanpa diskon tidak menampilkan baris diskon.
