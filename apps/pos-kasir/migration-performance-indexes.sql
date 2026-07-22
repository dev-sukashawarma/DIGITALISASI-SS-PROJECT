-- ============================================================
-- MIGRASI OPTIMASI PERFORMA DATABASE (SQL INDEXES & RLS STABLE)
-- ============================================================

-- 1. INDEXES UNTUK TABEL ORDERS & ORDER ITEMS (POS KASIR & ADMIN)
CREATE INDEX IF NOT EXISTS idx_orders_outlet_status_created 
  ON orders (outlet_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_outlet_created 
  ON orders (outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_created_at 
  ON orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
  ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id 
  ON order_items (menu_item_id);

-- 2. INDEXES UNTUK TABEL ABSENSI (M1 ABSENSI)
CREATE INDEX IF NOT EXISTS idx_attendance_staff_ts 
  ON attendance (outlet_staff_id, ts_server DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_outlet_ts 
  ON attendance (outlet_id, ts_server DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_outlet_date 
  ON attendance_logs (outlet_id, created_at DESC);

-- 3. INDEXES UNTUK STOK BALANCE & MONITORING
CREATE INDEX IF NOT EXISTS idx_stok_balance_outlet 
  ON stok_balance (outlet_id);

CREATE INDEX IF NOT EXISTS idx_stok_balance_bahan 
  ON stok_balance (bahan_baku_id);

-- 4. INDEXES UNTUK PETTY CASH & KASBON (FINANCE & ADMIN)
CREATE INDEX IF NOT EXISTS idx_petty_cash_topups_status 
  ON petty_cash_topups (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_advances_staff 
  ON cash_advances (staff_id, created_at DESC);

-- 5. INDEXES UNTUK PROFILES & STAFF OUTLETS
CREATE INDEX IF NOT EXISTS idx_profiles_outlet_id 
  ON profiles (outlet_id);

CREATE INDEX IF NOT EXISTS idx_outlet_staff_outlet_id 
  ON outlet_staff (outlet_id);

-- 6. OPTIMASI RLS HELPER FUNCTIONS (STABLE)
CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_outlet_id() RETURNS uuid AS $$
  SELECT outlet_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
