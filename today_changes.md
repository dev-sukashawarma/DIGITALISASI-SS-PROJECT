# Ringkasan Perubahan Hari Ini (1 Juli 2026)

Hari ini kita fokus pada perkuatan sistem pencegahan kebocoran finansial (*Loss Gap Prevention*) di level operasional outlet. Kita telah merancang dan mengimplementasikan modul **Shift Management & Blind Close** ke dalam sistem *database* (Supabase).

Berikut adalah rincian lengkap perubahan yang telah diimplementasikan:

---

## 1. Modul Shift Kasir (Sesi Laci Fisik)

Sistem kini mewajibkan pencatatan sesi buka dan tutup laci secara eksplisit untuk menjaga akuntabilitas uang fisik.

*   **Tabel `shifts` Baru**: Menambahkan tabel `public.shifts` untuk merekam:
    *   `staff_id`: Siapa yang membuka laci.
    *   `closed_by`: Siapa yang melakukan tutup laci (Crew atau SPV).
    *   `starting_cash`: Saldo awal laci (menyatukan uang modal kembalian dan sisa Petty Cash harian).
    *   `actual_ending_cash` & `expected_ending_cash`: Pencatatan hasil *blind close*.
    *   `variance`: Selisih otomatis antara fisik vs sistem.
*   **Penguncian Outlet**: Hanya boleh ada 1 shift aktif (`status = 'open'`) per outlet pada satu waktu yang sama (*Unique Index Constraint*).

## 2. Penguatan & Relasi Petty Cash

Pengeluaran operasional outlet (*Opex*) kini terbagi dua tipe pembayaran agar rekonsiliasi kas tidak berantakan:

*   **Tipe Sumber Dana (`payment_source`)**:
    1.  `cash_drawer`: Pembayaran yang diambil langsung dari laci fisik (Misal: beli es batu).
    2.  `transfer_pusat`: Pembayaran langsung dari kantor pusat (Misal: token listrik, keamanan).
*   **Auto-Link ke Shift**: Sebuah *Database Trigger* (`trg_link_expense_to_shift`) ditambahkan agar setiap `expenses` bertipe `cash_drawer` otomatis terikat (mengisi `shift_id`) ke shift yang sedang aktif di outlet tersebut. Pengeluaran tipe ini akan otomatis memotong ekspektasi uang kas di laci.

## 3. Fungsi Remote (RPC) untuk Kasir

Mengimplementasikan tiga fungsi utama yang aman (menggunakan *Security Definer* dan pengecekan akses outlet) yang siap dihubungkan ke UI frontend:

1.  **`open_shift(p_outlet_id, p_starting_cash)`**:
    Digunakan saat pagi hari/awal shift. Mengunci outlet dan mencatat sisa Petty Cash laci sebagai saldo awal.
2.  **`get_expected_shift_cash(p_shift_id)`**:
    Mesin kalkulasi yang menjumlahkan: `Saldo Awal + (Total Penjualan Tunai POS dari jam buka s.d sekarang) - Total Petty Cash Laci`. Penjualan dari metode pembayaran QRIS/Card diabaikan.
3.  **`close_shift_blind(p_shift_id, p_actual_cash)`**:
    Fungsi krusial di mana kasir **hanya menyetor angka fisik**. Sistem akan menutup shift, mengalkulasi ekspektasi secara diam-diam, dan mengekspos *variance* (selisih uang hilang/berlebih).

---

## 4. Hasil Validasi

*   **Kompilasi Database**: File migrasi `20260701130000_create_shifts_blind_close.sql` siap untuk dijalankan atau dideploy.
*   **Keamanan (RLS)**: Tabel baru sudah dilindungi RLS sehingga pengguna hanya bisa mengintip atau mengubah data shift di outlet tempat mereka ditugaskan.
*   **Identitas Terpusat**: Menggunakan fungsi `auth.uid()` yang mengarah tepat ke `outlet_staff.id` (sebagaimana dirancang pada unifikasi profil bulan lalu).
