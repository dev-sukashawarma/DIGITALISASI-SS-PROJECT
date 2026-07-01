-- Migration: Update existing leave_requests and cash_advances to support SPV & HR approval hierarchy

-- 1. Alter leave_requests
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS status_spv VARCHAR(20) DEFAULT 'pending' CHECK (status_spv IN ('pending', 'approved', 'rejected', 'not_required'));

-- 2. Alter cash_advances
ALTER TABLE public.cash_advances
  ADD COLUMN IF NOT EXISTS status_spv VARCHAR(20) DEFAULT 'pending' CHECK (status_spv IN ('pending', 'approved', 'rejected', 'not_required')),
  ADD COLUMN IF NOT EXISTS status_hr VARCHAR(20) DEFAULT 'pending' CHECK (status_hr IN ('pending', 'approved', 'rejected'));
  -- Existing 'status' column is likely 'active' or 'paid_off'. We'll use status_hr for the approval process.

-- Add missing columns to cash_advances that our absensi app uses if they don't exist
ALTER TABLE public.cash_advances
  ADD COLUMN IF NOT EXISTS installment_months INT DEFAULT 1;

-- 3. RLS Policies for leave_requests
-- Ensure users can read their own
CREATE POLICY "Users can read own leave_requests" ON public.leave_requests
    FOR SELECT USING (staff_id = auth.uid());

-- Ensure users can insert their own
CREATE POLICY "Users can insert own leave_requests" ON public.leave_requests
    FOR INSERT WITH CHECK (staff_id = auth.uid());

-- Ensure users can update their own (for edits/cancel)
CREATE POLICY "Users can update own leave_requests" ON public.leave_requests
    FOR UPDATE USING (staff_id = auth.uid());

-- 4. RLS Policies for cash_advances
CREATE POLICY "Users can read own cash_advances" ON public.cash_advances
    FOR SELECT USING (staff_id = auth.uid());

CREATE POLICY "Users can insert own cash_advances" ON public.cash_advances
    FOR INSERT WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Users can update own cash_advances" ON public.cash_advances
    FOR UPDATE USING (staff_id = auth.uid());
