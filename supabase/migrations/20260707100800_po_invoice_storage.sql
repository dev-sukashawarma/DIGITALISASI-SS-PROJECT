-- 20260707100800_po_invoice_storage.sql
-- Tambahkan kolom invoice_urls ke purchase_order untuk menyimpan foto invoice supplier.
-- Storage bucket 'po-invoices' dibuat terpisah dari 'distribusi' agar quota terisolasi.
-- Format path: po-invoices/{po_id}/{timestamp}-{filename}

-- 1. Kolom invoice_urls (array of storage paths, bisa multi-halaman)
ALTER TABLE public.purchase_order
  ADD COLUMN IF NOT EXISTS invoice_urls TEXT[] NOT NULL DEFAULT '{}';

-- 2. Buat storage bucket 'po-invoices'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'po-invoices',
  'po-invoices',
  false,   -- private: hanya user terauthentikasi yang bisa akses
  10485760, -- 10 MB per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies untuk po-invoices
-- SELECT: admin + kitchen
CREATE POLICY "po_invoices_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'po-invoices'
    AND EXISTS (
      SELECT 1 FROM public.outlet_staff
      WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
    )
  );

-- INSERT: admin + kitchen (upload foto)
CREATE POLICY "po_invoices_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'po-invoices'
    AND EXISTS (
      SELECT 1 FROM public.outlet_staff
      WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
    )
  );

-- UPDATE: admin + kitchen
CREATE POLICY "po_invoices_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'po-invoices'
    AND EXISTS (
      SELECT 1 FROM public.outlet_staff
      WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
    )
  );

-- DELETE: admin only
CREATE POLICY "po_invoices_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'po-invoices'
    AND EXISTS (
      SELECT 1 FROM public.outlet_staff
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- DOWN:
-- ALTER TABLE public.purchase_order DROP COLUMN IF EXISTS invoice_urls;
-- DELETE FROM storage.buckets WHERE id = 'po-invoices';
