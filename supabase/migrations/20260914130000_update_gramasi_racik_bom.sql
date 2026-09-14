-- =============================================================================
-- 20260914130000_update_gramasi_racik_bom.sql
-- =============================================================================
-- Sumber: GRAMASI RACIK SS.xlsx — dikonfirmasi owner 14 Sep 2026
-- Scope:
--   BAGIAN 1 : Tambah bahan baku SAUS CABE dan SAUS TOMAT (terpisah)
--   BAGIAN 2 : Update qty_per_porsi resep OFFLINE (14 resep)
--              + ganti baris SAUS CABE/TOMAT gabungan → 2 baris terpisah
--              + update Best Seller (ikut Mix Jumbo & Sapi Jumbo)
--   BAGIAN 3 : Tambah 11 resep baru untuk channel SS Online & TikTok Go
-- Idempoten: ON CONFLICT DO NOTHING / guard NOT EXISTS / ON CONFLICT DO UPDATE
-- =============================================================================

BEGIN;

-- =============================================================================
-- BAGIAN 1 — BAHAN BAKU BARU
-- =============================================================================
-- SAUS CABE dan SAUS TOMAT sebagai entri terpisah (satuan kg, sama dengan
-- SAUS CABE/TOMAT yang lama). Entri lama TIDAK dihapus / dinon-aktifkan
-- karena masih dipakai resep lain (Subsidi, Online Reguler lama, dll.).

INSERT INTO public.bahan_baku (nama, satuan, kategori, default_reorder_point)
VALUES
  ('SAUS CABE',  'kg', 'bumbu', 10),
  ('SAUS TOMAT', 'kg', 'bumbu', 10)
ON CONFLICT (nama) DO NOTHING;

-- =============================================================================
-- BAGIAN 2 — UPDATE RESEP OFFLINE
-- =============================================================================
-- Strategi per resep:
--   a) UPDATE qty bahan yang berubah (SAPI/AYAM/KENTANG/LETTUCE/MAYONAISE/TUM)
--   b) DELETE baris SAUS CABE/TOMAT (gabungan)
--   c) INSERT 2 baris terpisah SAUS CABE + SAUS TOMAT
--      (ON CONFLICT DO NOTHING agar idempoten)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- 2.1  Shawarma Sapi Sedang
--      Sapi: 110→90  Kentang: 70→45  Lettuce: 60→50  TUM: 5→10
--      Saus: pisah 25+25  Mayonaise: 50 (tetap)
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('SAPI',      90),
  ('KENTANG',   45),
  ('LETTUCE',   50),
  ('MAYONAISE', 50),
  ('TUM',       10)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarma Sapi Sedang' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarma Sapi Sedang' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 25), ('SAUS TOMAT', 25)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Sapi Sedang' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.2  Shawarma Ayam Sedang
--      Ayam: 100→80  Kentang: 65→50  Lettuce: 60→50  TUM: 5→10
--      Saus: pisah 25+25  Mayonaise: 50 (tetap)
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('AYAM',      80),
  ('KENTANG',   50),
  ('LETTUCE',   50),
  ('MAYONAISE', 50),
  ('TUM',       10)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarma Ayam Sedang' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarma Ayam Sedang' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 25), ('SAUS TOMAT', 25)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Ayam Sedang' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.3  Suka Beef
--      Sapi: 120→100  Mayonaise: 60→25  TUM: 10 (tetap)
--      Saus: pisah 25+25
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('SAPI',      100),
  ('MAYONAISE',  25),
  ('TUM',        10)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Suka Beef' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Suka Beef' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 25), ('SAUS TOMAT', 25)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Suka Beef' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.4  Suka Chicken
--      Ayam: 110→105  Mayonaise: 60→25  TUM: 10 (tetap)
--      Saus: pisah 25+25
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('AYAM',       105),
  ('MAYONAISE',   25),
  ('TUM',         10)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Suka Chicken' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Suka Chicken' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 25), ('SAUS TOMAT', 25)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Suka Chicken' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.5  Suka Samyang
