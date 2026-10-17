-- Policy RLS untuk outlet_reorder_point (pengaturan threshold per outlet).
--
-- Tabel ini dibuat manual di luar migration dengan RLS aktif tetapi TANPA satu pun
-- policy, sehingga setiap klien ber-JWT (aplikasi native) ditolak total: override
-- tidak terbaca dan simpan gagal 42501. Selama ini hanya Server Action web
-- ber-service-role yang bisa menulis. View monitoring tidak terdampak karena
-- berjalan sebagai pemilik view.
--
-- Baca: semua staf, terbatas outlet yang bisa diakses.
-- Tulis: admin & kitchen (Admin Kitchen), plus owner/developer — terbatas outlet
-- yang bisa diakses.

CREATE OR REPLACE FUNCTION public.can_edit_threshold()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(auth.jwt()->>'role' = 'service_role', false)
      OR EXISTS (
        SELECT 1 FROM public.outlet_staff
        WHERE id = auth.uid()
          AND role IN ('kitchen', 'admin', 'owner', 'developer')
          AND (status = 'active' OR is_active IS TRUE)
      );
$$;

REVOKE ALL ON FUNCTION public.can_edit_threshold() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_threshold() TO authenticated, service_role;

DROP POLICY IF EXISTS orp_select ON public.outlet_reorder_point;
CREATE POLICY orp_select ON public.outlet_reorder_point
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS orp_insert ON public.outlet_reorder_point;
CREATE POLICY orp_insert ON public.outlet_reorder_point
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.can_edit_threshold())
    AND outlet_id IN (SELECT public.accessible_outlet_ids())
  );

DROP POLICY IF EXISTS orp_update ON public.outlet_reorder_point;
CREATE POLICY orp_update ON public.outlet_reorder_point
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.can_edit_threshold())
    AND outlet_id IN (SELECT public.accessible_outlet_ids())
  )
  WITH CHECK (
    (SELECT public.can_edit_threshold())
    AND outlet_id IN (SELECT public.accessible_outlet_ids())
  );

DROP POLICY IF EXISTS orp_delete ON public.outlet_reorder_point;
CREATE POLICY orp_delete ON public.outlet_reorder_point
  FOR DELETE TO authenticated
  USING (
    (SELECT public.can_edit_threshold())
    AND outlet_id IN (SELECT public.accessible_outlet_ids())
  );
