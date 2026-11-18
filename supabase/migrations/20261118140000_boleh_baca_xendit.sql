-- Apakah pemanggil boleh membaca xendit_pembayaran? Dipakai laporan untuk tidak
-- memuat/menampilkan status Xendit bagi peran di luar policy (review akhir 18 Nov:
-- tanpa ini, peran tanpa akses melihat semua pesanan website "⏳ Belum").
-- Satu sumber aturan: policy xendit_pembayaran_baca ikut memakai fungsi ini.
CREATE OR REPLACE FUNCTION public.boleh_baca_xendit()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.status = 'active'
      AND s.role IN ('owner','admin','admin_finance','admin_hr','developer')
  )
$$;

REVOKE ALL ON FUNCTION public.boleh_baca_xendit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boleh_baca_xendit() TO authenticated, service_role;

DROP POLICY IF EXISTS xendit_pembayaran_baca ON public.xendit_pembayaran;
CREATE POLICY xendit_pembayaran_baca ON public.xendit_pembayaran
  FOR SELECT TO authenticated
  USING (public.boleh_baca_xendit());