--      Ayam: 120→90  Kentang: 70→60  Lettuce: 60→40
--      Mayonaise: -(remove saus gabungan, tambah 25gr) TUM: 10 (tum putih)
--      Catatan: saus cabe/tomat diganti SAOS SAMYANG 25gr (sudah ada)
--      Tidak ada SAUS TOMAT di resep samyang
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('AYAM',         90),
  ('KENTANG',      60),
  ('LETTUCE',      40),
  ('SAOS SAMYANG', 25),
  ('TUM',          10)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Suka Samyang' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

-- Hapus SAUS CABE/TOMAT gabungan dari resep Samyang
DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Suka Samyang' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

-- Tambah MAYONAISE (25gr) ke Samyang — sebelumnya tidak ada di resep lama
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, 25, 'gram'
FROM public.resep r
JOIN public.bahan_baku bb ON bb.nama = 'MAYONAISE'
WHERE r.nama = 'Suka Samyang' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = 25;

-- ─────────────────────────────────────────────────────────────
-- 2.6  Suka Fried Chicken
--      Ayam: 120→90  Kentang: 70→60  Lettuce: 60→40
--      Saus: pisah 25+25  Mayonaise: tambah 25gr  TUM: tambah 10gr (tum putih)
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('AYAM',    90),
  ('KENTANG', 60),
  ('LETTUCE', 40)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Suka Fried Chicken' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Suka Fried Chicken' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 25), ('SAUS TOMAT', 25), ('MAYONAISE', 25), ('TUM', 10)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Suka Fried Chicken' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.7  Shawarmie Sapi
--      Sapi: 120→90  TUM: 5→10
--      Saus: pisah 25+25  Mayonaise: tambah 25gr
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('SAPI', 90),
  ('TUM',  10)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarmie Sapi' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarmie Sapi' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 25), ('SAUS TOMAT', 25), ('MAYONAISE', 25)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarmie Sapi' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.8  Shawarmie Ayam
--      Ayam: 110→75  TUM: 5→10
--      Saus: pisah 25+25  Mayonaise: tambah 25gr
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('AYAM', 75),
  ('TUM',  10)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarmie Ayam' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarmie Ayam' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 25), ('SAUS TOMAT', 25), ('MAYONAISE', 25)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarmie Ayam' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.9  Shawarma Sapi Besar
--      Sapi: 125→115  Kentang: 90→80  Lettuce: 70→65
--      TUM: 10→15  Saus: pisah 30+30  Mayonaise: 50 (tetap)
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('SAPI',      115),
  ('KENTANG',    80),
  ('LETTUCE',    65),
  ('MAYONAISE',  50),
  ('TUM',        15)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarma Sapi Besar' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarma Sapi Besar' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 30), ('SAUS TOMAT', 30)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Sapi Besar' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.10  Shawarma Ayam Besar
--       Ayam: 125→120  Kentang: 88→50  Lettuce: 65→60
--       TUM: 10→15  Saus: pisah 30+30  Mayonaise: 40→35
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('AYAM',      120),
  ('KENTANG',    50),
  ('LETTUCE',    60),
  ('MAYONAISE',  35),
  ('TUM',        15)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarma Ayam Besar' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarma Ayam Besar' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 30), ('SAUS TOMAT', 30)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Ayam Besar' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.11  Shawarma Mix Besar
--       Sapi: 60→70  Kentang: 150→70  Lettuce: 70→60
--       TUM: 10→15  Saus: pisah 30+30  Mayonaise: 60→50
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('SAPI',      70),
  ('KENTANG',   70),
  ('LETTUCE',   60),
  ('MAYONAISE', 50),
  ('TUM',       15)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarma Mix Besar' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarma Mix Besar' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 30), ('SAUS TOMAT', 30)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Mix Besar' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.12  Shawarma Mix Jumbo
