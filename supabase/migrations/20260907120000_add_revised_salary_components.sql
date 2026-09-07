-- Migration: Add revised salary components (Komponen Gaji)
-- Components: Gaji Pokok, Tunjangan Makan, Tunjangan Transportasi, Tunjangan Telekomunikasi, Sales Bonus, Potongan Kasbon, Potongan BPJS

-- 1. Tambah kolom komponen gaji pada tabel staff_financials
ALTER TABLE public.staff_financials 
  ADD COLUMN IF NOT EXISTS allowance_meal NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowance_transport NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowance_communication NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_bonus NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_kasbon NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_bpjs NUMERIC NOT NULL DEFAULT 0;

-- 2. Tambah kolom komponen gaji pada tabel payroll_records
ALTER TABLE public.payroll_records 
  ADD COLUMN IF NOT EXISTS allowance_meal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowance_transport NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowance_communication NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_bonus NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_kasbon NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_bpjs NUMERIC DEFAULT 0;

-- 3. Reload cache schema PostgREST
NOTIFY pgrst, 'reload schema';
