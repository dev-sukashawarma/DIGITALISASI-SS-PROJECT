-- Admin Inventori dapat memantau hasil sidak tanpa memperoleh hak tulis.
DROP POLICY IF EXISTS inventaris_sidak_reviews_admin_read ON public.inventaris_sidak_reviews;
CREATE POLICY inventaris_sidak_reviews_admin_read ON public.inventaris_sidak_reviews
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff me
      WHERE me.id = auth.uid() AND me.role = 'admin' AND me.status = 'active'
    )
  );

DROP POLICY IF EXISTS inventaris_sidak_review_items_admin_read ON public.inventaris_sidak_review_items;
CREATE POLICY inventaris_sidak_review_items_admin_read ON public.inventaris_sidak_review_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff me
      WHERE me.id = auth.uid() AND me.role = 'admin' AND me.status = 'active'
    )
  );