--       Sapi: 120→105  Ayam: 110→80  Kentang: 160→90  Lettuce: 80→90
--       TUM: 10→20  Saus: pisah 35+35  Mayonaise: 60 (tetap)
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('SAPI',      105),
  ('AYAM',       80),
  ('KENTANG',    90),
  ('LETTUCE',    90),
  ('MAYONAISE',  60),
  ('TUM',        20)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarma Mix Jumbo' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarma Mix Jumbo' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 35), ('SAUS TOMAT', 35)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Mix Jumbo' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.13  Shawarma Ayam Jumbo
--       Ayam: 155→140  Kentang: 140→100  Lettuce: 80→90
--       TUM: 10→20  Saus: pisah 35+35  Mayonaise: 50→40
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('AYAM',      140),
  ('KENTANG',   100),
  ('LETTUCE',    90),
  ('MAYONAISE',  40),
  ('TUM',        20)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarma Ayam Jumbo' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarma Ayam Jumbo' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 35), ('SAUS TOMAT', 35)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Ayam Jumbo' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.14  Shawarma Sapi Jumbo
--       Sapi: 170→120  Kentang: 150→120  Lettuce: 80→90
--       TUM: 10→20  Saus: pisah 35+35  Mayonaise: 60 (tetap)
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('SAPI',      120),
  ('KENTANG',   120),
  ('LETTUCE',    90),
  ('MAYONAISE',  60),
  ('TUM',        20)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarma Sapi Jumbo' AND r.scope = 'global' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarma Sapi Jumbo' AND scope='global' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 35), ('SAUS TOMAT', 35)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Sapi Jumbo' AND r.scope = 'global' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.15  Best Seller Mix Jumbo — ikut Shawarma Mix Jumbo (konfirmasi owner)
--       Sapi: 120→105  Ayam: 110→80  Kentang: 160→90  Lettuce: 80→90
--       TUM: 10→20  Saus: pisah 35+35  Mayonaise: 60 (tetap)
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('SAPI',      105),
  ('AYAM',       80),
  ('KENTANG',    90),
  ('LETTUCE',    90),
  ('MAYONAISE',  60),
  ('TUM',        20)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarma Best Seller Mix Jumbo' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarma Best Seller Mix Jumbo' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 35), ('SAUS TOMAT', 35)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Best Seller Mix Jumbo' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─────────────────────────────────────────────────────────────
-- 2.16  Best Seller 2 (Sapi Jumbo) — ikut Shawarma Sapi Jumbo (konfirmasi owner)
--       Sapi: 170→120  Kentang: 150→120  Lettuce: 80→90
--       TUM: 10→20  Saus: pisah 35+35  Mayonaise: 60 (tetap)
-- ─────────────────────────────────────────────────────────────
UPDATE public.resep_item ri
SET qty_per_porsi = v.qty
FROM (VALUES
  ('SAPI',      120),
  ('KENTANG',   120),
  ('LETTUCE',    90),
  ('MAYONAISE',  60),
  ('TUM',        20)
) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
JOIN public.resep r ON r.nama = 'Shawarma Best Seller 2 (Sapi Jumbo)' AND r.is_active
WHERE ri.resep_id = r.id AND ri.bahan_baku_id = bb.id;

DELETE FROM public.resep_item
WHERE resep_id = (SELECT id FROM public.resep WHERE nama='Shawarma Best Seller 2 (Sapi Jumbo)' AND is_active LIMIT 1)
  AND bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama='SAUS CABE/TOMAT' LIMIT 1);

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, 'gram'
FROM public.resep r
CROSS JOIN (VALUES ('SAUS CABE', 35), ('SAUS TOMAT', 35)) AS v(nama, qty)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Best Seller 2 (Sapi Jumbo)' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- =============================================================================
-- BAGIAN 3 — RESEP ONLINE BARU (SS Online & TikTok Go)
-- =============================================================================
-- scope = 'global', menu_item_ref = NULL (diisi manual setelah menu online dibuat)
-- Packaging sama dengan offline (kulit, foil, plastik, paper wrap, gas)
-- Satuan foil = cm, kulit/paper/plastik = lembar, gas = gram, bahan isi = gram
-- Kulit default KULIT 25 untuk semua ukuran online (konfirmasi jika beda)
-- =============================================================================

