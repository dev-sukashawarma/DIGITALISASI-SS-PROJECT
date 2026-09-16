-- =============================================================================
-- 20260916100000_bersihkan_role_mati_policy_vendor.sql
-- =============================================================================
-- Kebersihan, BUKAN perbaikan fungsional. Diverifikasi ke DB live 2026-09-16
-- SEBELUM migration ini ditulis: role `purchasing` SUDAH bisa membaca keempat
-- tabel (supplier 25, katalog 61, riwayat katalog 123, riwayat harga 20),
-- crew tetap 0 — jadi tidak ada yang rusak hari ini.
--
-- Lima policy di tiga tabel memuat dua nama role yang TIDAK ADA di
-- `outlet_staff` sama sekali (0 baris, status apa pun): `'purchase'` (salah
-- ketik `purchasing`) dan `'finance'` (peninggalan; yang nyata `admin_finance`).
-- Keduanya tidak pernah cocok dengan siapa pun, tapi sudah sempat menyesatkan:
-- catatan sesi drop-ship 11 Sep mencatatnya sebagai penghalang go-live
-- ("purchasing tak bisa membaca bahan_baku_harga_history") padahal
-- `bbhh_select` sendiri sudah benar sejak saat itu.
--
-- Efek yang diharapkan: NOL perubahan perilaku. Daftar role setelah ini persis
-- role yang benar-benar ada: admin, kitchen, purchasing, admin_finance, owner,
-- developer.
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_roles CONSTANT text :=
    $r$ARRAY['admin'::text, 'kitchen'::text, 'purchasing'::text, 'admin_finance'::text, 'owner'::text, 'developer'::text]$r$;
  v_pred  text := 'EXISTS (SELECT 1 FROM public.outlet_staff WHERE outlet_staff.id = auth.uid() AND outlet_staff.role = ANY (' || v_roles || '))';
  v_n int;
BEGIN
  -- Pra-cek: nama role mati benar-benar tak dipakai siapa pun.
  SELECT count(*) INTO v_n FROM public.outlet_staff WHERE role IN ('purchase', 'finance');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'PRA-CEK GAGAL: % baris outlet_staff memakai role purchase/finance — jangan dibuang', v_n;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS bbs_select ON public.bahan_baku_supplier';
  EXECUTE 'CREATE POLICY bbs_select ON public.bahan_baku_supplier FOR SELECT TO authenticated USING (' || v_pred || ')';

  EXECUTE 'DROP POLICY IF EXISTS bbs_write ON public.bahan_baku_supplier';
  EXECUTE 'CREATE POLICY bbs_write ON public.bahan_baku_supplier FOR ALL TO authenticated USING (' || v_pred || ') WITH CHECK (' || v_pred || ')';

  EXECUTE 'DROP POLICY IF EXISTS bbsh_select ON public.bahan_baku_supplier_history';
  EXECUTE 'CREATE POLICY bbsh_select ON public.bahan_baku_supplier_history FOR SELECT TO authenticated USING (' || v_pred || ')';

  EXECUTE 'DROP POLICY IF EXISTS supplier_select ON public.supplier';
  EXECUTE 'CREATE POLICY supplier_select ON public.supplier FOR SELECT TO authenticated USING (' || v_pred || ')';

  EXECUTE 'DROP POLICY IF EXISTS supplier_write ON public.supplier';
  EXECUTE 'CREATE POLICY supplier_write ON public.supplier FOR ALL TO authenticated USING (' || v_pred || ') WITH CHECK (' || v_pred || ')';
END $$;

DO $$
DECLARE v_n int;
BEGIN
  -- Lingkup asersi SENGAJA hanya lima policy vendor ini. Nama role mati
  -- 'finance' juga muncul di 5 policy domain lain (petty_cash_expenses,
  -- petty_cash_topups, cancellation_requests, inbound_outbound x2) — sama-sama
  -- tak cocok dengan siapa pun, tapi milik alur lain; tidak disentuh di sini.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname IN ('bbs_select','bbs_write','bbsh_select','supplier_select','supplier_write')
     AND (coalesce(qual,'') LIKE '%''purchase''%' OR coalesce(with_check,'') LIKE '%''purchase''%'
       OR coalesce(qual,'') LIKE '%''finance''%'  OR coalesce(with_check,'') LIKE '%''finance''%');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: masih % policy vendor memuat role mati', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname IN ('bbs_select','bbs_write','bbsh_select','supplier_select','supplier_write')
     AND coalesce(qual,'') LIKE '%''purchasing''%';
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: hanya % dari 5 policy memuat purchasing', v_n;
  END IF;
END $$;

COMMIT;
