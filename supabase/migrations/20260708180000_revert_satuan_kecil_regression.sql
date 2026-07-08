-- 20260708180000_revert_satuan_kecil_regression.sql
-- REVERT regresi dari 20260708172000_fix_satuan_kecil_typos.sql.
--
-- Migration itu (dan scratch_query_materials.cjs) MENGIRA satuan_kecil SAPI/
-- MINYAK SAYUR/GAS 3Kg salah ketik, lalu menimpanya jadi 'gram'/'ml' agar cocok
-- dengan faktor_konversi (BOM). Itu KELIRU: satuan_kecil sengaja dipasangkan
-- dengan faktor_tampilan (bukan faktor_konversi) untuk tampilan majemuk saldo &
-- input opname 2-field di apps/stok (lihat 20260704210000 & 20260706100000,
-- COMMENT kolom menyatakan satuan_kecil/faktor_tampilan INDEPENDEN dari
-- faktor_konversi).
--
-- Efek regresi: OpnameForm melabeli field sisa 'gram'/'ml' tapi combineOpnameInput
-- tetap membagi dengan faktor_tampilan (kg/liter) -> qty_fisik salah ~1000x dan
-- opname_selisih ledger jadi hantu. Tampilan monitoring/ledger juga salah label.
--
-- Kembalikan ke nilai kanonik (dikonfirmasi owner di sesi COGS 2026-07-04).
-- Set satuan_kecil DAN faktor_tampilan sekaligus agar migration ini otoritatif
-- dan idempoten, apa pun state DB sebelumnya.

UPDATE bahan_baku SET satuan_kecil = 'kg',    faktor_tampilan = 2  WHERE nama = 'SAPI';
UPDATE bahan_baku SET satuan_kecil = 'liter', faktor_tampilan = 16 WHERE nama = 'MINYAK SAYUR';
UPDATE bahan_baku SET satuan_kecil = 'kg',    faktor_tampilan = 3  WHERE nama = 'GAS 3Kg';
