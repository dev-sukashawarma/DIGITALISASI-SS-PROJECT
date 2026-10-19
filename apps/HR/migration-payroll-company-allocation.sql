-- Allocate each employee's payroll cost across legal entities.
-- Staff settings are copied to each payroll row so prior periods remain unchanged.
ALTER TABLE public.staff_financials
  ADD COLUMN IF NOT EXISTS payroll_allocations JSONB NOT NULL
  DEFAULT '[{"company_name":"PT Suka Profit Berkah","percentage":100}]'::jsonb;

ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS payroll_allocations JSONB NOT NULL
  DEFAULT '[{"company_name":"PT Suka Profit Berkah","percentage":100}]'::jsonb;

NOTIFY pgrst, 'reload schema';

