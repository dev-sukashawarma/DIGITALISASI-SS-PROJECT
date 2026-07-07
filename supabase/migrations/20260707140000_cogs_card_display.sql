-- 20260707140000_cogs_card_display.sql
-- Menyimpan istilah pembelian asli (kartu COGS) + buffer "Loss" per resep + catatan,
-- supaya kartu HPP di admin-dashboard bisa tampil PERSIS seperti kartu COGS fisik
-- (kolom HARGA BELI / ISI KEMASAN + baris Loss + COGS total).
-- Terpisah dari bahan_baku_harga.harga_beli (yang per satuan-beli utk valuasi inventory).
-- Aditif & idempoten.

-- 1. Kolom display pembelian di bahan_baku_harga.
ALTER TABLE bahan_baku_harga
  ADD COLUMN IF NOT EXISTS harga_beli_display NUMERIC,
  ADD COLUMN IF NOT EXISTS kemasan_qty        NUMERIC,
  ADD COLUMN IF NOT EXISTS kemasan_satuan     TEXT;

UPDATE bahan_baku_harga h
SET harga_beli_display = v.harga,
    kemasan_qty        = v.isi,
    kemasan_satuan     = v.satuan
FROM (VALUES
  ('AYAM',            47800, 1000, 'gram'),
  ('CUP + TUTUP',      1650, 1,    'pcs'),
  ('DUS PACKING',      1300, 1,    'lembar'),
  ('ES BATU',         25000, 62,   'pcs'),
  ('FOIL',            11800, 750,  'cm'),
  ('GAS 3Kg',         23000, 3000, 'gram'),
  ('KEJU',            12000, 10,   'lembar'),
  ('KENTANG',         24000, 1000, 'gram'),
  ('KULIT 25',        27000, 20,   'lembar'),
  ('KULIT 28',        32000, 20,   'lembar'),
  ('KULIT 32',        38000, 20,   'lembar'),
  ('LETTUCE',         28000, 1000, 'gram'),
  ('MAYONES',         22000, 1000, 'gram'),
  ('MIE',              3000, 1,    'pcs'),
  ('MINYAK SAYUR',    23000, 1000, 'gram'),
  ('PAPER WRAP',        160, 1,    'lembar'),
  ('PLASTIK MERAH',     200, 1,    'lembar'),
  ('PLASTIK VACUM',     700, 1,    'lembar'),
  ('POWDER MIX',      56000, 1000, 'gram'),
  ('SAOS SAMYANG',    14500, 1000, 'gram'),
  ('SAPI',           100000, 2000, 'gram'),
  ('SAUS CABE/TOMAT', 15000, 1000, 'gram'),
  ('STIKER',            400, 1,    'lembar'),
  ('TEPUNG',          18000, 1000, 'gram'),
  ('TUM',            100000, 1000, 'gram')
) AS v(nama, harga, isi, satuan)
JOIN bahan_baku bb ON bb.nama = v.nama
WHERE h.bahan_baku_id = bb.id;

-- 2. Buffer "Loss" per resep + catatan.
ALTER TABLE resep
  ADD COLUMN IF NOT EXISTS buffer_amount NUMERIC NOT NULL DEFAULT 0 CHECK (buffer_amount >= 0),
  ADD COLUMN IF NOT EXISTS catatan       TEXT;

UPDATE resep r
SET buffer_amount = v.buf
FROM (VALUES
  ('Shawarma Ayam Sedang',        500),
  ('Shawarma Ayam Besar',        1000),
  ('Shawarma Ayam Jumbo',        1000),
  ('Shawarma Mix Besar',         1500),
  ('Shawarma Mix Jumbo',         2000),
  ('Shawarma Sapi Sedang',       2000),
  ('Shawarma Sapi Besar',        2000),
  ('Shawarma Sapi Jumbo',        2000),
  ('Shawarmie Ayam',             1000),
  ('Shawarmie Sapi',             2000),
  ('Suka Beef',                  1500),
  ('Suka Chicken',               1000),
  ('Suka Fried Chicken',         3000),
  ('Suka Samyang',               2000),
  ('Shawarma Subsidi',           1000),
  ('Ayam Sedang Subsidi',        1000),
  ('Shawarma Online Reguler',     500),
  ('Shawarma Online Reguler Mix', 500),
  ('Shawarma Online Reguler Sapi',500)
) AS v(nama, buf)
WHERE r.nama = v.nama AND r.scope = 'global';

-- DOWN:
-- ALTER TABLE resep DROP COLUMN IF EXISTS buffer_amount, DROP COLUMN IF EXISTS catatan;
-- ALTER TABLE bahan_baku_harga
--   DROP COLUMN IF EXISTS harga_beli_display,
--   DROP COLUMN IF EXISTS kemasan_qty,
--   DROP COLUMN IF EXISTS kemasan_satuan;
