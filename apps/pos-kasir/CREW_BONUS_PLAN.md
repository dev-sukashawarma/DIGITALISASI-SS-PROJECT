# Rencana Implementasi Fitur Bonus Crew

Sesuai dengan hasil diskusi dan pengecekan database, berikut adalah rencana final (Plan) untuk implementasi fitur Bonus Crew. Dokumen ini disiapkan tanpa memulai proses eksekusi (coding) sesuai instruksi Anda.

## 1. Aturan Bisnis yang Disepakati
Berdasarkan feedback yang telah diberikan:
1. **Pembagian Bonus:** Nominal bonus harian yang tercapai akan dibagi rata (pembagian rata) kepada seluruh crew yang terdaftar di outlet tersebut.
2. **Kriteria Kehadiran:** Semua crew yang terdaftar di outlet otomatis mendapatkan bagian dari bonus (tanpa mengecek data absensi/kehadiran).
3. **Penyimpanan Target Harian:** Target harian sudah ada di database (tersimpan pada tabel `daily_sales_targets`).

## 2. Rencana Perubahan Database (Supabase)
Tabel target harian (`daily_sales_targets`) akan di-update untuk menyimpan nominal bonus:
- **Tabel:** `daily_sales_targets`
- **Kolom Baru:** `bonus_amount` (Tipe Data: `DECIMAL` atau `NUMERIC`, default `0`).
- **Update RPC:** Jika saat ini ada RPC `set_daily_target` atau `resolve_daily_target`, maka RPC tersebut perlu dimodifikasi agar bisa menerima parameter `bonus_amount`.

## 3. Rencana Pembuatan Logic Kalkulasi (Backend/RPC)
Kalkulasi akan dilakukan melalui function PostgreSQL (RPC) agar berjalan cepat dan aman di sisi server:
- **Nama RPC:** `calculate_monthly_crew_bonus(p_month INT, p_year INT, p_outlet_id UUID)`
- **Alur Kalkulasi (Logic):**
  1. Filter data order (`orders.total_amount`) dengan status `completed` di bulan dan tahun yang diminta.
  2. Kelompokkan total penjualan (omset) per hari.
  3. Bandingkan total omset harian dengan `target_amount` dari tabel `daily_sales_targets` (yang berlaku pada tanggal tersebut berdasarkan `effective_from`).
  4. Jika penjualan >= target, ambil nilai `bonus_amount`.
  5. Hitung jumlah total hari di bulan tersebut yang mencapai target.
  6. Hitung total bonus yang didapat outlet di bulan tersebut.
  7. Hitung jumlah staff yang ber-role `crew` di tabel `outlet_staff` atau `profiles` untuk outlet tersebut.
  8. Bagi total bonus bulanan dengan jumlah crew (pembagian rata).
  9. Kembalikan data rekapitulasi per crew (Nama Crew, Outlet, Hari Tercapai, Total Bonus Per Orang).

## 4. Rencana Pembaruan Frontend - Admin & Owner (Pengaturan Target)
- **Halaman Target Outlet:** Halaman yang saat ini digunakan untuk mengatur target harian perlu ditambahkan input box baru.
- **Input Baru:** "Nominal Bonus Harian (Rp)".
- **Akses:** Hanya akun dengan role `admin` atau `owner` yang bisa melihat dan menyimpan form ini.

## 5. Rencana Pembaruan Frontend - Laporan Bonus Bulanan
- **Halaman Baru:** Pembuatan UI untuk Laporan Bonus (contoh URL: `/dashboard/reports/crew-bonus`).
- **Filter Pencarian:** 
  - Pilih Bulan
  - Pilih Tahun
  - Pilih Outlet (Khusus Admin/Owner, sedangkan crew hanya melihat outlet miliknya sendiri).
- **Tabel Hasil:** Menampilkan tabel laporan dengan kolom:
  - **Nama Crew**
  - **Jabatan/Role**
  - **Outlet**
  - **Total Hari Target Tercapai**
  - **Bonus yang Diterima (Rp)** (Sudah dalam bentuk pembagian rata).
- **Export (Opsional):** Tombol download ke PDF/Excel (jika dibutuhkan nantinya).

---
*Catatan: Dokumen ini disimpan sebagai referensi eksekusi. Proses koding belum dilakukan sesuai instruksi.*
