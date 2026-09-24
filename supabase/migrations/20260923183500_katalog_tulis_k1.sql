-- supabase/migrations/20260923183500_katalog_tulis_k1.sql
-- Sejak 20260923183000 trigger trg_bbs_turunkan_harga_master menurunkan
-- bahan_baku_harga.harga_beli dari katalog vendor: MENULIS KATALOG = MENULIS HARGA
-- MASTER (HPP, nilai persediaan). Policy bbs_write lama (FOR ALL) mengizinkan
-- admin/kitchen/purchasing/admin_finance/owner/developer tanpa cek status.
-- Spec 2026-09-23 K1: hanya admin/owner/purchasing yang AKTIF boleh mengubah harga.
--
-- bbs_write (ALL) diganti tiga policy tulis (INSERT/UPDATE/DELETE). Akses BACA tidak
-- berubah: bbs_select memuat daftar peran yang persis sama dengan bbs_write lama,
-- jadi hilangnya cakupan SELECT dari bbs_write tak mengurangi siapa pun.
-- Penulis SECURITY DEFINER (katalog_tulis_dari_po, sahkan_nota_vendor) melewati RLS
-- dan tidak terpengaruh. Satu-satunya penulis lewat RLS di app:
-- apps/admin-dashboard/src/hooks/useKatalogVendor.ts (nav ADMIN, PURCHASING).

DROP POLICY IF EXISTS bbs_write ON public.bahan_baku_supplier;
DROP POLICY IF EXISTS bbs_insert_k1 ON public.bahan_baku_supplier;
DROP POLICY IF EXISTS bbs_update_k1 ON public.bahan_baku_supplier;
DROP POLICY IF EXISTS bbs_delete_k1 ON public.bahan_baku_supplier;

CREATE POLICY bbs_insert_k1 ON public.bahan_baku_supplier
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.outlet_staff s
                       WHERE s.id = (SELECT auth.uid()) AND s.status = 'active'
                         AND s.role IN ('admin','owner','purchasing')));

CREATE POLICY bbs_update_k1 ON public.bahan_baku_supplier
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff s
                  WHERE s.id = (SELECT auth.uid()) AND s.status = 'active'
                    AND s.role IN ('admin','owner','purchasing')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.outlet_staff s
                       WHERE s.id = (SELECT auth.uid()) AND s.status = 'active'
                         AND s.role IN ('admin','owner','purchasing')));

CREATE POLICY bbs_delete_k1 ON public.bahan_baku_supplier
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff s
                  WHERE s.id = (SELECT auth.uid()) AND s.status = 'active'
                    AND s.role IN ('admin','owner','purchasing')));
