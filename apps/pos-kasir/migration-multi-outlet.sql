-- ============================================================
-- MIGRATION SCRIPT: SINGLE OUTLET TO MULTI-OUTLET
-- Gunakan script ini karena Anda sudah memiliki tabel sebelumnya.
-- Script ini akan menambahkan kolom dan tabel baru TANPA MENGHAPUS data lama Anda.
-- ============================================================

-- 1. Buat Tabel Outlets
CREATE TABLE IF NOT EXISTS outlets (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT    NOT NULL,
  address    TEXT,
  phone      TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Buat Tabel Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT    NOT NULL CHECK (role IN ('admin', 'kasir', 'kiosk')),
  outlet_id  UUID    REFERENCES outlets(id) ON DELETE SET NULL,
  username   TEXT    UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Masukkan 1 Outlet Default (Pusat) agar data lama tidak error
INSERT INTO outlets (id, name, address, phone) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Pusat (Default)', '-', '-')
ON CONFLICT DO NOTHING;

-- 4. Modifikasi Tabel Orders (Menambahkan outlet_id ke data lama)
-- Kita set default ke Outlet Pusat untuk order yang sudah pernah ada
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE DEFAULT '11111111-1111-1111-1111-111111111111';

-- 5. Modifikasi Tabel Kiosk Settings
-- Hapus Primary Key lama (karena PK lama hanya 'key')
ALTER TABLE kiosk_settings DROP CONSTRAINT IF EXISTS kiosk_settings_pkey;

-- Tambahkan kolom outlet_id
ALTER TABLE kiosk_settings 
ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE DEFAULT '11111111-1111-1111-1111-111111111111';

-- Buat Primary Key baru gabungan (outlet_id, key)
ALTER TABLE kiosk_settings ADD PRIMARY KEY (outlet_id, key);

-- 6. Terapkan RLS (Row Level Security) Baru
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_outlet_id() RETURNS uuid AS $$
  SELECT outlet_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Hapus Policy Lama yang bentrok
DROP POLICY IF EXISTS "orders_select_public" ON orders;
DROP POLICY IF EXISTS "orders_update_admin" ON orders;
DROP POLICY IF EXISTS "orders_delete_admin" ON orders;
DROP POLICY IF EXISTS "kiosk_settings_select_public" ON kiosk_settings;
DROP POLICY IF EXISTS "kiosk_settings_all_admin" ON kiosk_settings;

-- Policy Baru
CREATE POLICY "outlets_select_public" ON outlets FOR SELECT USING (true);
CREATE POLICY "outlets_all_admin" ON outlets FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "profiles_select_self" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_all_admin" ON profiles FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "orders_select_public" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_insert_public" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update_kasir" ON orders FOR UPDATE USING (outlet_id = get_user_outlet_id() AND get_user_role() = 'kasir');
CREATE POLICY "orders_all_admin" ON orders FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "kiosk_settings_select_public" ON kiosk_settings FOR SELECT USING (true);
CREATE POLICY "kiosk_settings_all_admin" ON kiosk_settings FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "kiosk_settings_all_kasir" ON kiosk_settings FOR ALL USING (outlet_id = get_user_outlet_id() AND get_user_role() = 'kasir');

-- SELESAI. Data lama Anda aman 100%.
