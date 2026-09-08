-- Koreksi kategori petty cash Agustus 2026 (disetujui owner 2026-09-08).
--
-- Lanjutan dari koreksi September. Sebab yang sama: layar kasir tidak punya
-- kategori "Transport", sehingga belanja transport & operasional nyasar ke
-- 'overtime'/'ads' — dua kode yang tidak ikut dihitung, jadi 6 baris ini
-- tidak pernah muncul di Buku Kas maupun halaman Laba.
--
-- Setelah koreksi, total pengeluaran Agustus naik Rp 375.000. Bukan
-- pengeluaran baru: uangnya sudah keluar dari petty cash sejak Agustus dan
-- sudah terhitung di P&L Mitra + Owner Dashboard (yang tidak menyaring
-- kategori). Yang selama ini kurang catat justru Buku Kas & halaman Laba.
--
-- Dikerjakan SEBELUM transfer bagi hasil Agustus (jatuh tempo 10 September;
-- per hari ini mitra_transfers baru berisi Juli), supaya transfer memakai
-- angka biaya yang benar.
--
-- "libur reno raka kekantor" dikonfirmasi owner sebagai Transport.
-- Update menyasar id spesifik, bukan kondisi kategori.

BEGIN;

-- Transport (Rp 125.000)
UPDATE public.petty_cash_expenses SET category = 'transport'
WHERE id = 'f4756cd7-67dc-41d9-b662-0d3668b0b935';  -- 19/08 Ciseeng  "libur reno raka kekantor"     100.000
UPDATE public.petty_cash_expenses SET category = 'transport'
WHERE id = '19d784d1-60aa-4520-9c14-4593f3244947';  -- 26/08 Sentul   "transport riki"                25.000

-- Outlet (Rp 100.000)
UPDATE public.petty_cash_expenses SET category = 'pengeluaran_outlet'
WHERE id = 'ac5428b4-f1ab-4d80-8743-c389b81a09a6';  -- 19/08 Paledang "duplikat kunci cicurug 4kunci" 100.000

-- Overtime (Rp 150.000)
UPDATE public.petty_cash_expenses SET category = 'lembur'
WHERE id = 'cc845006-2abc-4664-8343-22f20c2b8187';  -- 19/08 Cibinong "lembaran daut kemarin tgl 18"   50.000
UPDATE public.petty_cash_expenses SET category = 'lembur'
WHERE id = '03c43bab-74bc-4808-a86b-259a55be1a99';  -- 19/08 Cibinong "lembaran omset (daut)"          50.000
UPDATE public.petty_cash_expenses SET category = 'lembur'
WHERE id = '970eecae-e6e9-4bf3-b2d9-8edc3c34b03a';  -- 19/08 Cimanggu "lembur AM"                      50.000

COMMIT;
