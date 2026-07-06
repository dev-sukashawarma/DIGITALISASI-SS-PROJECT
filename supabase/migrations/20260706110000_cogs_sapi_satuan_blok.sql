-- 20260706110000_cogs_sapi_satuan_blok.sql
-- SAPI dicatat satuan besar 'pcs' sejak awal, tapi ini rancu -- 'pcs' generik
-- tidak menjelaskan bahwa 1 unit = 1 potong/blok daging sapi utuh (~2 kg).
-- Ganti ke 'blok' yang lebih jelas. Murni perubahan label/tampilan --
-- faktor_konversi (2000 gram/blok, dipakai BOM) dan satuan_kecil/faktor_tampilan
-- (kg/2, dipakai tampilan majemuk sejak 20260706100000) TIDAK berubah.
--
-- 'pcs' TETAP valid untuk bahan lain (PAPER WRAP, GAS 3Kg, PLASTIK VACUM,
-- CUP+TUTUP, DUS PACKING, ES BATU, MIE, STIKER, FOIL) -- constraint diperluas
-- (ADD), bukan diganti.

-- Dicari via conkey (kolom persis 'satuan'), BUKAN pencocokan teks definisi --
-- pola LIKE '%satuan%' akan ambigu karena 'satuan_kecil' juga mengandung kata
-- 'satuan', dan Postgres kadang merender "IN (...)" jadi "= ANY (ARRAY[...])"
-- di pg_get_constraintdef sehingga pencocokan teks literal tidak selalu cocok.
DO $$
DECLARE
  c_name text;
  satuan_attnum smallint;
BEGIN
  SELECT attnum INTO satuan_attnum
  FROM pg_attribute
  WHERE attrelid = 'bahan_baku'::regclass AND attname = 'satuan';

  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'bahan_baku'::regclass
    AND contype = 'c'
    AND conkey = ARRAY[satuan_attnum];

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE bahan_baku DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE bahan_baku ADD CONSTRAINT bahan_baku_satuan_check
  CHECK (satuan IN ('kg','gram','liter','ml','pcs','box','pack','ikat','botol','crt','kompan','blok'));

UPDATE bahan_baku SET satuan = 'blok' WHERE nama = 'SAPI';
