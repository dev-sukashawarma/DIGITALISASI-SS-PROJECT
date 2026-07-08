-- ============================================================
-- MIGRATION: OUTLET PROMOS
-- Menambahkan tabel untuk menyimpan konfigurasi promo per outlet
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS outlet_promos (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id      UUID    NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  scope          TEXT    NOT NULL CHECK (scope IN ('global', 'item')),
  menu_item_id   UUID    REFERENCES menu_items(id) ON DELETE CASCADE,
  discount_type  TEXT    NOT NULL CHECK (discount_type IN ('percentage', 'nominal')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  is_active      BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_promo_scope CHECK (
    (scope = 'global' AND menu_item_id IS NULL) OR
    (scope = 'item' AND menu_item_id IS NOT NULL)
  )
);

-- RLS
ALTER TABLE outlet_promos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outlet_promos_select_public" ON outlet_promos;
DROP POLICY IF EXISTS "outlet_promos_all_admin" ON outlet_promos;
DROP POLICY IF EXISTS "outlet_promos_all_kasir" ON outlet_promos;

CREATE POLICY "outlet_promos_select_public" ON outlet_promos FOR SELECT USING (true);
CREATE POLICY "outlet_promos_all_admin" ON outlet_promos FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "outlet_promos_all_kasir" ON outlet_promos FOR ALL USING (
  outlet_id = get_user_outlet_id() AND get_user_role() IN ('crew', 'leader')
);

-- Tambah kolom discount_amount ke tabel orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

-- Aktifkan Supabase Realtime untuk outlet_promos agar update instan di Kiosk
ALTER PUBLICATION supabase_realtime ADD TABLE outlet_promos;
