-- =============================================================================
-- SUKA SHAWARMA DIGITAL PROJECT — COMPREHENSIVE POSTGRESQL OPTIMIZATION SCRIPT
-- Covering: HR & Payroll, POS Kasir (57k+ Orders), Attendance (Selfie GPS & Logs),
-- Kasbon, Stock Ledger, Partial Indexes, Composite Indexes & Realtime WAL Tuning.
-- =============================================================================

DO $$ 
BEGIN

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 1. HR & PAYROLL INDEXES
  -- ─────────────────────────────────────────────────────────────────────────────

  -- Payroll Records: Composite period search & status filtering
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payroll_records') THEN
    CREATE INDEX IF NOT EXISTS idx_payroll_records_period_staff 
      ON payroll_records (period_year, period_month, staff_id);

    CREATE INDEX IF NOT EXISTS idx_payroll_records_status_period 
      ON payroll_records (status, period_year, period_month);

    CREATE INDEX IF NOT EXISTS idx_payroll_records_staff_id 
      ON payroll_records (staff_id);
  END IF;

  -- Staff Financials: Lookup by staff
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'staff_financials') THEN
    CREATE INDEX IF NOT EXISTS idx_staff_financials_staff_id 
      ON staff_financials (staff_id);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 2. ATTENDANCE & REALTIME LATE DEDUCTION INDEXES (HIGH FREQUENCY)
  -- ─────────────────────────────────────────────────────────────────────────────

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'attendance') THEN
    -- Composite index for staff timestamp range queries
    CREATE INDEX IF NOT EXISTS idx_attendance_staff_ts 
      ON attendance (outlet_staff_id, ts_server DESC);

    CREATE INDEX IF NOT EXISTS idx_attendance_outlet_ts 
      ON attendance (outlet_id, ts_server DESC);

    -- Partial Index specifically for Clock-In queries (Halves index size)
    CREATE INDEX IF NOT EXISTS idx_attendance_clock_in 
      ON attendance (outlet_staff_id, ts_server DESC) 
      WHERE type = 'in';

    -- Partial Index specifically for Late Fee Calculation (> 0 late minutes)
    CREATE INDEX IF NOT EXISTS idx_attendance_late_calc 
      ON attendance (outlet_staff_id, ts_server DESC, telat_menit) 
      WHERE type = 'in' AND (telat_menit > 0 OR status IN ('telat', 'terlambat', 'telat_toleransi'));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'attendance_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_attendance_logs_staff_date 
      ON attendance_logs (staff_id, date DESC);

    CREATE INDEX IF NOT EXISTS idx_attendance_logs_outlet_date 
      ON attendance_logs (outlet_id, date DESC);

    CREATE INDEX IF NOT EXISTS idx_attendance_logs_late 
      ON attendance_logs (staff_id, date DESC, late_minutes) 
      WHERE late_minutes > 0;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 3. KASBON & LOANS (CASH ADVANCES)
  -- ─────────────────────────────────────────────────────────────────────────────

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'cash_advances') THEN
    CREATE INDEX IF NOT EXISTS idx_cash_advances_staff_created 
      ON cash_advances (staff_id, created_at DESC);

    -- Partial index for active kasbon lookup during payroll calculation
    CREATE INDEX IF NOT EXISTS idx_cash_advances_active_lookup 
      ON cash_advances (staff_id, remaining) 
      WHERE status = 'active';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'cash_advance_payments') THEN
    CREATE INDEX IF NOT EXISTS idx_cash_advance_payments_parent 
      ON cash_advance_payments (cash_advance_id, payment_date DESC);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 4. CONTRACTS, LEAVE, DISCIPLINE & SHIFT ROSTER
  -- ─────────────────────────────────────────────────────────────────────────────

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'leave_requests') THEN
    CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_dates 
      ON leave_requests (staff_id, start_date DESC);

    CREATE INDEX IF NOT EXISTS idx_leave_requests_status 
      ON leave_requests (status, start_date DESC);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'staff_contracts') THEN
    CREATE INDEX IF NOT EXISTS idx_staff_contracts_staff_status 
      ON staff_contracts (staff_id, status);

    CREATE INDEX IF NOT EXISTS idx_staff_contracts_end_date 
      ON staff_contracts (end_date ASC) 
      WHERE status = 'active';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'discipline_records') THEN
    CREATE INDEX IF NOT EXISTS idx_discipline_records_staff_status 
      ON discipline_records (staff_id, status, created_at DESC);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'shift_roster') THEN
    CREATE INDEX IF NOT EXISTS idx_shift_roster_outlet_date 
      ON shift_roster (outlet_id, date);

    CREATE INDEX IF NOT EXISTS idx_shift_roster_staff_date 
      ON shift_roster (staff_id, date);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 5. POS & ORDERS SCALING (57k+ ORDERS & 77k+ ITEMS)
  -- ─────────────────────────────────────────────────────────────────────────────

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'orders') THEN
    CREATE INDEX IF NOT EXISTS idx_orders_outlet_status_created 
      ON orders (outlet_id, status, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_orders_outlet_payment_created 
      ON orders (outlet_id, payment_status, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc 
      ON orders (created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_orders_payment_method_created 
      ON orders (payment_method, created_at DESC);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'order_items') THEN
    CREATE INDEX IF NOT EXISTS idx_order_items_order_menu 
      ON order_items (order_id, menu_item_id);

    CREATE INDEX IF NOT EXISTS idx_order_items_created_at 
      ON order_items (created_at DESC);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 6. STOCK LEDGER & BALANCE
  -- ─────────────────────────────────────────────────────────────────────────────

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'stok_balance') THEN
    CREATE INDEX IF NOT EXISTS idx_stok_balance_outlet_bahan 
      ON stok_balance (outlet_id, bahan_baku_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'stok_ledger') THEN
    CREATE INDEX IF NOT EXISTS idx_stok_ledger_outlet_bahan_ts 
      ON stok_ledger (outlet_id, bahan_baku_id, created_at DESC);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 7. STAFF PROFILES & ISOLATION
  -- ─────────────────────────────────────────────────────────────────────────────

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'outlet_staff') THEN
    CREATE INDEX IF NOT EXISTS idx_outlet_staff_outlet_status 
      ON outlet_staff (outlet_id, status);

    CREATE INDEX IF NOT EXISTS idx_outlet_staff_username 
      ON outlet_staff (username);

    CREATE INDEX IF NOT EXISTS idx_outlet_staff_role 
      ON outlet_staff (role);
  END IF;

END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SUPABASE REALTIME REPLICA IDENTITY
-- Ensures WebSocket realtime updates receive old/new records without overhead
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payroll_records') THEN
    ALTER TABLE payroll_records REPLICA IDENTITY FULL;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'attendance') THEN
    ALTER TABLE attendance REPLICA IDENTITY FULL;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'cash_advances') THEN
    ALTER TABLE cash_advances REPLICA IDENTITY FULL;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'outlet_staff') THEN
    ALTER TABLE outlet_staff REPLICA IDENTITY FULL;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'staff_financials') THEN
    ALTER TABLE staff_financials REPLICA IDENTITY FULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RUN TABLE STATISTICS ANALYZE
-- Update PostgreSQL query planner statistics for optimal execution plan
-- ─────────────────────────────────────────────────────────────────────────────
ANALYZE orders;
ANALYZE order_items;
ANALYZE attendance;
ANALYZE attendance_logs;
ANALYZE payroll_records;
ANALYZE cash_advances;
ANALYZE outlet_staff;
ANALYZE staff_financials;
