-- =============================================================================
-- 20260914150000_add_ecommerce_category.sql
-- =============================================================================
-- 1. Tambah kategori 'E-Commerce' ke tabel categories jika belum ada
-- 2. Update category_id pada 8 menu_items (Online) ke kategori E-Commerce
-- =============================================================================

BEGIN;

-- 1. Tambah kategori E-Commerce
INSERT INTO public.categories (name, sort_order)
SELECT 'E-Commerce', 95
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE lower(name) = 'e-commerce'
);

-- 2. Update category_id pada 8 menu item (Online)
UPDATE public.menu_items
SET category_id = (
  SELECT id FROM public.categories 
  WHERE lower(name) = 'e-commerce' 
  ORDER BY created_at DESC 
  LIMIT 1
)
WHERE name IN (
  'Original Sapi Sedang (Online)',
  'Original Sapi Besar (Online)',
  'Original Sapi Jumbo (Online)',
  'Original Ayam Sedang (Online)',
  'Original Ayam Besar (Online)',
  'Original Ayam Jumbo (Online)',
  'Original Mix Besar (Online)',
  'Original Mix Jumbo (Online)'
);

COMMIT;
