-- 20260912160000_bucket_app_banners.sql
--
-- Membuat bucket storage `app-banners` untuk gambar banner aplikasi pelanggan.
-- Melengkapi 20260911100000_app_banners.sql: tabelnya sudah ada, tempat
-- gambarnya belum. Tanpa ini, tombol unggah di halaman Banner Aplikasi gagal
-- dengan "Bucket not found".
--
-- Nama bucket HARUS persis 'app-banners' -- dipatok di PanelEditBanner.tsx
-- baris 11 (`const BUCKET = 'app-banners'`).
--
-- public = true karena URL-nya disajikan apa adanya ke aplikasi pelanggan
-- lewat getPublicUrl(); pembaca banner adalah orang yang belum login.

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-banners', 'app-banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================================
-- Hak akses
-- ============================================================================
-- Baca: siapa saja (isi banner memang untuk publik).
-- Tulis: role `admin` PERSIS -- sengaja disamakan dengan app_banners_all_admin
-- di 20260911100000, bukan dengan pola `authenticated` milik bucket lama
-- seperti guide-images. Kalau tulisnya dibiarkan `authenticated`, tiap staf
-- yang bisa login boleh menaruh berkas di bucket publik, padahal tak satu pun
-- dari mereka bisa membuat baris banner-nya. `owner` dan `admin_hr` adalah
-- role berbeda dan sengaja tidak lolos.

DROP POLICY IF EXISTS app_banners_obj_select_public ON storage.objects;
CREATE POLICY app_banners_obj_select_public ON storage.objects
  FOR SELECT
  USING (bucket_id = 'app-banners');

DROP POLICY IF EXISTS app_banners_obj_insert_admin ON storage.objects;
CREATE POLICY app_banners_obj_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'app-banners'
    AND EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role = 'admin' AND s.status = 'active'
    )
  );

DROP POLICY IF EXISTS app_banners_obj_update_admin ON storage.objects;
CREATE POLICY app_banners_obj_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'app-banners'
    AND EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role = 'admin' AND s.status = 'active'
    )
  );

DROP POLICY IF EXISTS app_banners_obj_delete_admin ON storage.objects;
CREATE POLICY app_banners_obj_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'app-banners'
    AND EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role = 'admin' AND s.status = 'active'
    )
  );
