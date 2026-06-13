-- 20260613000500_accessible_outlets_fn.sql
-- Mengembalikan himpunan outlet_id yang boleh diakses user saat ini, sesuai role.
--  - admin/owner/spv  : semua outlet
--  - kepala_outlet     : outlet di staff_outlets + outlet_id home (bila ada)
--  - kasir/crew/kiosk  : outlet_id home
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
    WHERE me.role IN ('admin','owner','spv')
  UNION
  SELECT so.outlet_id FROM staff_outlets so, me
    WHERE me.role = 'kepala_outlet' AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('kepala_outlet','kasir','crew','kiosk');
$$;
