-- Migration: Add outlet_id to payroll_records to snapshot staff outlet per payroll period
-- Problem: Previously payroll_records had no outlet_id, relying on joining outlet_staff.outlet_id.
-- When a staff member was transferred to a new outlet, their historical payroll records retroactively
-- moved to the new outlet, corrupting historical P&L, Prorated OPEX, and HR summary reports.

-- 1. Add outlet_id column with foreign key to public.outlets
ALTER TABLE public.payroll_records
ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL;

-- 2. Create indices for performance
CREATE INDEX IF NOT EXISTS idx_payroll_records_outlet_id ON public.payroll_records(outlet_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_outlet_period ON public.payroll_records(outlet_id, period_year, period_month);

-- 3. Initial backfill from outlet_staff (current profile as baseline)
UPDATE public.payroll_records pr
SET outlet_id = os.outlet_id
FROM public.outlet_staff os
WHERE pr.staff_id = os.id
  AND pr.outlet_id IS NULL;

-- 4. Historical correction based on dominant attendance per month
-- For any crew/leader/store staff whose actual attendance in that month was at a different outlet
-- (due to subsequent outlet transfers), restore the historical payroll record to the outlet where
-- they actually performed their shifts.
WITH monthly_dominant_outlet AS (
  SELECT 
    att.outlet_staff_id AS staff_id,
    EXTRACT(MONTH FROM att.ts_server AT TIME ZONE 'Asia/Jakarta')::int AS period_month,
    EXTRACT(YEAR FROM att.ts_server AT TIME ZONE 'Asia/Jakarta')::int AS period_year,
    att.outlet_id,
    COUNT(*) as shift_count,
    ROW_NUMBER() OVER(
      PARTITION BY att.outlet_staff_id, EXTRACT(MONTH FROM att.ts_server AT TIME ZONE 'Asia/Jakarta')::int, EXTRACT(YEAR FROM att.ts_server AT TIME ZONE 'Asia/Jakarta')::int 
      ORDER BY COUNT(*) DESC
    ) as rn
  FROM public.attendance att
  JOIN public.outlets o ON att.outlet_id = o.id
  WHERE att.type = 'in' 
    AND att.outlet_id IS NOT NULL 
    AND att.outlet_id != 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    AND o.name NOT ILIKE '%tes%'
  GROUP BY att.outlet_staff_id, EXTRACT(MONTH FROM att.ts_server AT TIME ZONE 'Asia/Jakarta')::int, EXTRACT(YEAR FROM att.ts_server AT TIME ZONE 'Asia/Jakarta')::int, att.outlet_id
)
UPDATE public.payroll_records pr
SET outlet_id = mdo.outlet_id
FROM monthly_dominant_outlet mdo
JOIN public.outlet_staff os ON mdo.staff_id = os.id
WHERE pr.staff_id = mdo.staff_id
  AND pr.period_month = mdo.period_month
  AND pr.period_year = mdo.period_year
  AND mdo.rn = 1
  AND os.role NOT IN ('area_manager', 'regional_manager');
