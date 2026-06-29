-- 20260629100000_add_mitra_role.sql
-- Role baru 'mitra': partner/investor 1 outlet. Hanya akses admin-dashboard,
-- read-only, scope ke outlet_id home-nya. Isolasi server-enforced via
-- accessible_outlet_ids(). Owner/admin tidak terpengaruh (helper mengembalikan
-- semua outlet untuk mereka).

-- 1. Perluas CHECK constraint outlet_staff.role dengan 'mitra'
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN ('admin', 'admin_hr', 'owner', 'spv', 'leader', 'crew', 'kiosk', 'kitchen', 'mitra'));

-- 2. accessible_outlet_ids: mitra → outlet_id home (single), seperti crew/kiosk
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
      AND me.role IN ('leader', 'crew', 'kiosk', 'mitra');
$$;

-- 3. Scoped views — filter ke outlet yang boleh diakses pemanggil.
--    accessible_outlet_ids() (SECURITY DEFINER) membaca auth.uid() pemanggil,
--    jadi owner/admin → semua outlet, mitra → satu outlet.
CREATE OR REPLACE VIEW public.sales_hourly_scoped AS
  SELECT * FROM public.sales_hourly_spv
  WHERE outlet_id IN (SELECT public.accessible_outlet_ids());
GRANT SELECT ON public.sales_hourly_scoped TO authenticated;

CREATE OR REPLACE VIEW public.menu_sales_scoped AS
  SELECT * FROM public.menu_sales_spv
  WHERE outlet_id IN (SELECT public.accessible_outlet_ids());
GRANT SELECT ON public.menu_sales_scoped TO authenticated;

CREATE OR REPLACE VIEW public.daily_target_progress_scoped AS
  SELECT * FROM public.daily_target_progress_spv
  WHERE outlet_id IN (SELECT public.accessible_outlet_ids());
GRANT SELECT ON public.daily_target_progress_scoped TO authenticated;

-- 4. get_current_targets: scope ke accessible outlets (owner/admin tetap semua)
CREATE OR REPLACE FUNCTION public.get_current_targets()
RETURNS TABLE (outlet_id UUID, outlet_name TEXT, target_amount NUMERIC, is_override BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id,
    o.name,
    public.resolve_daily_target(o.id, (now() AT TIME ZONE 'Asia/Jakarta')::date),
    EXISTS (SELECT 1 FROM public.daily_sales_targets t WHERE t.outlet_id = o.id)
  FROM public.outlets o
  WHERE o.id IN (SELECT public.accessible_outlet_ids())
  ORDER BY o.name;
$$;

-- 5. expenses: ganti SELECT policy permissif (USING true) → scoped.
--    Owner/admin/spv tetap baca semua (helper kembalikan semua outlet).
--    INSERT/UPDATE/DELETE tetap seperti semula (mitra tak punya UI tulis).
DROP POLICY IF EXISTS "expenses_select_all" ON public.expenses;
CREATE POLICY "expenses_select_scoped" ON public.expenses
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));
