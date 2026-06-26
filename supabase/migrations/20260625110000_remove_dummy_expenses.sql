-- 20260625110000_remove_dummy_expenses.sql
-- Hapus seluruh data pengeluaran DUMMY yang di-seed oleh migration
-- 20260619100300_create_expenses.sql (gaji/bahan baku/sewa/utilitas/operasional/
-- lain-lain karangan untuk 19 outlet, April–Juni 2026).
--
-- Di-target lewat deskripsi seed agar tidak menghapus pengeluaran ASLI yang
-- mungkin dimasukkan kemudian. Idempotent — aman dijalankan ulang.

DELETE FROM public.expenses
WHERE description IN (
  'Pembayaran Gaji Karyawan Outlet Bulanan',
  'Belanja Bulanan Bahan Baku Utama (Daging, Sayur, Roti, Saus)',
  'Tagihan Listrik, Air, Gas, dan Internet Outlet',
  'Biaya Sewa Tempat Outlet Bulanan',
  'Pengeluaran Kebersihan, Keamanan, dan Logistik Harian',
  'Biaya darurat atau pengeluaran tak terduga'
);
