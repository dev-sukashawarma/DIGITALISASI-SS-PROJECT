-- 1. Extend public.outlet_staff table with personal & contract info
ALTER TABLE public.outlet_staff
  ADD COLUMN IF NOT EXISTS nik VARCHAR(16) UNIQUE,
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address_ktp TEXT,
  ADD COLUMN IF NOT EXISTS address_domicile TEXT,
  ADD COLUMN IF NOT EXISTS birth_place VARCHAR(100),
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS religion VARCHAR(50),
  ADD COLUMN IF NOT EXISTS emergency_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS emergency_relationship VARCHAR(50),
  ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS nip VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20) CHECK (contract_type IN ('permanent', 'contract', 'intern', 'daily')),
  ADD COLUMN IF NOT EXISTS join_date DATE,
  ADD COLUMN IF NOT EXISTS resign_date DATE,
  ADD COLUMN IF NOT EXISTS leave_quota INT DEFAULT 12;

-- 2. Create staff_financials table (Sensitive Financial & Bank Info)
CREATE TABLE IF NOT EXISTS public.staff_financials (
  staff_id UUID PRIMARY KEY REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  basic_salary NUMERIC NOT NULL DEFAULT 0,
  allowance_position NUMERIC NOT NULL DEFAULT 0,
  allowance_presence NUMERIC NOT NULL DEFAULT 0,
  bank_name VARCHAR(100) NOT NULL,
  bank_account_number VARCHAR(100) NOT NULL,
  bank_account_name VARCHAR(100) NOT NULL,
  npwp VARCHAR(20),
  bpjs_ketenagakerjaan VARCHAR(50),
  bpjs_kesehatan VARCHAR(50),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on financials
ALTER TABLE public.staff_financials ENABLE ROW LEVEL SECURITY;

-- Policy: Only admin_hr, owner, and admin roles can read/write financials
CREATE POLICY "Allow privileged roles full access to financials"
  ON public.staff_financials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff
      WHERE id = auth.uid() AND role IN ('admin', 'admin_hr', 'owner')
    )
  );

-- 3. Create staff_leaves table (Leave & Sick Applications)
CREATE TABLE IF NOT EXISTS public.staff_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('annual', 'sick', 'special', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.outlet_staff(id),
  document_url TEXT, -- URL for doctor note / leave proofs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on leaves
ALTER TABLE public.staff_leaves ENABLE ROW LEVEL SECURITY;

-- Leaves policies: staff can view their own; HR/Owner/Admin can manage all
CREATE POLICY "Staff can view own leaves" ON public.staff_leaves FOR SELECT TO authenticated USING (staff_id = auth.uid());
CREATE POLICY "HR/Owner/Admin can manage all leaves" ON public.staff_leaves FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = auth.uid() AND role IN ('admin', 'admin_hr', 'owner'))
);

-- 4. Create staff_kpi table (Performance evaluations)
CREATE TABLE IF NOT EXISTS public.staff_kpi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  period VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  kpi_score NUMERIC CHECK (kpi_score >= 0 AND kpi_score <= 100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on KPI
ALTER TABLE public.staff_kpi ENABLE ROW LEVEL SECURITY;

-- KPI policies: staff can view their own; HR/Owner/Admin can manage all
CREATE POLICY "Staff can view own KPI" ON public.staff_kpi FOR SELECT TO authenticated USING (staff_id = auth.uid());
CREATE POLICY "HR/Owner/Admin can manage all KPI" ON public.staff_kpi FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = auth.uid() AND role IN ('admin', 'admin_hr', 'owner'))
);

-- 5. Create staff_warnings table (Surat Peringatan)
CREATE TABLE IF NOT EXISTS public.staff_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  warning_level INT NOT NULL CHECK (warning_level IN (1, 2, 3)),
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.outlet_staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on warnings
ALTER TABLE public.staff_warnings ENABLE ROW LEVEL SECURITY;

-- Warnings policies: staff can view their own; HR/Owner/Admin can manage all
CREATE POLICY "Staff can view own warnings" ON public.staff_warnings FOR SELECT TO authenticated USING (staff_id = auth.uid());
CREATE POLICY "HR/Owner/Admin can manage all warnings" ON public.staff_warnings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = auth.uid() AND role IN ('admin', 'admin_hr', 'owner'))
);
