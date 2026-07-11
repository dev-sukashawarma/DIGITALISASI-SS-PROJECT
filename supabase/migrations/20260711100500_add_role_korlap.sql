-- 20260711100500_add_role_korlap.sql
-- Tambah role 'korlap' untuk koordinator lapangan (khususnya untuk region luar bogor).
-- Korlap memiliki akses scope outlet seperti leader, melalui staff_outlets.

-- 1. Perluas CHECK constraint outlet_staff.role — sertakan SEMUA role valid + korlap
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN (
    'admin', 'admin_hr', 'owner', 'spv', 'leader',
    'crew', 'kiosk', 'kitchen', 'mitra', 'staff_pusat', 'admin_finance', 'korlap'
  ));

-- 2. Update accessible_outlet_ids agar korlap mengakses outlet spesifik yang diassign di staff_outlets
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id FROM public.outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv', 'kitchen', 'admin_finance')
  UNION
  SELECT so.outlet_id FROM public.staff_outlets so, me
    WHERE me.role IN ('leader', 'korlap') AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('crew', 'kiosk', 'mitra', 'staff_pusat');
$$;

-- Note: No DOWN script provided as standard practice in this project unless requested.
