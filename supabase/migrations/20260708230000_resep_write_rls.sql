-- 20260708230000_resep_write_rls.sql
-- Menambahkan policy RLS (Row-Level Security) untuk INSERT, UPDATE, DELETE pada tabel resep dan resep_item
-- Mengizinkan admin/owner untuk membuat dan mengubah resep dari aplikasi front-end.

DROP POLICY IF EXISTS resep_write ON public.resep;
CREATE POLICY resep_write ON public.resep
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS resep_item_write ON public.resep_item;
CREATE POLICY resep_item_write ON public.resep_item
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
