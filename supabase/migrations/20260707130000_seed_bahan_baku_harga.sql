-- 20260707130000_seed_bahan_baku_harga.sql
-- Seed harga beli per bahan ke bahan_baku_harga (kosong sejak dibuat di 20260630120000).
-- Sumber: SS COGS SET/cogs-bom-normalized.csv (harga per kemasan yang tertera).
-- Disimpan per SATUAN-BELI: harga_store = ROUND(csv_harga / csv_isi_kemasan × faktor_konversi),
-- supaya (harga_beli / faktor_konversi) = harga per satuan-pakai (reproduksi subtotal kartu).
-- Idempoten (ON CONFLICT). Aditif, admin-only (RLS existing tak diubah).
-- Duplikat harga di CSV diresolusi: PLASTIK MERAH=200/lembar, SAPI=100000/blok.

INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli, harga_updated_at)
SELECT bb.id,
       ROUND( (v.csv_harga::numeric / v.csv_isi) * bb.faktor_konversi ),
       now()
FROM (VALUES
  ('AYAM',            47800, 1000),
  ('CUP + TUTUP',      1650, 1),
  ('DUS PACKING',      1300, 1),
  ('ES BATU',         25000, 62),
  ('FOIL',            11800, 750),
  ('GAS 3Kg',         23000, 3000),
  ('KEJU',            12000, 10),
  ('KENTANG',         24000, 1000),
  ('KULIT 25',        27000, 20),
  ('KULIT 28',        32000, 20),
  ('KULIT 32',        38000, 20),
  ('LETTUCE',         28000, 1000),
  ('MAYONES',         22000, 1000),
  ('MIE',              3000, 1),
  ('MINYAK SAYUR',    23000, 1000),
  ('PAPER WRAP',        160, 1),
  ('PLASTIK MERAH',     200, 1),
  ('PLASTIK VACUM',     700, 1),
  ('POWDER MIX',      56000, 1000),
  ('SAOS SAMYANG',    14500, 1000),
  ('SAPI',           100000, 2000),
  ('SAUS CABE/TOMAT', 15000, 1000),
  ('STIKER',            400, 1),
  ('TEPUNG',          18000, 1000),
  ('TUM',            100000, 1000)
) AS v(nama, csv_harga, csv_isi)
JOIN bahan_baku bb ON bb.nama = v.nama
ON CONFLICT (bahan_baku_id)
DO UPDATE SET harga_beli = EXCLUDED.harga_beli, harga_updated_at = now();

-- DOWN:
-- DELETE FROM bahan_baku_harga;
