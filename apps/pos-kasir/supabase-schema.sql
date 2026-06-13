-- ============================================================
-- SHAWARMA Self-Ordering Kiosk — Supabase Schema LENGKAP (MULTI-OUTLET)
-- Jalankan script ini di: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 0. TABEL OUTLETS
-- ============================================================
CREATE TABLE IF NOT EXISTS outlets (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT    NOT NULL,
  address    TEXT,
  phone      TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 0.1. TABEL PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT    NOT NULL CHECK (role IN ('admin', 'kasir', 'kiosk')),
  outlet_id  UUID    REFERENCES outlets(id) ON DELETE SET NULL,
  username   TEXT    UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 1. TABEL CATEGORIES (Master Product)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT    NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. TABEL MENU ITEMS (Master Product)
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID           REFERENCES categories(id) ON DELETE SET NULL,
  name         TEXT           NOT NULL,
  description  TEXT,
  price        DECIMAL(10,2)  NOT NULL CHECK (price > 0),
  image_url    TEXT,
  is_available BOOLEAN        DEFAULT TRUE,
  sort_order   INTEGER        DEFAULT 0,
  created_at   TIMESTAMPTZ    DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    DEFAULT NOW()
);

-- ============================================================
-- 3. TABEL ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id      UUID          NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  order_number   SERIAL        UNIQUE,        -- nomor antrian otomatis
  customer_name  TEXT,
  status         TEXT          DEFAULT 'pending'
                               CHECK (status IN ('pending','preparing','ready','completed','cancelled')),
  payment_method TEXT          CHECK (payment_method IN ('cash','qris','card')),
  total_amount   DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  notes          TEXT,
  created_at     TIMESTAMPTZ   DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================
-- 4. TABEL ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID          REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id   UUID          REFERENCES menu_items(id) ON DELETE SET NULL,
  menu_item_name TEXT          NOT NULL,
  quantity       INTEGER       NOT NULL CHECK (quantity > 0 AND quantity <= 10),
  unit_price     DECIMAL(10,2) NOT NULL,
  subtotal       DECIMAL(10,2) NOT NULL,
  created_at     TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE outlets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Helper function to get user profile
CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_outlet_id() RETURNS uuid AS $$
  SELECT outlet_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Drop existing policies if any
DROP POLICY IF EXISTS "outlets_select_public" ON outlets;
DROP POLICY IF EXISTS "outlets_all_admin" ON outlets;
DROP POLICY IF EXISTS "profiles_select_self" ON profiles;
DROP POLICY IF EXISTS "profiles_all_admin" ON profiles;
DROP POLICY IF EXISTS "categories_select_public" ON categories;
DROP POLICY IF EXISTS "categories_all_admin" ON categories;
DROP POLICY IF EXISTS "menu_items_select_public" ON menu_items;
DROP POLICY IF EXISTS "menu_items_all_admin" ON menu_items;
DROP POLICY IF EXISTS "orders_select_kiosk" ON orders;
DROP POLICY IF EXISTS "orders_all_admin" ON orders;
DROP POLICY IF EXISTS "orders_all_kasir" ON orders;
DROP POLICY IF EXISTS "orders_select_public" ON orders;
DROP POLICY IF EXISTS "orders_insert_public" ON orders;
DROP POLICY IF EXISTS "orders_update_kasir" ON orders;
DROP POLICY IF EXISTS "order_items_select_public" ON order_items;
DROP POLICY IF EXISTS "order_items_insert_public" ON order_items;
DROP POLICY IF EXISTS "order_items_all_admin_kasir" ON order_items;

-- Outlets
CREATE POLICY "outlets_select_public" ON outlets FOR SELECT USING (true);
CREATE POLICY "outlets_all_admin" ON outlets FOR ALL USING (get_user_role() = 'admin');

-- Profiles
CREATE POLICY "profiles_select_self" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_all_admin" ON profiles FOR ALL USING (get_user_role() = 'admin');

-- Categories (Master Product)
CREATE POLICY "categories_select_public" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_all_admin" ON categories FOR ALL USING (get_user_role() = 'admin');

