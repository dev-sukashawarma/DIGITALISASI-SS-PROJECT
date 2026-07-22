-- ============================================================
-- MIGRASI OPTIMASI PERFORMA DATABASE (SAFE PL/pgSQL MIGRATION)
-- Compatible dengan tabel `outlet_staff` maupun `profiles`
-- ============================================================

DO $$ 
BEGIN
  -- 1. INDEXES UNTUK TABEL ORDERS & ORDER ITEMS
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'orders') THEN
    CREATE INDEX IF NOT EXISTS idx_orders_outlet_status_created ON orders (outlet_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_outlet_created ON orders (outlet_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'order_items') THEN
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items (menu_item_id);
  END IF;

  -- 2. INDEXES UNTUK TABEL ABSENSI
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'attendance') THEN
    CREATE INDEX IF NOT EXISTS idx_attendance_staff_ts ON attendance (outlet_staff_id, ts_server DESC);
    CREATE INDEX IF NOT EXISTS idx_attendance_outlet_ts ON attendance (outlet_id, ts_server DESC);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'attendance_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_attendance_logs_outlet_date ON attendance_logs (outlet_id, created_at DESC);
  END IF;

  -- 3. INDEXES UNTUK STOK BALANCE
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'stok_balance') THEN
    CREATE INDEX IF NOT EXISTS idx_stok_balance_outlet ON stok_balance (outlet_id);
    CREATE INDEX IF NOT EXISTS idx_stok_balance_bahan ON stok_balance (bahan_baku_id);
  END IF;

  -- 4. INDEXES UNTUK PETTY CASH & KASBON
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'petty_cash_topups') THEN
    CREATE INDEX IF NOT EXISTS idx_petty_cash_topups_status ON petty_cash_topups (status, created_at DESC);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'cash_advances') THEN
    CREATE INDEX IF NOT EXISTS idx_cash_advances_staff ON cash_advances (staff_id, created_at DESC);
  END IF;

  -- 5. INDEXES UNTUK OUTLET STAFF & PROFILES
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'outlet_staff') THEN
    CREATE INDEX IF NOT EXISTS idx_outlet_staff_outlet_id ON outlet_staff (outlet_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profiles') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_outlet_id ON profiles (outlet_id);
  END IF;
END $$;

-- 6. OPTIMASI RLS HELPER FUNCTIONS (STABLE & PL/pgSQL RESILIENT)
CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'outlet_staff') THEN
    SELECT role INTO v_role FROM outlet_staff WHERE id = auth.uid() LIMIT 1;
    IF v_role IS NOT NULL THEN
      RETURN v_role;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profiles') THEN
    SELECT role INTO v_role FROM profiles WHERE id = auth.uid() LIMIT 1;
    IF v_role IS NOT NULL THEN
      RETURN v_role;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_outlet_id() RETURNS uuid AS $$
DECLARE
  v_outlet_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'outlet_staff') THEN
    SELECT outlet_id INTO v_outlet_id FROM outlet_staff WHERE id = auth.uid() LIMIT 1;
    IF v_outlet_id IS NOT NULL THEN
      RETURN v_outlet_id;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profiles') THEN
    SELECT outlet_id INTO v_outlet_id FROM profiles WHERE id = auth.uid() LIMIT 1;
    IF v_outlet_id IS NOT NULL THEN
      RETURN v_outlet_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
