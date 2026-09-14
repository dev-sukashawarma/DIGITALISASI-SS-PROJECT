-- =============================================================================
-- 20260914140000_link_resep_online_to_menu.sql
-- =============================================================================
-- Tujuan: link 11 resep Online/TikTok ke menu_item_ref yang tepat.
--
-- Strategi:
--  [REGULAR x3] → menu item sudah ada, belum ada resep aktif → langsung link.
--  [SEDANG/BESAR/JUMBO x8] → menu item sudah dipakai resep OFFLINE (foodapps).
--    Solusi: buat 8 menu item BARU khusus channel ss_online + tiktok_shop + tiktokgo,
--    lalu link resep Online ke menu item baru tersebut.
--    Menu item baru: nama = original + ' (Online)' untuk mudah dibedakan.
--    available_online_channels = ['ss_online','tiktok_shop','tiktokgo']
--    is_available = false dulu (aktifkan manual setelah harga dikonfirmasi)
--
-- Foodapps (grabfood/gofood/shopeefood) TIDAK terdampak karena tetap
-- link ke menu item lama → resep OFFLINE tetap jalan normal.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- BAGIAN 1 — Link 3 resep Regular ke menu yang sudah ada
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.resep
SET menu_item_ref = '95872353-c467-4215-94b4-6c66751d2b02'  -- Original Sapi Reguler
WHERE nama = 'Shawarma Sapi Online Regular' AND scope = 'global' AND is_active
  AND menu_item_ref IS NULL;

UPDATE public.resep
SET menu_item_ref = '4a9c2877-3c8a-42c8-8644-479988c84873'  -- Original Ayam Reguler
WHERE nama = 'Shawarma Ayam Online Regular' AND scope = 'global' AND is_active
  AND menu_item_ref IS NULL;

UPDATE public.resep
SET menu_item_ref = '04166938-0a2b-48d2-ba86-407e4ffe77b8'  -- Original Mix Reguler
WHERE nama = 'Shawarma Mix Online Regular' AND scope = 'global' AND is_active
  AND menu_item_ref IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- BAGIAN 2 — Buat 8 menu item baru khusus channel Online/TikTok
--            (Sedang/Besar/Jumbo untuk Sapi/Ayam/Mix)
-- Harga sementara mengacu harga menu offline (sesuaikan manual jika beda).
-- is_available = false sampai dikonfirmasi.
-- outlet_id = NULL = global.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.menu_items (
  name,
  price,
  is_available,
  is_available_online,
  available_online_channels,
  outlet_id,
  description
)
SELECT v.name, v.price, false, true,
       ARRAY['ss_online','tiktok_shop','tiktokgo']::text[],
       NULL,
       'Menu khusus channel SS Online & TikTok — gramasi online (lebih kecil dari offline). Aktifkan setelah harga dikonfirmasi.'
FROM (VALUES
  ('Original Sapi Sedang (Online)',  27000),
  ('Original Sapi Besar (Online)',   32000),
  ('Original Sapi Jumbo (Online)',   42000),
  ('Original Ayam Sedang (Online)',  24000),
  ('Original Ayam Besar (Online)',   29000),
  ('Original Ayam Jumbo (Online)',   34000),
  ('Original Mix Besar (Online)',    37000),
  ('Original Mix Jumbo (Online)',    47000)
) AS v(name, price)
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_items mi WHERE mi.name = v.name
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BAGIAN 3 — Link 8 resep Online ke menu item baru
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.resep r
SET menu_item_ref = mi.id::text
FROM public.menu_items mi
WHERE r.nama = 'Shawarma Sapi Online Sedang'  AND r.scope='global' AND r.is_active
  AND mi.name = 'Original Sapi Sedang (Online)' AND r.menu_item_ref IS NULL;

UPDATE public.resep r
SET menu_item_ref = mi.id::text
FROM public.menu_items mi
WHERE r.nama = 'Shawarma Sapi Online Besar'   AND r.scope='global' AND r.is_active
  AND mi.name = 'Original Sapi Besar (Online)' AND r.menu_item_ref IS NULL;

UPDATE public.resep r
SET menu_item_ref = mi.id::text
FROM public.menu_items mi
WHERE r.nama = 'Shawarma Sapi Online Jumbo'   AND r.scope='global' AND r.is_active
  AND mi.name = 'Original Sapi Jumbo (Online)' AND r.menu_item_ref IS NULL;

UPDATE public.resep r
SET menu_item_ref = mi.id::text
FROM public.menu_items mi
WHERE r.nama = 'Shawarma Ayam Online Sedang'  AND r.scope='global' AND r.is_active
  AND mi.name = 'Original Ayam Sedang (Online)' AND r.menu_item_ref IS NULL;

UPDATE public.resep r
SET menu_item_ref = mi.id::text
FROM public.menu_items mi
WHERE r.nama = 'Shawarma Ayam Online Besar'   AND r.scope='global' AND r.is_active
  AND mi.name = 'Original Ayam Besar (Online)' AND r.menu_item_ref IS NULL;

UPDATE public.resep r
SET menu_item_ref = mi.id::text
FROM public.menu_items mi
WHERE r.nama = 'Shawarma Ayam Online Jumbo'   AND r.scope='global' AND r.is_active
  AND mi.name = 'Original Ayam Jumbo (Online)' AND r.menu_item_ref IS NULL;

UPDATE public.resep r
SET menu_item_ref = mi.id::text
FROM public.menu_items mi
WHERE r.nama = 'Shawarma Mix Online Besar'    AND r.scope='global' AND r.is_active
  AND mi.name = 'Original Mix Besar (Online)' AND r.menu_item_ref IS NULL;

UPDATE public.resep r
SET menu_item_ref = mi.id::text
FROM public.menu_items mi
WHERE r.nama = 'Shawarma Mix Online Jumbo'    AND r.scope='global' AND r.is_active
  AND mi.name = 'Original Mix Jumbo (Online)' AND r.menu_item_ref IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFIKASI
-- SELECT r.nama, r.menu_item_ref, mi.name, mi.available_online_channels
-- FROM resep r JOIN menu_items mi ON mi.id::text = r.menu_item_ref
-- WHERE r.nama LIKE 'Shawarma % Online %' AND r.is_active
-- ORDER BY r.nama;
-- ─────────────────────────────────────────────────────────────────────────────

COMMIT;
