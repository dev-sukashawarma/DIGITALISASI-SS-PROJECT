-- =============================================================================
-- SUKA SHAWARMA HR DASHBOARD — POSTGRESQL OPTIMIZATION MIGRATION
-- Focused 100% on HR Dashboard Modules:
-- 1. Database Karyawan & Personalia (outlet_staff & staff_financials)
-- 2. Penggajian & Slip Gaji (payroll_records)
-- 3. Presensi & Denda Keterlambatan Otomatis (attendance & attendance_logs)
-- 4. Pinjaman & Cicilan Kasbon (cash_advances & cash_advance_payments)
-- 5. Cuti & Izin (leave_requests)
-- 6. Monitoring Kontrak PKWT (staff_contracts)
-- 7. Surat Peringatan & Disiplin (discipline_records)
-- 8. Jadwal Shift Roster (shift_roster)
-- 9. Supabase Realtime WebSocket Tuning for HR Dashboard
-- =============================================================================

DO $$ 
BEGIN

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 1. DATABASE KARYAWAN & FINANCIALS (HR PERSONALIA)
  -- ─────────────────────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'outlet_staff') THEN
    CREATE INDEX IF NOT EXISTS idx_hr_staff_outlet_status 
      ON outlet_staff (outlet_id, status);

    CREATE INDEX IF NOT EXISTS idx_hr_staff_username 
      ON outlet_staff (username);

    CREATE INDEX IF NOT EXISTS idx_hr_staff_role 
      ON outlet_staff (role);

    CREATE INDEX IF NOT EXISTS idx_hr_staff_created 
      ON outlet_staff (created_at DESC);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'staff_financials') THEN
    CREATE INDEX IF NOT EXISTS idx_hr_staff_financials_staff_id 
      ON staff_financials (staff_id);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 2. PENGGAJIAN (PAYROLL RECORDS)
  -- ─────────────────────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payroll_records') THEN
    -- Composite index for monthly payroll lookup
    CREATE INDEX IF NOT EXISTS idx_hr_payroll_period_staff 
      ON payroll_records (period_year, period_month, staff_id);

    -- Status index for draft vs finalized slip filtering
    CREATE INDEX IF NOT EXISTS idx_hr_payroll_status_period 
      ON payroll_records (status, period_year, period_month);

    CREATE INDEX IF NOT EXISTS idx_hr_payroll_staff_id 
      ON payroll_records (staff_id);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 3. PRESENSI & PERHITUNGAN DENDA KETERLAMBATAN OTOMATIS (ATTENDANCE)
  -- ─────────────────────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'attendance') THEN
    CREATE INDEX IF NOT EXISTS idx_hr_attendance_staff_ts 
      ON attendance (outlet_staff_id, ts_server DESC);

    CREATE INDEX IF NOT EXISTS idx_hr_attendance_outlet_ts 
      ON attendance (outlet_id, ts_server DESC);

    -- Partial Index specifically for Clock-In queries (Halves scan size)
    CREATE INDEX IF NOT EXISTS idx_hr_attendance_clock_in 
      ON attendance (outlet_staff_id, ts_server DESC) 
      WHERE type = 'in';

    -- Partial Index for automatic late fee calculation (Rp 1.000 / menit)
    CREATE INDEX IF NOT EXISTS idx_hr_attendance_late_calc 
      ON attendance (outlet_staff_id, ts_server DESC, telat_menit) 
      WHERE type = 'in' AND (telat_menit > 0 OR status IN ('telat', 'terlambat', 'telat_toleransi'));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'attendance_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_hr_attendance_logs_staff_date 
      ON attendance_logs (staff_id, date DESC);

    CREATE INDEX IF NOT EXISTS idx_hr_attendance_logs_outlet_date 
      ON attendance_logs (outlet_id, date DESC);

    CREATE INDEX IF NOT EXISTS idx_hr_attendance_logs_late 
      ON attendance_logs (staff_id, date DESC, late_minutes) 
      WHERE late_minutes > 0;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 4. KASBON & CICILAN (CASH ADVANCES)
  -- ─────────────────────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'cash_advances') THEN
    CREATE INDEX IF NOT EXISTS idx_hr_cash_advances_staff 
      ON cash_advances (staff_id, created_at DESC);

    -- Partial index for active kasbon deduction in payroll
    CREATE INDEX IF NOT EXISTS idx_hr_cash_advances_active 
      ON cash_advances (staff_id, remaining) 
      WHERE status = 'active';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'cash_advance_payments') THEN
    CREATE INDEX IF NOT EXISTS idx_hr_cash_advance_payments_parent 
      ON cash_advance_payments (cash_advance_id, payment_date DESC);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 5. CUTI & IZIN (LEAVE REQUESTS)
  -- ─────────────────────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'leave_requests') THEN
    CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_staff_dates 
      ON leave_requests (staff_id, start_date DESC);

    CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_status 
      ON leave_requests (status, start_date DESC);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 6. MONITORING KONTRAK KERJA (STAFF CONTRACTS)
  -- ─────────────────────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'staff_contracts') THEN
    CREATE INDEX IF NOT EXISTS idx_hr_staff_contracts_staff_status 
      ON staff_contracts (staff_id, status);

    CREATE INDEX IF NOT EXISTS idx_hr_staff_contracts_expiring 
      ON staff_contracts (end_date ASC) 
      WHERE status = 'active';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 7. DISIPLIN & SURAT PERINGATAN (DISCIPLINE RECORDS)
  -- ─────────────────────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'discipline_records') THEN
    CREATE INDEX IF NOT EXISTS idx_hr_discipline_records_staff 
      ON discipline_records (staff_id, status, created_at DESC);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────────
  -- 8. JADWAL SHIFT ROSTER (SHIFT ROSTER)
  -- ─────────────────────────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'shift_roster') THEN
    CREATE INDEX IF NOT EXISTS idx_hr_shift_roster_outlet_date 
      ON shift_roster (outlet_id, date);

    CREATE INDEX IF NOT EXISTS idx_hr_shift_roster_staff_date 
      ON shift_roster (staff_id, date);
  END IF;

END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. SUPABASE REALTIME REPLICA IDENTITY (HR MODULES ONLY)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payroll_records') THEN
    ALTER TABLE payroll_records REPLICA IDENTITY FULL;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'attendance') THEN
    ALTER TABLE attendance REPLICA IDENTITY FULL;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'attendance_logs') THEN
    ALTER TABLE attendance_logs REPLICA IDENTITY FULL;
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
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'leave_requests') THEN
    ALTER TABLE leave_requests REPLICA IDENTITY FULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RUN TABLE STATISTICS ANALYZE (HR TABLES ONLY)
-- ─────────────────────────────────────────────────────────────────────────────
ANALYZE outlet_staff;
ANALYZE staff_financials;
ANALYZE attendance;
ANALYZE attendance_logs;
ANALYZE payroll_records;
ANALYZE cash_advances;
ANALYZE leave_requests;
