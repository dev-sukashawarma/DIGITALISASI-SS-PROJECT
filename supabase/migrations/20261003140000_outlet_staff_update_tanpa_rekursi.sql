-- Perbaiki "42P17 infinite recursion detected in policy for relation outlet_staff".
--
-- Versi live `outlet_staff_update_own_outlet` (diubah langsung di DB, tidak ada di repo)
-- menambahkan cabang AM/RM berupa `EXISTS (SELECT 1 FROM outlet_staff me ...)`.
-- Subquery ke tabel yang sama dari dalam policy-nya sendiri membuat Postgres gagal
-- saat menyusun RLS untuk SETIAP UPDATE `outlet_staff` oleh role authenticated —
-- termasuk admin/developer — sehingga enrollment wajah (native & web) gagal total.
-- Masalah yang sama sudah pernah dibereskan di 20260609002000 dengan helper
-- SECURITY DEFINER; di sini pola itu diulang untuk cabang AM/RM.
--
-- Aturan akses TIDAK berubah: supervisor atau AM/RM aktif, pada outlet yang bisa
-- diakses atau outlet utamanya sendiri.

CREATE OR REPLACE FUNCTION public.auth_is_area_or_regional_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
     WHERE id = (SELECT auth.uid())
       AND role IN ('area_manager', 'regional_manager')
       AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_area_or_regional_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_area_or_regional_manager() TO authenticated;

ALTER POLICY outlet_staff_update_own_outlet ON public.outlet_staff
  USING (
    ((SELECT public.auth_is_supervisor()) OR (SELECT public.auth_is_area_or_regional_manager()))
    AND (
      outlet_id IN (SELECT public.accessible_outlet_ids())
      OR outlet_id = (SELECT public.auth_outlet_id())
    )
  )
  WITH CHECK (
    ((SELECT public.auth_is_supervisor()) OR (SELECT public.auth_is_area_or_regional_manager()))
    AND (
      outlet_id IN (SELECT public.accessible_outlet_ids())
      OR outlet_id = (SELECT public.auth_outlet_id())
    )
  );
