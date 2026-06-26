-- supabase/migrations/20260626102000_remove_kasir_role.sql

-- 1. Reassign existing users with 'kasir' role to 'crew'
UPDATE public.outlet_staff
SET role = 'crew'
WHERE role = 'kasir';

-- 2. Drop the old CHECK constraint
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;

-- 3. Recreate the CHECK constraint without 'kasir'
ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN ('admin', 'admin_hr', 'owner', 'spv', 'leader', 'crew', 'kiosk', 'kitchen'));

-- 4. Update `accessible_outlet_ids` function to remove 'kasir'
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
      AND me.role IN ('leader', 'crew', 'kiosk');
$$;
