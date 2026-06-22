-- 20260622000000_add_admin_hr_role.sql
-- Menambahkan role 'admin_hr' ke constraint outlet_staff

-- 1. Drop CHECK constraint lama
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;

-- 2. Recreate CHECK constraint dengan 'admin_hr'
ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN ('admin', 'admin_hr', 'owner', 'spv', 'leader', 'kasir', 'crew', 'kiosk'));

-- 3. Update fungsi `accessible_outlet_ids` agar `admin_hr` juga punya akses global lintas outlet (seperti admin)
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id FROM outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv')
  UNION
  SELECT so.outlet_id FROM staff_outlets so, me
    WHERE me.role = 'leader' AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('leader','kasir','crew','kiosk');
$$;
