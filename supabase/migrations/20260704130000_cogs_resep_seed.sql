-- resep-seed.sql  (DRAFT v3, review sebelum apply)
-- Sumber: SS COGS SET/cogs-bom-normalized.json (20 produk kartu COGS -> 21 baris resep).
-- Satuan resep_item = SATUAN PEMAKAIAN asli (gram/lembar/cm/pcs), lihat unit-reconciliation.md.
-- Jalankan setelah new-bahan-baku.sql DAN update-plastik-merah-satuan.sql.
-- Idempoten (guard NOT EXISTS + ON CONFLICT).
-- menu_item_ref diverifikasi manual via menu-link-check.sql (2026-07-04):
--   8 produk 'Shawarma X' di card = 'Original X' di POS (nama beda, produk sama) -> di-link.
--   'Suka Drink' di card = 1 kategori dgn 2 rasa (Ice Tea, Orange Jus) = 2 menu terpisah
--     di POS -> dipecah jadi 2 resep (resep sama persis, dikonfirmasi owner 2026-07-04).
--   5 produk (Shawarma Subsidi/Ayam Sedang Subsidi/3x Online Reguler) BELUM ADA menunya
--     di POS (Subsidi&Online sengaja tidak dijual lewat menu internal ini) -> menu_item_ref NULL.
--   Resep tetap dibuat (BOM tersimpan); auto-deduct baru aktif setelah menu dibuat & ref diisi.

BEGIN;

