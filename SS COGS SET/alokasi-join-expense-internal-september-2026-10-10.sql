-- ARSIP — SUDAH DIJALANKAN 2026-10-10. JANGAN DIJALANKAN ULANG.
-- Penyesuaian Join Expense September 2026:
-- 1. Total Join Expense September = Rp 90.625.733.
-- 2. Join Expense hanya dibebankan ke 11 outlet internal:
--    - SUKA SHAWARMA BEJI: Rp 8.238.703
--    - SUKA SHAWARMA BNR: Rp 8.238.703
--    - SUKA SHAWARMA CIMANGGU: Rp 8.238.703
--    - SUKA SHAWARMA CIRENDEU: Rp 8.238.703
--    - SUKA SHAWARMA DEPOK SUKMAJAYA: Rp 8.238.703
--    - SUKA SHAWARMA DRAMAGA: Rp 8.238.703
--    - SUKA SHAWARMA EMPANG: Rp 8.238.703
--    - SUKA SHAWARMA JAGAKARSA: Rp 8.238.703
--    - SUKA SHAWARMA JATIWARINGIN: Rp 8.238.703
--    - SUKA SHAWARMA PAJAJARAN: Rp 8.238.703
--    - SUKA SHAWARMA SAWANGAN (INTERNAL): Rp 8.238.703
-- 3. Seluruh 9 outlet mitra dibebaskan dari Join Expense (Rp 0).
-- 4. Outlet internal nonaktif Jatiasih dibebaskan dari Join Expense (Rp 0).

BEGIN;

-- 11 Baris Join Expense di tabel expenses di-update menjadi Rp 8.238.703.
-- 10 Baris Join Expense lainnya (9 mitra + 1 Jatiasih) dihapus dari expenses.

COMMIT;
