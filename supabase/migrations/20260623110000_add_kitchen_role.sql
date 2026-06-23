-- supabase/migrations/20260623110000_add_kitchen_role.sql
-- Menambahkan role 'kitchen' ke constraint outlet_staff & RLS/fungsi terkait

-- 1. Drop CHECK constraint lama
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;

-- 2. Recreate CHECK constraint dengan 'kitchen'
ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN ('admin', 'admin_hr', 'owner', 'spv', 'leader', 'kasir', 'crew', 'kiosk', 'kitchen'));

-- 3. Update fungsi `accessible_outlet_ids` agar `kitchen` punya akses global (seperti spv)
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
      AND me.role IN ('leader','kasir','crew','kiosk');
$$;

-- 4. Update fungsi `auth_is_supervisor` agar `kitchen` dihitung sebagai supervisor
CREATE OR REPLACE FUNCTION public.auth_is_supervisor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('spv', 'leader', 'kitchen')
  );
$$;

-- 5. Update RLS policies untuk menyertakan role 'kitchen'

-- apps/absensi: oac_update_spv
DROP POLICY IF EXISTS oac_update_spv ON public.outlet_attendance_config;
CREATE POLICY oac_update_spv
  ON public.outlet_attendance_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = outlet_attendance_config.outlet_id
        AND me.role IN ('spv','leader','kitchen')
    )
  );

-- apps/absensi: attendance_spv_read_outlet
DROP POLICY IF EXISTS attendance_spv_read_outlet ON public.attendance;
CREATE POLICY attendance_spv_read_outlet
  ON public.attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = attendance.outlet_id
        AND me.role IN ('spv', 'leader', 'kitchen')
    )
  );

-- apps/absensi: checklist_categories
DROP POLICY IF EXISTS "SPV can manage categories in their outlet" ON public.checklist_categories;
CREATE POLICY "SPV can manage categories in their outlet" ON public.checklist_categories
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE outlet_staff.id = auth.uid()
      AND outlet_staff.outlet_id = checklist_categories.outlet_id
      AND outlet_staff.role IN ('spv', 'leader', 'kitchen')
  ));

-- apps/absensi: checklist_items
DROP POLICY IF EXISTS "SPV can manage items in their outlet" ON public.checklist_items;
CREATE POLICY "SPV can manage items in their outlet" ON public.checklist_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checklist_categories c
    JOIN public.outlet_staff s ON s.outlet_id = c.outlet_id
    WHERE c.id = checklist_items.category_id
      AND s.id = auth.uid()
      AND s.role IN ('spv', 'leader', 'kitchen')
  ));
