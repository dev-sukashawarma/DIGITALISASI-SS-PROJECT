# Design: Permintaan Bahan Berbasis Item (Menu Target)

## Latar Belakang
Saat ini, proses Permintaan Bahan oleh Outlet Staff dilakukan dengan memilih langsung "Bahan Baku" (mis. Daging, Tortilla) dan memasukkan jumlahnya. Hal ini sering menyulitkan kru karena mereka berpatokan pada target penjualan menu, bukan jumlah bahan mentah.
Fitur ini bertujuan mengubah paradigma request barang agar berpatokan pada "Item Menu" (mis. target jualan 100 Shawarma Medium).

## Solusi & Arsitektur
Sistem akan menyediakan kalkulator otomatis (berupa RPC di Supabase) yang menerjemahkan target porsi menu menjadi kebutuhan bahan baku, dengan memperhitungkan sisa stok yang ada di outlet saat ini.

### Alur Kerja (Workflow)
1. **Input Target:** Di halaman Permintaan Bahan (Frontend), disediakan mode "Berdasarkan Target Menu". Crew memilih menu-menu aktif dan memasukkan target porsi (kuantitas) untuk masing-masing menu.
2. **Kalkulasi (Backend RPC):** Sistem mengirim daftar target menu ke Supabase. Sebuah RPC `calculate_bahan_baku_request` akan dieksekusi:
   - Menarik komposisi BOM (Resep) dari masing-masing menu yang dipilih.
   - Mengalikan qty BOM dengan target porsi untuk mendapatkan Total Kebutuhan tiap Bahan Baku.
   - Mengambil saldo stok terakhir dari `stok_balance` untuk outlet peminta.
   - Mengurangi Total Kebutuhan dengan saldo stok. Jika Kebutuhan > Saldo, selisihnya menjadi `qty_diminta`.
3. **Review & Edit:** UI akan menampilkan hasil kalkulasi berupa daftar Bahan Baku beserta jumlah yang disarankan untuk di-request. Crew dapat meninjau (review) dan mengubah angka tersebut jika ada pertimbangan khusus di lapangan.
4. **Submit:** Crew mensubmit daftar tersebut sebagai `permintaan_bahan` standar. Proses selanjutnya (Approval Gudang, Surat Jalan) tidak berubah.

### Perubahan Database
- **Table / Schema:** Tidak ada perubahan struktur tabel yang signifikan karena entitas `permintaan_bahan`, `resep`, dan `stok_balance` sudah terintegrasi.
- **Fungsi Baru (RPC):** Membuat fungsi PostgreSQL `calculate_bahan_baku_request(p_outlet_id UUID, p_targets JSONB)` yang menerima parameter JSON berisi pasangan `resep_id` dan `target_qty`, lalu mereturn daftar bahan baku yang dibutuhkan beserta qty-nya.

### Catatan Tambahan (Future Scope)
- Opsi "Auto-Forecast" berdasarkan laju penjualan hari-hari sebelumnya dapat ditambahkan kelak untuk mengisi default angka "Target Porsi" secara otomatis. Desain ini sudah kompatibel dengan rencana tersebut (tinggal memodifikasi logika pengisian default di langkah 1 UI).

## Lingkup (Scope)
Dokumen ini difokuskan pada antarmuka input dan kalkulasi draft Permintaan Bahan. Tidak mengubah logic flow persetujuan Surat Jalan, nilai HPP, ataupun Manajemen Stok (Stok Masuk/Keluar) yang sudah stabil berjalan.
