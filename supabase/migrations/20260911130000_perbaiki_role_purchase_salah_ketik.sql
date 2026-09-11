-- 20260911130000_perbaiki_role_purchase_salah_ketik.sql
--
-- Lima policy memakai role 'purchase' -- role itu TIDAK ADA (0 staff). Role
-- nyata = 'purchasing' (2 staff). Ditemukan 2026-09-11 saat uji drop-ship.
--
--   bahan_baku_harga_history / bbhh_select   -> purchasing tak bisa baca riwayat harga   (CELAH NYATA)
--   purchase_request / pr_select             -> purchasing tak bisa lihat permintaan beli (CELAH NYATA)
--   purchase_request / pr_update             -> purchasing tak bisa memproses permintaan  (CELAH NYATA)
--   purchase_order / po_select_purchase      -> duplikat mati; purchasing sudah lolos lewat po_select (can_manage_po)
--   purchase_order_item / poi_select_purchase-> duplikat mati; idem poi_select
--
-- Struktur tiap ekspresi dipertahankan PERSIS; hanya 'purchase' -> 'purchasing'.
-- Tidak ada role lain yang ditambah/dicabut. ALTER POLICY idempoten.
-- Policy lain yang memuat 'purchase' (supplier_*, bbs_*, bbsh_select) sudah
-- memuat 'purchasing' juga -- tidak disentuh.

ALTER POLICY bbhh_select ON public.bahan_baku_harga_history
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                  WHERE outlet_staff.id = auth.uid()
                    AND outlet_staff.role = ANY (ARRAY['admin','owner','kitchen','purchasing'])));

ALTER POLICY po_select_purchase ON public.purchase_order
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                  WHERE outlet_staff.id = auth.uid() AND outlet_staff.role = 'purchasing'));

ALTER POLICY poi_select_purchase ON public.purchase_order_item
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                  WHERE outlet_staff.id = auth.uid() AND outlet_staff.role = 'purchasing'));

ALTER POLICY pr_select ON public.purchase_request
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                  WHERE outlet_staff.id = auth.uid()
                    AND outlet_staff.role = ANY (ARRAY['kitchen','spv','purchasing','admin','owner'])));

ALTER POLICY pr_update ON public.purchase_request
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                  WHERE outlet_staff.id = auth.uid()
                    AND outlet_staff.role = ANY (ARRAY['purchasing','admin','owner'])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.outlet_staff
                  WHERE outlet_staff.id = auth.uid()
                    AND outlet_staff.role = ANY (ARRAY['purchasing','admin','owner'])));

-- Asersi: tak ada lagi policy yang menyebut 'purchase' tanpa 'purchasing'.
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM pg_policies
   WHERE (coalesce(qual,'') || coalesce(with_check,'')) ~ '''purchase'''
     AND NOT (coalesce(qual,'') || coalesce(with_check,'')) ~ '''purchasing''';
  IF v > 0 THEN RAISE EXCEPTION 'Masih ada % policy ber-role purchase tanpa purchasing', v; END IF;
END $$;

-- DOWN: ganti 'purchasing' kembali ke 'purchase' di kelima policy di atas.
