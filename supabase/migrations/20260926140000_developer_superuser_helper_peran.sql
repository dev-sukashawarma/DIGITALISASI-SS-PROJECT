-- Role `developer` = superuser teknis: akses penuh setara owner + admin.
-- Disetujui owner 2026-09-26.
--
-- Migration ini hanya menyentuh HELPER peran pusat, bukan badan RPC besar,
-- supaya tidak ada risiko menimpa perbaikan lain lewat CREATE OR REPLACE
-- (pelajaran ranjau-2030). Tiap helper disalin dari definisi TERAKHIR di repo;
-- satu-satunya perubahan: menambahkan 'developer'. Opsi lain (SECURITY DEFINER,
-- search_path, STABLE, syarat status) dipertahankan apa adanya.
--
-- Definisi sumber:
--   is_admin               20260622110000_admin_hr_rls_updates.sql
--   is_owner               20260702100000_expenses_outlet_vs_pusat.sql
--   is_owner_or_admin      20260623140000_owner_messages.sql
--   is_finance_checker     20260711140000_update_is_finance_checker.sql
--   can_manage_po          20260922210000_perbaiki_penjaga_peran_finance_po.sql
--   can_approve_po         20260723100100_purchase_rpcs_guards.sql
--   can_verify_po_receipt  20260723100100_purchase_rpcs_guards.sql
--   _peran_master          20260923182000_invarian_faktor_bahan.sql
--   auth_is_supervisor     20300103000000_fix_auth_is_supervisor_enroll.sql
--   can_write_bahan_baku   20260918130000_kunci_tulis_bahan_baku.sql
--   can_set_harga_outlet   20260918170000_kunci_tulis_harga_outlet_sales_channels.sql
--   peran_saya             20260911120000_drop_ship_skema.sql
--
-- peran_saya(): developer dipetakan ke 'admin'. Semua pemakaiannya (drop-ship,
-- nota vendor, saldo vendor, penyesuaian vendor, laporan kiriman vendor) adalah
-- pemeriksaan otorisasi yang sudah menyertakan 'admin' — tidak ada yang
-- menyimpan hasilnya ke kolom.
--
-- ⚠️ SEBELUM APPLY: bandingkan tiap helper dengan definisi live
--   SELECT pg_get_functiondef('public.<nama>'::regproc);
-- Kalau live berbeda dari berkas sumber di atas (diubah lewat SQL Editor),
-- sesuaikan dulu — jangan timpa perubahan live yang tak tercatat.
--
-- BELUM tercakup (cek peran inline di badan fungsi / policy, butuh definisi
-- live untuk ditambal aman): ubah_hpp_menu, create_surat_jalan(+_with_number),
-- batalkan_surat_jalan_draft, update_surat_jalan_item_vendor,
-- send_surat_jalan_signed, finalize_eom_closing, admin_adjust_petty_cash,
-- admin_override_outlet_petty_cash, create_petty_cash_topup,
-- tinjau_ceklist_harian, hard_reset_outlet_data, policy bbh_write, bbs_*_k1,
-- expenses_*_admin, outlets_all_admin, dll.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('admin', 'admin_hr', 'owner', 'developer')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role IN ('owner', 'developer'));
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND role IN ('owner', 'admin', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_finance_checker() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('owner','admin','admin_finance','developer'));
$$;

CREATE OR REPLACE FUNCTION public.can_manage_po()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(auth.jwt() ->> 'role' = 'service_role', false)
    OR EXISTS (
         SELECT 1 FROM public.outlet_staff
          WHERE id = auth.uid()
            AND status = 'active'
            AND role IN ('admin', 'owner', 'kitchen', 'purchasing', 'admin_finance', 'developer')
       );
$function$;

CREATE OR REPLACE FUNCTION public.can_approve_po()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('admin_finance','owner','admin','developer'));
$$;

CREATE OR REPLACE FUNCTION public.can_verify_po_receipt()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('kitchen','admin','owner','developer'));
$$;

CREATE OR REPLACE FUNCTION public._peran_master(p_lingkup text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.outlet_staff WHERE id = v_uid AND status = 'active';
  IF p_lingkup = 'data' AND v_role IN ('admin', 'owner', 'developer') THEN
    RETURN v_uid;
  END IF;
  IF p_lingkup = 'harga' AND v_role IN ('admin', 'owner', 'purchasing', 'developer') THEN
    RETURN v_uid;
  END IF;
  RAISE EXCEPTION 'Peran % tidak berhak mengubah master bahan baku (lingkup %)', COALESCE(v_role, '-'), p_lingkup
    USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public._peran_master(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.auth_is_supervisor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('spv', 'leader', 'kitchen', 'admin', 'admin_hr', 'owner', 'developer')
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_bahan_baku()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('admin', 'owner', 'purchasing', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_set_harga_outlet()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('admin', 'owner', 'spv', 'regional_manager', 'developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.peran_saya()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN s.role = 'developer' THEN 'admin' ELSE s.role END
  FROM public.outlet_staff s WHERE s.id = auth.uid() AND s.status = 'active'
$$;

COMMIT;
