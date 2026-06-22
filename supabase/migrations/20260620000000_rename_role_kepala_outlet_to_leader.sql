-- 20260620000000_rename_role_kepala_outlet_to_leader.sql
-- Rename role value 'kepala_outlet' -> 'leader' (jobdesk Leader Outlet, ADR/docs ref: ROLE-JOBDESK.md).
-- role tetap TEXT + CHECK (bukan enum native), jadi rename = update constraint + data + semua
-- SQL literal yang bandingkan role = 'kepala_outlet'.

-- 1. Drop CHECK constraint first (old constraint doesn't allow 'leader' yet, so we must
--    widen before backfilling data, then tighten back down once data is migrated).
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;

-- 2. Backfill existing rows now that the constraint is gone.
UPDATE public.outlet_staff SET role = 'leader' WHERE role = 'kepala_outlet';

-- 3. Recreate CHECK constraint (drop old name from 20260613000300, recreate with new value).
ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN ('admin', 'owner', 'spv', 'leader', 'kasir', 'crew', 'kiosk'));

-- 4. Helper functions (from 20260613000500_accessible_outlets_fn.sql, 20260609002000_create_surat_jalan.sql)
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
    WHERE me.role = 'leader' AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('leader','kasir','crew','kiosk');
$$;

CREATE OR REPLACE FUNCTION public.auth_is_supervisor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND role IN ('spv', 'leader')
  );
$$;

-- 5. RLS policies with inline 'kepala_outlet' literal — drop + recreate with 'leader'.

-- apps/stok: bahan_baku_write (20260609001700_stok_rls.sql)
DROP POLICY IF EXISTS bahan_baku_write ON public.bahan_baku;
CREATE POLICY bahan_baku_write ON public.bahan_baku FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'leader'))
  WITH CHECK (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'leader'));

-- apps/absensi: oac_update_spv (20260610000300_m1_attendance_rls.sql)
DROP POLICY IF EXISTS oac_update_spv ON public.outlet_attendance_config;
CREATE POLICY oac_update_spv
  ON public.outlet_attendance_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = outlet_attendance_config.outlet_id
        AND me.role IN ('spv','leader')
    )
  );

-- apps/absensi: attendance_spv_read_outlet (20260610000600_add_signatures_to_surat_jalan.sql)
DROP POLICY IF EXISTS attendance_spv_read_outlet ON public.attendance;
CREATE POLICY attendance_spv_read_outlet
  ON public.attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = attendance.outlet_id
        AND me.role IN ('spv', 'leader')
    )
  );

-- apps/absensi: checklist_categories / checklist_items "SPV can manage..." (20260611000000_m1_absensi_checklist.sql)
DROP POLICY IF EXISTS "SPV can manage categories in their outlet" ON public.checklist_categories;
CREATE POLICY "SPV can manage categories in their outlet" ON public.checklist_categories
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE outlet_staff.id = auth.uid()
      AND outlet_staff.outlet_id = checklist_categories.outlet_id
      AND outlet_staff.role IN ('spv', 'leader')
  ));

DROP POLICY IF EXISTS "SPV can manage items in their outlet" ON public.checklist_items;
CREATE POLICY "SPV can manage items in their outlet" ON public.checklist_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checklist_categories c
    JOIN outlet_staff s ON s.outlet_id = c.outlet_id
    WHERE c.id = checklist_items.category_id
      AND s.id = auth.uid()
      AND s.role IN ('spv', 'leader')
  ));

-- 6. Cosmetic: comment on column referenced 'kepala_outlet' in prose.
COMMENT ON COLUMN public.outlet_staff.consent_by IS 'SPV/leader yang melakukan enroll';
