-- 20260711180000_korlap_global_access.sql
-- Recorded retroactively: this was applied directly to the remote database
-- (not through a committed migration file) and is captured here so local
-- migration history matches what is actually live. It introduced a regression
-- (admin_hr/spv/kitchen lost all-outlet access; crew/kiosk/mitra/staff_pusat
-- lost outlet access entirely) that is corrected by the next migration
-- (20260711190000_fix_accessible_outlet_ids_regression.sql).

CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- 1. Outlets explicitly linked to the staff (for crew, leader)
  SELECT outlet_id
  FROM public.staff_outlets
  WHERE staff_id = auth.uid()

  UNION

  -- 2. ALL outlets if user is owner, admin, or admin_finance
  SELECT id
  FROM public.outlets
  WHERE EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND (role = 'owner' OR role = 'admin' OR role = 'admin_finance')
  )

  UNION

  -- 3. ALL NON-BOGOR outlets if user is korlap
  SELECT id
  FROM public.outlets
  WHERE EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role = 'korlap'
  )
  AND (
    name NOT ILIKE '%bogor%' AND
    name NOT ILIKE '%empang%' AND
    name NOT ILIKE '%cimanggu%' AND
    name NOT ILIKE '%pajajaran%' AND
    name NOT ILIKE '%tajur%' AND
    name NOT ILIKE '%cibinong%' AND
    name NOT ILIKE '%yasmin%' AND
    name NOT ILIKE '%sukasari%' AND
    name NOT ILIKE '%ciomas%' AND
    name NOT ILIKE '%dramaga%' AND
    name NOT ILIKE '%parung%'
  )
$$