-- Menu Items (Master Product)
CREATE POLICY "menu_items_select_public" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_items_all_admin" ON menu_items FOR ALL USING (get_user_role() = 'admin');

-- Orders
CREATE POLICY "orders_select_public" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_insert_public" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update_kasir" ON orders FOR UPDATE USING (outlet_id = get_user_outlet_id() AND get_user_role() = 'kasir');
CREATE POLICY "orders_all_admin" ON orders FOR ALL USING (get_user_role() = 'admin');

-- Order Items
CREATE POLICY "order_items_select_public" ON order_items FOR SELECT USING (true);
CREATE POLICY "order_items_insert_public" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items_all_admin_kasir" ON order_items FOR ALL USING (get_user_role() IN ('admin', 'kasir'));

-- ============================================================
-- 6. SUPABASE STORAGE — BUCKET "menu-images"
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images', 'menu-images', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Public can view menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete menu images" ON storage.objects;

CREATE POLICY "Public can view menu images" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');
CREATE POLICY "Admin can upload menu images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'menu-images' AND get_user_role() = 'admin');
CREATE POLICY "Admin can update menu images" ON storage.objects FOR UPDATE USING (bucket_id = 'menu-images' AND get_user_role() = 'admin');
CREATE POLICY "Admin can delete menu images" ON storage.objects FOR DELETE USING (bucket_id = 'menu-images' AND get_user_role() = 'admin');

-- ============================================================
-- 7. DATA DUMMY
-- ============================================================
INSERT INTO outlets (id, name, address, phone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Pusat Sudirman', 'Jl. Jend. Sudirman No.1', '08111111111'),
  ('22222222-2222-2222-2222-222222222222', 'Cabang Blok M', 'Plaza Blok M', '08222222222')
ON CONFLICT DO NOTHING;

INSERT INTO categories (name, sort_order) VALUES
  ('Shawarma', 1), ('Sides', 2), ('Beverages', 3), ('Paket', 4)
ON CONFLICT DO NOTHING;

INSERT INTO menu_items (category_id, name, description, price, is_available, sort_order)
SELECT c.id, m.name, m.description, m.price, true, m.sort_order
FROM (VALUES
  ('Shawarma', 'Chicken Shawarma', 'Wrap ayam panggang dengan saus spesial', 35000, 1),
  ('Sides', 'French Fries', 'Kentang goreng renyah keemasan', 20000, 1)
) AS m(category_name, name, description, price, sort_order)
JOIN categories c ON c.name = m.category_name
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = m.name);

-- ============================================================
-- 9. TABEL KIOSK SETTINGS
-- ============================================================
-- Menghapus tabel lama jika strukturnya beda
DROP TABLE IF EXISTS kiosk_settings CASCADE;

CREATE TABLE kiosk_settings (
  outlet_id  UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  key        TEXT,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (outlet_id, key)
);

ALTER TABLE kiosk_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kiosk_settings_select_public" ON kiosk_settings;
DROP POLICY IF EXISTS "kiosk_settings_all_admin" ON kiosk_settings;
DROP POLICY IF EXISTS "kiosk_settings_all_kasir" ON kiosk_settings;

CREATE POLICY "kiosk_settings_select_public" ON kiosk_settings FOR SELECT USING (true);
CREATE POLICY "kiosk_settings_all_admin" ON kiosk_settings FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "kiosk_settings_all_kasir" ON kiosk_settings FOR ALL USING (outlet_id = get_user_outlet_id() AND get_user_role() = 'kasir');

-- Seed baris default untuk Outlet Pusat
INSERT INTO kiosk_settings (outlet_id, key, value)
VALUES ('11111111-1111-1111-1111-111111111111', 'cover_image_url', null)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. SUPABASE STORAGE — BUCKET "kiosk-assets"
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kiosk-assets', 'kiosk-assets', true, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Public can view kiosk assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload kiosk assets" ON storage.objects;

CREATE POLICY "Public can view kiosk assets" ON storage.objects FOR SELECT USING (bucket_id = 'kiosk-assets');
CREATE POLICY "Admin can upload kiosk assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kiosk-assets' AND get_user_role() IN ('admin', 'kasir'));