-- Insert resep header Online — guard NOT EXISTS per nama (resep tidak punya UNIQUE(nama))
INSERT INTO public.resep (nama, scope, is_active, catatan)
SELECT nama, 'global', true, 'Channel SS Online & TikTok Go — gramasi per GRAMASI RACIK SS.xlsx 14-Sep-2026'
FROM (VALUES
  ('Shawarma Sapi Online Regular'),
  ('Shawarma Sapi Online Sedang'),
  ('Shawarma Sapi Online Besar'),
  ('Shawarma Sapi Online Jumbo'),
  ('Shawarma Ayam Online Regular'),
  ('Shawarma Ayam Online Sedang'),
  ('Shawarma Ayam Online Besar'),
  ('Shawarma Ayam Online Jumbo'),
  ('Shawarma Mix Online Regular'),
  ('Shawarma Mix Online Besar'),
  ('Shawarma Mix Online Jumbo')
) AS v(nama)
WHERE NOT EXISTS (
  SELECT 1 FROM public.resep r WHERE r.nama = v.nama AND r.scope = 'global' AND r.is_active
);

-- ─── Macro helper: insert resep_item baris per baris ─────────
-- Dipakai berulang per produk. Masing-masing INSERT per resep di bawah.

-- ─── 3.1  Shawarma Sapi Online Regular ─────────────────────
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, v.sat
FROM public.resep r
CROSS JOIN (VALUES
  ('SAPI',         40,  'gram'),
  ('KENTANG',      20,  'gram'),
  ('LETTUCE',      25,  'gram'),
  ('SAUS CABE',    20,  'gram'),
  ('SAUS TOMAT',   25,  'gram'),
  ('MAYONAISE',    25,  'gram'),
  ('TUM',          10,  'gram'),
  ('KULIT 25',      1,  'lembar'),
  ('FOIL',         35,  'cm'),
  ('PAPER WRAP',    1,  'lembar'),
  ('PLASTIK MERAH', 1,  'lembar'),
  ('GAS 3Kg',      30,  'gram')
) AS v(nama, qty, sat)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Sapi Online Regular' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─── 3.2  Shawarma Sapi Online Sedang ───────────────────────
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, v.sat
FROM public.resep r
CROSS JOIN (VALUES
  ('SAPI',         60,  'gram'),
  ('KENTANG',      30,  'gram'),
  ('LETTUCE',      35,  'gram'),
  ('SAUS CABE',    25,  'gram'),
  ('SAUS TOMAT',   25,  'gram'),
  ('MAYONAISE',    35,  'gram'),
  ('TUM',          10,  'gram'),
  ('KULIT 25',      1,  'lembar'),
  ('FOIL',         35,  'cm'),
  ('PAPER WRAP',    1,  'lembar'),
  ('PLASTIK MERAH', 1,  'lembar'),
  ('GAS 3Kg',      35,  'gram')
) AS v(nama, qty, sat)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Sapi Online Sedang' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─── 3.3  Shawarma Sapi Online Besar ────────────────────────
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, v.sat
FROM public.resep r
CROSS JOIN (VALUES
  ('SAPI',         80,  'gram'),
  ('KENTANG',      35,  'gram'),
  ('LETTUCE',      40,  'gram'),
  ('SAUS CABE',    25,  'gram'),
  ('SAUS TOMAT',   25,  'gram'),
  ('MAYONAISE',    35,  'gram'),
  ('TUM',          10,  'gram'),
  ('KULIT 28',      1,  'lembar'),
  ('FOIL',         40,  'cm'),
  ('PAPER WRAP',    1,  'lembar'),
  ('PLASTIK MERAH', 1,  'lembar'),
  ('GAS 3Kg',      40,  'gram')
) AS v(nama, qty, sat)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Sapi Online Besar' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─── 3.4  Shawarma Sapi Online Jumbo ────────────────────────
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, v.sat
FROM public.resep r
CROSS JOIN (VALUES
  ('SAPI',         100, 'gram'),
  ('KENTANG',       50, 'gram'),
  ('LETTUCE',       60, 'gram'),
  ('SAUS CABE',     25, 'gram'),
  ('SAUS TOMAT',    25, 'gram'),
  ('MAYONAISE',     50, 'gram'),
  ('TUM',           10, 'gram'),
  ('KULIT 32',       1, 'lembar'),
  ('FOIL',          45, 'cm'),
  ('PAPER WRAP',     1, 'lembar'),
  ('PLASTIK MERAH',  1, 'lembar'),
  ('GAS 3Kg',       45, 'gram')
) AS v(nama, qty, sat)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Sapi Online Jumbo' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─── 3.5  Shawarma Ayam Online Regular ──────────────────────
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, v.sat
FROM public.resep r
CROSS JOIN (VALUES
  ('AYAM',         35,  'gram'),
  ('KENTANG',      20,  'gram'),
  ('LETTUCE',      20,  'gram'),
  ('SAUS CABE',    20,  'gram'),
  ('SAUS TOMAT',   25,  'gram'),
  ('MAYONAISE',    20,  'gram'),
  ('TUM',          10,  'gram'),
  ('KULIT 25',      1,  'lembar'),
  ('FOIL',         35,  'cm'),
  ('PAPER WRAP',    1,  'lembar'),
  ('PLASTIK MERAH', 1,  'lembar'),
  ('GAS 3Kg',      30,  'gram')
) AS v(nama, qty, sat)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Ayam Online Regular' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─── 3.6  Shawarma Ayam Online Sedang ───────────────────────
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, v.sat
FROM public.resep r
CROSS JOIN (VALUES
  ('AYAM',         60,  'gram'),
  ('KENTANG',      30,  'gram'),
  ('LETTUCE',      30,  'gram'),
  ('SAUS CABE',    25,  'gram'),
  ('SAUS TOMAT',   25,  'gram'),
  ('MAYONAISE',    30,  'gram'),
  ('TUM',          10,  'gram'),
  ('KULIT 25',      1,  'lembar'),
  ('FOIL',         35,  'cm'),
  ('PAPER WRAP',    1,  'lembar'),
  ('PLASTIK MERAH', 1,  'lembar'),
  ('GAS 3Kg',      35,  'gram')
) AS v(nama, qty, sat)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Ayam Online Sedang' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─── 3.7  Shawarma Ayam Online Besar ────────────────────────
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, v.sat
FROM public.resep r
CROSS JOIN (VALUES
  ('AYAM',         75,  'gram'),
  ('KENTANG',      35,  'gram'),
  ('LETTUCE',      40,  'gram'),
  ('SAUS CABE',    25,  'gram'),
  ('SAUS TOMAT',   25,  'gram'),
  ('MAYONAISE',    35,  'gram'),
  ('TUM',          10,  'gram'),
  ('KULIT 28',      1,  'lembar'),
  ('FOIL',         40,  'cm'),
  ('PAPER WRAP',    1,  'lembar'),
  ('PLASTIK MERAH', 1,  'lembar'),
  ('GAS 3Kg',      40,  'gram')
) AS v(nama, qty, sat)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Ayam Online Besar' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─── 3.8  Shawarma Ayam Online Jumbo ────────────────────────
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, v.sat
FROM public.resep r
CROSS JOIN (VALUES
  ('AYAM',         100, 'gram'),
  ('KENTANG',       50, 'gram'),
  ('LETTUCE',       50, 'gram'),
  ('SAUS CABE',     25, 'gram'),
  ('SAUS TOMAT',    25, 'gram'),
  ('MAYONAISE',     50, 'gram'),
  ('TUM',           10, 'gram'),
  ('KULIT 32',       1, 'lembar'),
  ('FOIL',          45, 'cm'),
  ('PAPER WRAP',     1, 'lembar'),
  ('PLASTIK MERAH',  1, 'lembar'),
  ('GAS 3Kg',       45, 'gram')
) AS v(nama, qty, sat)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Ayam Online Jumbo' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─── 3.9  Shawarma Mix Online Regular ───────────────────────
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, v.sat
FROM public.resep r
CROSS JOIN (VALUES
  ('SAPI',         35,  'gram'),
  ('AYAM',         25,  'gram'),
  ('KENTANG',      20,  'gram'),
  ('LETTUCE',      20,  'gram'),
  ('SAUS CABE',    20,  'gram'),
  ('SAUS TOMAT',   25,  'gram'),
  ('MAYONAISE',    20,  'gram'),
  ('TUM',          10,  'gram'),
  ('KULIT 25',      1,  'lembar'),
  ('FOIL',         35,  'cm'),
  ('PAPER WRAP',    1,  'lembar'),
  ('PLASTIK MERAH', 1,  'lembar'),
  ('GAS 3Kg',      30,  'gram')
) AS v(nama, qty, sat)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Mix Online Regular' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─── 3.10  Shawarma Mix Online Besar ────────────────────────
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, v.sat
FROM public.resep r
CROSS JOIN (VALUES
  ('SAPI',         90,  'gram'),
  ('AYAM',         40,  'gram'),
  ('KENTANG',      40,  'gram'),
  ('LETTUCE',      40,  'gram'),
  ('SAUS CABE',    25,  'gram'),
  ('SAUS TOMAT',   25,  'gram'),
  ('MAYONAISE',    35,  'gram'),
  ('TUM',          10,  'gram'),
  ('KULIT 28',      1,  'lembar'),
  ('FOIL',         40,  'cm'),
  ('PAPER WRAP',    1,  'lembar'),
  ('PLASTIK MERAH', 1,  'lembar'),
  ('GAS 3Kg',      40,  'gram')
) AS v(nama, qty, sat)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Mix Online Besar' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- ─── 3.11  Shawarma Mix Online Jumbo ────────────────────────
INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, bb.id, v.qty, v.sat
FROM public.resep r
CROSS JOIN (VALUES
  ('SAPI',         110, 'gram'),
  ('AYAM',          70, 'gram'),
  ('KENTANG',       60, 'gram'),
  ('LETTUCE',       60, 'gram'),
  ('SAUS CABE',     25, 'gram'),
  ('SAUS TOMAT',    25, 'gram'),
  ('MAYONAISE',     50, 'gram'),
  ('TUM',           10, 'gram'),
  ('KULIT 32',       1, 'lembar'),
  ('FOIL',          50, 'cm'),
  ('PAPER WRAP',     1, 'lembar'),
  ('PLASTIK MERAH',  1, 'lembar'),
  ('GAS 3Kg',       50, 'gram')
) AS v(nama, qty, sat)
JOIN public.bahan_baku bb ON bb.nama = v.nama
WHERE r.nama = 'Shawarma Mix Online Jumbo' AND r.is_active
ON CONFLICT (resep_id, bahan_baku_id) DO UPDATE SET qty_per_porsi = EXCLUDED.qty_per_porsi;

-- =============================================================================
-- VERIFIKASI (run setelah commit untuk cek)
-- =============================================================================
-- SELECT r.nama, bb.nama as bahan, ri.qty_per_porsi, ri.satuan
-- FROM resep r
-- JOIN resep_item ri ON ri.resep_id = r.id
-- JOIN bahan_baku bb ON bb.id = ri.bahan_baku_id
-- WHERE r.is_active
-- ORDER BY r.nama, bb.nama;
-- =============================================================================

COMMIT;
