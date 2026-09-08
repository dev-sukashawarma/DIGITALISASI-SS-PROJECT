-- Koreksi kategori petty cash September 2026 (disetujui owner 2026-09-08).
--
-- Konteks: layar kasir dulu hanya menyediakan 3 kategori dan tidak punya
-- "Transport", sehingga belanja transport/operasional nyasar ke 'overtime'
-- dan 'ads'. Dua kode itu tidak ada di allowlist perhitungan, jadi 8 baris
-- ini tidak pernah muncul di Buku Kas maupun ikut dihitung sebagai biaya.
--
-- Setelah koreksi, ketiga kategori tujuan (pengeluaran_outlet, transport,
-- lembur) sudah masuk allowlist, jadi total pengeluaran September naik
-- Rp 421.000 — bukan pengeluaran baru, melainkan uang yang memang sudah
-- keluar dari petty cash dan selama ini tidak tercatat di laporan.
--
-- Baris Agustus SENGAJA tidak disentuh di skrip ini (ditinjau terpisah).
-- Update menyasar id spesifik, bukan kondisi kategori, supaya tidak ada
-- baris lain yang ikut terbawa.

BEGIN;

-- Transport (Rp 107.000)
UPDATE public.petty_cash_expenses SET category = 'transport'
WHERE id = '211dea53-0e63-4cad-8295-e573cee737ad';  -- 01/09 Ciseeng  "transport yunus"    25.000
UPDATE public.petty_cash_expenses SET category = 'transport'
WHERE id = '44878612-c288-4cc6-a8e2-71f1c5bf86d6';  -- 05/09 Sentul   "transport ricki"    50.000
UPDATE public.petty_cash_expenses SET category = 'transport'
WHERE id = 'ef53df0c-4153-4057-ae1f-da6e2b148442';  -- 05/09 Sentul   "driver lalamove"    32.000

-- Outlet (Rp 214.000)
UPDATE public.petty_cash_expenses SET category = 'pengeluaran_outlet'
WHERE id = 'bc7996d6-f1f3-47b8-a8c8-f71627f9ef65';  -- 01/09 Ciseeng  "tissu"              17.000
UPDATE public.petty_cash_expenses SET category = 'pengeluaran_outlet'
WHERE id = 'e214cfea-e615-4e77-a49b-f62017b21d63';  -- 01/09 Ciseeng  "gas tabung 4"       92.000
UPDATE public.petty_cash_expenses SET category = 'pengeluaran_outlet'
WHERE id = 'b77ec3d1-1451-4499-871c-fd047c039a72';  -- 03/09 Cirendeu "uang makan training" 105.000

-- Overtime (Rp 100.000)
UPDATE public.petty_cash_expenses SET category = 'lembur'
WHERE id = '4d02e4fa-c3a4-4bb3-9b4b-f9f397f3d9d7';  -- 02/09 Sentul   "lembur umam"        50.000
UPDATE public.petty_cash_expenses SET category = 'lembur'
WHERE id = 'b3d73600-5da8-4ed9-9e19-6e85a8bca9ec';  -- 04/09 Paledang "lembur omset"       50.000

COMMIT;
