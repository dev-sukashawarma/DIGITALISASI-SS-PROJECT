# Dokumen Brainstorming: Migrasi & Sinkronisasi Data Pawoon

Dokumen ini merangkum permasalahan teknis dan bisnis yang kita hadapi selama proses migrasi data dari sistem lama (Pawoon) ke sistem baru (SS Digital), beserta solusi yang telah diimplementasikan atau sedang dipertimbangkan. Dokumen ini dapat digunakan sebagai bahan diskusi/brainstorming dengan agent lain.

---

## 1. Permasalahan: Duplikasi Data (Data Overlap)

**Konteks:**
Perpindahan dari Pawoon ke sistem baru tidak terjadi serentak di semua outlet. Akibatnya, ada fase transisi di mana kasir sudah mulai menginput pesanan secara manual di sistem baru, namun data historis Pawoon juga harus di-import ke database yang sama.

**Masalah Utama:**
- Ketika mengunggah file Excel dari Pawoon, rentang tanggal dalam file tersebut bisa jadi tumpang tindih (*overlap*) dengan tanggal di mana outlet tersebut sudah mulai menggunakan sistem baru secara _live_.
- Jika data Pawoon di-import semua, transaksi pada hari yang sama akan tercatat dua kali: satu dari input kasir manual, dan satu dari import Pawoon.
- Transaksi manual kasir tidak memiliki `external_order_id` (ID referensi Pawoon), sehingga sistem deduplikasi standar kita (yang mengecek ID Pawoon) tidak bisa mendeteksi bahwa itu adalah transaksi yang sama.

**Solusi yang Diimplementasikan:**
- **Sistem Cutoff Date:** Kita membuat konfigurasi `outlet_system_start_dates.json` yang mencatat kapan pastinya (tanggal & waktu) setiap outlet mulai *live* menggunakan sistem baru.
- **Auto-Skip Data Baru:** Saat file Pawoon diunggah, sistem akan membaca tanggal transaksi per baris. Jika transaksi terjadi *setelah* Cutoff Date, data tersebut akan ditandai sebagai **"Post-System Data"** dan otomatis *di-skip* (tidak akan dimasukkan ke antrean *Simpan*).
- **Preview & Audit Visual:** Meskipun di-skip untuk disimpan, data tersebut tetap ditampilkan di layar *Preview* untuk kebutuhan komparasi dan audit (*cross-check* omset manual kasir vs Pawoon).

---

## 2. Permasalahan: Pembersihan Data (Data Cleanup)

**Konteks:**
Sebelum sistem *Cutoff Date* diimplementasikan dengan sempurna, ada kemungkinan staf sudah meng-import data Pawoon yang *overlap* dengan data manual kasir, sehingga menyebabkan omset ganda di dashboard.

**Masalah Utama:**
- Bagaimana cara menghapus data Pawoon yang tumpang tindih tanpa tidak sengaja menghapus data yang diinput manual oleh kasir?
- Database `orders` berisi puluhan ribu baris (baik dari Pawoon maupun kasir).

**Solusi yang Diimplementasikan:**
- **Fitur Hapus Data per Outlet:** Kita menambahkan fitur *reset/clear* data khusus Pawoon di UI.
- Sistem menggunakan filter ganda: menghapus baris di tabel `orders` di mana `outlet_id = [Outlet Pilihan]` **DAN** `customer_name = 'Pawoon Import'`.
- Ini memastikan 100% data manual (yang tidak memiliki nama customer default tersebut) tetap aman dan tidak tersentuh. 

---

## 3. Permasalahan: Performa & Timeout Database (Statement Timeout)

**Konteks:**
File Excel Pawoon untuk 1 bulan data bisa berukuran ratusan KB dan berisi puluhan ribu baris transaksi dan *item*.

**Masalah Utama:**
- Muncul error `canceling statement due to statement timeout` saat pengguna mengklik tombol "Preview Data".
- Error ini berasal dari PostgreSQL (Supabase) karena query memakan waktu lebih dari batas maksimal (misal 3-8 detik).
- Akar penyebab: 
  1. Sistem mengecek *existing orders* ke database dalam bongkahan (batch) 100 *receipts* sekaligus. Untuk 21.000 baris, ini menghasilkan >200 query sekuensial (*full table scan* karena kolom `external_order_id` tidak diindeks).
  2. Deteksi *overlap* mencoba memuat ribuan data *systemSales* sekaligus dengan *join* ke tabel `order_items`.

**Solusi yang Diimplementasikan:**
- **Optimasi Batching:** Memperbesar ukuran batch pengecekan duplikasi dari 100 menjadi 1.000, sehingga memangkas jumlah query ke database hingga 10x lipat.
- **Limitasi Protektif:** Menambahkan proteksi limit untuk pengambilan data *overlap* agar tidak membuat *query planner* Postgres tersendat.
- *Rencana Lanjutan (Jika Diperlukan):* Membuat index B-Tree pada kolom `external_order_id` di Supabase untuk mempercepat pencarian data O(log N).

---

## 4. Topik Lanjutan untuk Brainstorming

Jika Anda melakukan brainstorming dengan *agent* lain, berikut beberapa area yang bisa dieksplorasi lebih lanjut:
1. **Mekanisme Fallback Indexing:** Bagaimana cara paling aman menerapkan Index pada Supabase secara remote tanpa merusak flow production saat ini?
2. **Validasi Cutoff yang Presisi:** Jika cutoff date tidak hanya per hari, tapi per *jam/menit* pergantian shift, bagaimana UI/UX terbaik agar owner mudah memperbaruinya tanpa koding?
3. **Rekonsiliasi Otomatis (Auto-Matching):** Bisakah kita membuat algoritma pencocokan harga/omset harian otomatis yang membandingkan Omset Pawoon vs Omset Manual dan menampilkan *delta/selisih*-nya tanpa campur tangan staf?