-- ORI AYAM / Shawarma Ayam Sedang  [menu POS: Original Ayam Sedang]  (COGS Rp14.051, 12 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Original Ayam Sedang') LIMIT 1), 'Shawarma Ayam Sedang', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Ayam Sedang' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('AYAM', 100, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 50, 'gram'),
  ('MAYONES', 50, 'gram'),
  ('TUM', 5, 'gram'),
  ('MINYAK SAYUR', 25, 'gram'),
  ('KENTANG', 65, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('GAS 3Kg', 45, 'gram'),
  ('FOIL', 35, 'cm'),
  ('LETTUCE', 60, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Ayam Sedang' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- ORI AYAM / Shawarma Ayam Besar  [menu POS: Original Ayam Besar]  (COGS Rp16.896, 12 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Original Ayam Besar') LIMIT 1), 'Shawarma Ayam Besar', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Ayam Besar' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('AYAM', 125, 'gram'),
  ('KULIT 28', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 40, 'gram'),
  ('MAYONES', 40, 'gram'),
  ('TUM', 10, 'gram'),
  ('MINYAK SAYUR', 25, 'gram'),
  ('KENTANG', 88, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('GAS 3Kg', 45, 'gram'),
  ('FOIL', 40, 'cm'),
  ('LETTUCE', 65, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Ayam Besar' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- ORI AYAM / Shawarma Ayam Jumbo  [menu POS: Original Ayam Jumbo]  (COGS Rp21.130, 12 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Original Ayam Jumbo') LIMIT 1), 'Shawarma Ayam Jumbo', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Ayam Jumbo' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('AYAM', 155, 'gram'),
  ('KULIT 32', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 50, 'gram'),
  ('MAYONES', 50, 'gram'),
  ('TUM', 10, 'gram'),
  ('MINYAK SAYUR', 40, 'gram'),
  ('KENTANG', 140, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('GAS 3Kg', 50, 'gram'),
  ('FOIL', 45, 'cm'),
  ('LETTUCE', 80, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Ayam Jumbo' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- ORI MIX / Shawarma Mix Besar  [menu POS: Original Mix Besar]  (COGS Rp20.480, 13 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Original Mix Besar') LIMIT 1), 'Shawarma Mix Besar', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Mix Besar' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('SAPI', 60, 'gram'),
  ('KULIT 28', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 60, 'gram'),
  ('MAYONES', 60, 'gram'),
  ('TUM', 10, 'gram'),
  ('MINYAK SAYUR', 35, 'gram'),
  ('KENTANG', 150, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('GAS 3Kg', 60, 'gram'),
  ('FOIL', 40, 'cm'),
  ('LETTUCE', 70, 'gram'),
  ('AYAM', 70, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Mix Besar' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- ORI MIX / Shawarma Mix Jumbo  [menu POS: Original Mix Jumbo]  (COGS Rp26.870, 13 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Original Mix Jumbo') LIMIT 1), 'Shawarma Mix Jumbo', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Mix Jumbo' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('SAPI', 120, 'gram'),
  ('KULIT 32', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 60, 'gram'),
  ('MAYONES', 60, 'gram'),
  ('TUM', 10, 'gram'),
  ('MINYAK SAYUR', 35, 'gram'),
  ('KENTANG', 160, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('GAS 3Kg', 60, 'gram'),
  ('FOIL', 50, 'cm'),
  ('LETTUCE', 80, 'gram'),
  ('AYAM', 110, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Mix Jumbo' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- ORI SAPI / Shawarma Sapi Sedang  [menu POS: Original Sapi Sedang]  (COGS Rp16.391, 12 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Original Sapi Sedang') LIMIT 1), 'Shawarma Sapi Sedang', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Sapi Sedang' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('SAPI', 110, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 50, 'gram'),
  ('MAYONES', 50, 'gram'),
  ('TUM', 5, 'gram'),
  ('MINYAK SAYUR', 25, 'gram'),
  ('KENTANG', 70, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('GAS 3Kg', 45, 'gram'),
  ('FOIL', 35, 'cm'),
  ('LETTUCE', 60, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Sapi Sedang' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- ORI SAPI / Shawarma Sapi Besar  [menu POS: Original Sapi Besar]  (COGS Rp18.729, 12 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Original Sapi Besar') LIMIT 1), 'Shawarma Sapi Besar', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Sapi Besar' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('SAPI', 125, 'gram'),
  ('KULIT 28', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 50, 'gram'),
  ('MAYONES', 50, 'gram'),
  ('TUM', 10, 'gram'),
  ('MINYAK SAYUR', 25, 'gram'),
  ('KENTANG', 90, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('GAS 3Kg', 45, 'gram'),
  ('FOIL', 40, 'cm'),
  ('LETTUCE', 70, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Sapi Besar' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- ORI SAPI / Shawarma Sapi Jumbo  [menu POS: Original Sapi Jumbo]  (COGS Rp23.793, 12 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Original Sapi Jumbo') LIMIT 1), 'Shawarma Sapi Jumbo', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Sapi Jumbo' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('SAPI', 170, 'gram'),
  ('KULIT 32', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 60, 'gram'),
  ('MAYONES', 60, 'gram'),
  ('TUM', 10, 'gram'),
  ('MINYAK SAYUR', 35, 'gram'),
  ('KENTANG', 150, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('GAS 3Kg', 60, 'gram'),
  ('FOIL', 45, 'cm'),
  ('LETTUCE', 80, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Sapi Jumbo' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SHAWARMIE / Shawarmie Ayam  [menu POS: Shawarmie Ayam]  (COGS Rp14.722, 10 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Shawarmie Ayam') LIMIT 1), 'Shawarmie Ayam', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarmie Ayam' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('AYAM', 110, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 30, 'gram'),
  ('MIE', 1, 'pcs'),
  ('MINYAK SAYUR', 30, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('LETTUCE', 60, 'gram'),
  ('GAS 3Kg', 50, 'gram'),
  ('FOIL', 35, 'cm'),
  ('PLASTIK MERAH', 1, 'lembar')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarmie Ayam' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SHAWARMIE / Shawarmie Sapi  [menu POS: Shawarmie Sapi]  (COGS Rp16.464, 10 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Shawarmie Sapi') LIMIT 1), 'Shawarmie Sapi', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarmie Sapi' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('SAPI', 120, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 30, 'gram'),
  ('MIE', 1, 'pcs'),
  ('MINYAK SAYUR', 30, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('LETTUCE', 60, 'gram'),
  ('GAS 3Kg', 50, 'gram'),
  ('FOIL', 35, 'cm'),
  ('PLASTIK MERAH', 1, 'lembar')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarmie Sapi' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SUKA DRINK / Suka Drink Ice Tea  [menu POS: Ice Tea]  (COGS Rp4.793, 5 bahan)
-- "Suka Drink" di card = 1 kategori dgn 2 rasa (Ice Tea, Orange Jus) yg jd menu terpisah
-- di POS. Owner konfirmasi (2026-07-04): resep sama persis utk kedua rasa.
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Ice Tea') LIMIT 1), 'Suka Drink Ice Tea', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Suka Drink Ice Tea' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('POWDER MIX', 40, 'gram'),
  ('CUP + TUTUP', 1, 'pcs'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('STIKER', 1, 'lembar'),
  ('ES BATU', 1, 'pcs')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Suka Drink Ice Tea' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SUKA DRINK / Suka Drink Orange Jus  [menu POS: Orange Jus]  (COGS Rp4.793, 5 bahan, sama dgn Ice Tea)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Orange Jus') LIMIT 1), 'Suka Drink Orange Jus', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Suka Drink Orange Jus' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('POWDER MIX', 40, 'gram'),
  ('CUP + TUTUP', 1, 'pcs'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('STIKER', 1, 'lembar'),
  ('ES BATU', 1, 'pcs')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Suka Drink Orange Jus' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SUKA REGULER / Shawarma Subsidi  [!! BELUM ADA MENU POS - menu_item_ref NULL !!]  (COGS Rp10.171, 12 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT NULL, 'Shawarma Subsidi', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Subsidi' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('SAPI', 65, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 30, 'gram'),
  ('MAYONES', 30, 'gram'),
  ('TUM', 3, 'gram'),
  ('MINYAK SAYUR', 20, 'gram'),
  ('KENTANG', 30, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('GAS 3Kg', 30, 'gram'),
  ('FOIL', 35, 'cm'),
  ('LETTUCE', 30, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Subsidi' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SUKA REGULER / Ayam Sedang Subsidi  [!! BELUM ADA MENU POS - menu_item_ref NULL !!]  (COGS Rp9.789, 12 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT NULL, 'Ayam Sedang Subsidi', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Ayam Sedang Subsidi' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('AYAM', 60, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 30, 'gram'),
  ('MAYONES', 30, 'gram'),
  ('TUM', 3, 'gram'),
  ('MINYAK SAYUR', 20, 'gram'),
  ('KENTANG', 30, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('GAS 3Kg', 30, 'gram'),
  ('FOIL', 35, 'cm'),
  ('LETTUCE', 30, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Ayam Sedang Subsidi' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SUKA REGULER ONLINE / Shawarma Online Reguler  [!! BELUM ADA MENU POS - menu_item_ref NULL !!]  (COGS Rp8.308, 8 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT NULL, 'Shawarma Online Reguler', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Online Reguler' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('AYAM', 60, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 40, 'gram'),
  ('TUM', 3, 'gram'),
  ('MINYAK SAYUR', 20, 'gram'),
  ('GAS 3Kg', 30, 'gram'),
  ('PLASTIK VACUM', 1, 'lembar'),
  ('DUS PACKING', 1, 'lembar')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Online Reguler' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SUKA REGULER ONLINE / Shawarma Online Reguler Sapi  [!! BELUM ADA MENU POS - menu_item_ref NULL !!]  (COGS Rp9.115, 8 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT NULL, 'Shawarma Online Reguler Sapi', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Online Reguler Sapi' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('SAPI', 70, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 40, 'gram'),
  ('TUM', 3, 'gram'),
  ('MINYAK SAYUR', 20, 'gram'),
  ('GAS 3Kg', 30, 'gram'),
  ('PLASTIK VACUM', 1, 'lembar'),
  ('DUS PACKING', 1, 'lembar')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Online Reguler Sapi' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SUKA REGULER ONLINE / Shawarma Online Reguler Mix  [!! BELUM ADA MENU POS - menu_item_ref NULL !!]  (COGS Rp9.405, 9 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT NULL, 'Shawarma Online Reguler Mix', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Shawarma Online Reguler Mix' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('SAPI', 30, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 40, 'gram'),
  ('TUM', 3, 'gram'),
  ('MINYAK SAYUR', 20, 'gram'),
  ('GAS 3Kg', 30, 'gram'),
  ('PLASTIK VACUM', 1, 'lembar'),
  ('DUS PACKING', 1, 'lembar'),
  ('AYAM', 50, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Shawarma Online Reguler Mix' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SUKA SUKA / Suka Beef  [menu POS: Suka Beef]  (COGS Rp18.174, 12 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Suka Beef') LIMIT 1), 'Suka Beef', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Suka Beef' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('SAPI', 120, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 60, 'gram'),
  ('MAYONES', 60, 'gram'),
  ('TUM', 10, 'gram'),
  ('MINYAK SAYUR', 25, 'gram'),
  ('KEJU', 2, 'lembar'),
  ('PAPER WRAP', 1, 'lembar'),
  ('LETTUCE', 60, 'gram'),
  ('GAS 3Kg', 60, 'gram'),
  ('FOIL', 40, 'cm'),
  ('PLASTIK MERAH', 1, 'lembar')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Suka Beef' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SUKA SUKA / Suka Chicken  [menu POS: Suka Chicken]  (COGS Rp16.932, 12 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Suka Chicken') LIMIT 1), 'Suka Chicken', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Suka Chicken' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('AYAM', 110, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 60, 'gram'),
  ('MAYONES', 60, 'gram'),
  ('TUM', 10, 'gram'),
  ('MINYAK SAYUR', 25, 'gram'),
  ('KEJU', 2, 'lembar'),
  ('PAPER WRAP', 1, 'lembar'),
  ('LETTUCE', 60, 'gram'),
  ('GAS 3Kg', 60, 'gram'),
  ('FOIL', 40, 'cm'),
  ('PLASTIK MERAH', 1, 'lembar')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Suka Chicken' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SUKA SUKA / Suka Fried Chicken  [menu POS: Suka Fried Chicken]  (COGS Rp17.845, 11 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Suka Fried Chicken') LIMIT 1), 'Suka Fried Chicken', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Suka Fried Chicken' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('AYAM', 120, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 60, 'gram'),
  ('KENTANG', 70, 'gram'),
  ('TEPUNG', 50, 'gram'),
  ('MINYAK SAYUR', 50, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('LETTUCE', 60, 'gram'),
  ('GAS 3Kg', 60, 'gram'),
  ('FOIL', 40, 'cm'),
  ('PLASTIK MERAH', 1, 'lembar')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Suka Fried Chicken' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

-- SUKA SUKA / Suka Samyang  [menu POS: Suka Samyang]  (COGS Rp17.860, 12 bahan)
INSERT INTO resep (menu_item_ref, nama, scope, is_active)
SELECT (SELECT id::text FROM menu_items WHERE lower(btrim(name))=lower('Suka Samyang') LIMIT 1), 'Suka Samyang', 'global', true
WHERE NOT EXISTS (SELECT 1 FROM resep WHERE nama='Suka Samyang' AND scope='global');

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, v.satuan FROM resep r
JOIN (VALUES
  ('AYAM', 120, 'gram'),
  ('KULIT 25', 1, 'lembar'),
  ('SAUS CABE/TOMAT', 60, 'gram'),
  ('KENTANG', 70, 'gram'),
  ('TEPUNG', 50, 'gram'),
  ('MINYAK SAYUR', 50, 'gram'),
  ('PAPER WRAP', 1, 'lembar'),
  ('LETTUCE', 60, 'gram'),
  ('GAS 3Kg', 60, 'gram'),
  ('FOIL', 40, 'cm'),
  ('PLASTIK MERAH', 1, 'lembar'),
  ('SAOS SAMYANG', 70, 'gram')
) AS v(nama, qty, satuan) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.nama='Suka Samyang' AND r.scope='global'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;

COMMIT;

-- Produk TANPA menu_item_ref (menu belum dibuat di POS, isi manual / re-run setelah menu ada):
--   - Shawarma Subsidi
--   - Ayam Sedang Subsidi
--   - Shawarma Online Reguler
--   - Shawarma Online Reguler Sapi
--   - Shawarma Online Reguler Mix