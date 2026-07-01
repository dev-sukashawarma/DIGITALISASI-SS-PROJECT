-- 20260629110000_add_staff_pusat_role.sql
-- Menambahkan role 'staff_pusat' untuk orang kantor pusat yang hanya akses absensi.

-- 1. Perluas CHECK constraint outlet_staff.role dengan 'staff_pusat'
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN ('admin', 'admin_hr', 'owner', 'spv', 'leader', 'crew', 'kiosk', 'kitchen', 'staff_pusat'));

-- 2. Update accessible_outlet_ids agar staff_pusat bisa mengakses data untuk outlet_id home mereka (seperti crew)
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id FROM public.outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv', 'kitchen')
  UNION
  SELECT so.outlet_id FROM public.staff_outlets so, me
    WHERE me.role = 'leader' AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('leader', 'crew', 'kiosk', 'staff_pusat');
$$;
