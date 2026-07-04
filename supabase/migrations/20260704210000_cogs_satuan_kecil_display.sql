-- 20260704210000_cogs_satuan_kecil_display.sql
-- Kolom tampilan majemuk (independen dari faktor_konversi yang dipakai BOM automation).
-- satuan_kecil/faktor_tampilan dipakai UI untuk pecah saldo jadi "N {satuan} + M {satuan_kecil}"
-- dan input opname 2-field (kontainer utuh + sisa perkiraan).
--
-- Kenapa terpisah dari faktor_konversi: MINYAK SAYUR dihitung BOM dalam GRAM
-- (asumsi densitas 1L~1kg), tapi crew fisik mengukur sisa minyak dalam LITER,
-- bukan gram. Dua kebutuhan (kalkulasi resep vs tampilan fisik) butuh satuan berbeda.

ALTER TABLE bahan_baku
  ADD COLUMN IF NOT EXISTS satuan_kecil TEXT
    CHECK (satuan_kecil IS NULL OR satuan_kecil IN ('liter','ml','gram','cm','lembar')),
  ADD COLUMN IF NOT EXISTS faktor_tampilan NUMERIC
    CHECK (faktor_tampilan IS NULL OR faktor_tampilan > 0);

COMMENT ON COLUMN bahan_baku.satuan_kecil IS
  'Satuan kecil untuk tampilan majemuk saldo (mis. liter untuk kompan, cm untuk roll). NULL = tidak berlaku, tampil apa adanya.';
COMMENT ON COLUMN bahan_baku.faktor_tampilan IS
  'Berapa satuan_kecil setara 1 satuan (satuan stok utama). Independen dari faktor_konversi (itu utk BOM/resep).';

UPDATE bahan_baku SET satuan_kecil = 'liter', faktor_tampilan = 16 WHERE nama = 'MINYAK SAYUR';
UPDATE bahan_baku SET satuan_kecil = 'cm', faktor_tampilan = 760 WHERE nama = 'FOIL';
