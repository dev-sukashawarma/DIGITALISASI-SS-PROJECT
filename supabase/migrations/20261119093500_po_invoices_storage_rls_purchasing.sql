-- 20261119093500_po_invoices_storage_rls_purchasing.sql
-- Perluas storage policy bucket 'po-invoices' agar selaras dengan can_manage_po()
-- (admin, owner, kitchen, purchasing, admin_finance, developer).
-- Sebelumnya 20260707100800 hanya mengizinkan ('admin', 'kitchen'), sehingga role
-- purchasing/admin_finance ditolak saat mengunggah invoice di /supplier padahal
-- invoice wajib diunggah sebelum mengajukan pembayaran PO ke finance.

DROP POLICY IF EXISTS "po_invoices_select" ON storage.objects;
CREATE POLICY "po_invoices_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'po-invoices'
    AND public.can_manage_po()
  );

DROP POLICY IF EXISTS "po_invoices_insert" ON storage.objects;
CREATE POLICY "po_invoices_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'po-invoices'
    AND public.can_manage_po()
  );

DROP POLICY IF EXISTS "po_invoices_update" ON storage.objects;
CREATE POLICY "po_invoices_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'po-invoices'
    AND public.can_manage_po()
  )
  WITH CHECK (
    bucket_id = 'po-invoices'
    AND public.can_manage_po()
  );

DROP POLICY IF EXISTS "po_invoices_delete" ON storage.objects;
CREATE POLICY "po_invoices_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'po-invoices'
    AND public.is_owner_or_admin()
  );
