-- Kelola Modal Investasi di Dashboard Kemitraan gagal untuk akun developer:
-- "new row violates row-level security policy for table mitra_investments".
--
-- Policy *_admin_all di empat tabel mitra hanya mengenal role admin & owner,
-- padahal developer sudah termasuk peran pengelola di tempat lain
-- (is_owner_or_admin(), Go-Live outlet, ubah_hpp_menu). Dialog investasi juga
-- menyinkronkan mitra_profiles, yang kena penolakan sama (diam-diam).
--
-- Perbaikan: tambah developer, dan syaratkan staf aktif (sebelumnya akun
-- admin/owner nonaktif pun masih bisa menulis). Mitra tetap hanya lewat
-- *_select_own (tidak disentuh).

DO $$
DECLARE
  t text;
  v_cek text := $q$EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = (SELECT auth.uid())
      AND s.role = ANY (ARRAY['admin'::text, 'owner'::text, 'developer'::text])
      AND s.status = 'active'
  )$q$;
BEGIN
  FOREACH t IN ARRAY ARRAY['mitra_investments','mitra_profiles','mitra_transfers','mitra_suggestions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (%s) WITH CHECK (%s)',
      t || '_admin_all', t, v_cek, v_cek
    );
  END LOOP;
END $$;
