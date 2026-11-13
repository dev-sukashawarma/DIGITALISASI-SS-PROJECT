-- Status mitra tidak lagi dikenali dari nama outlet (Wizard Pembukaan Outlet, Tahap 0b).
--
-- Sebelumnya get_owner_dashboard_summary menganggap outlet mitra bila
--   type = 'mitra' ATAU punya baris mitra_investments ATAU nama ILIKE '%mitra%'.
-- Nama diketik bebas, jadi outlet internal bernama "... Mitra ..." akan diam-diam
-- kena markup HPP mitra. Sekarang: type ATAU baris investasi, dan baris investasi
-- dijaga trigger agar hanya ada untuk outlet ber-type 'mitra' — kedua penanda
-- selalu sepakat.
--
-- Data 2026-11-13: nol outlet yang hasilnya berubah (uji t0 membuktikan ringkasan
-- Agustus–November identik).
--
-- (a) Patch terarah get_owner_dashboard_summary lewat pg_get_functiondef, bukan
--     salin ulang 14 KB: SET plan_cache_mode=force_custom_plan WAJIB bertahan
--     (tanpa itu fungsi kena statement timeout 8 dtk). Idempoten.
-- (b) Trigger penjaga mitra_investments.

DO $$
DECLARE
  v_oid  oid;
  v_def  text;
  v_baru text;
  v_n    int;
BEGIN
  SELECT p.oid INTO v_oid
  FROM pg_proc p
  WHERE p.proname = 'get_owner_dashboard_summary'
    AND p.pronamespace = 'public'::regnamespace;

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'get_owner_dashboard_summary tidak ditemukan';
  END IF;

  v_def := pg_get_functiondef(v_oid);
  SELECT count(*) INTO v_n
  FROM regexp_matches(v_def, $re$\n\s*OR COALESCE\(o\.name, ''\) ILIKE '%mitra%'$re$, 'g');

  IF v_n = 0 THEN
    RAISE NOTICE 'Aturan nama sudah tidak ada — lewati (idempoten)';
  ELSIF v_n <> 1 THEN
    RAISE EXCEPTION 'Pola aturan nama ditemukan % kali, harus tepat 1', v_n;
  ELSE
    v_baru := regexp_replace(v_def, $re$\n\s*OR COALESCE\(o\.name, ''\) ILIKE '%mitra%'$re$, '', 'g');
    EXECUTE v_baru;
  END IF;

  -- Penjaga sesudah patch
  v_def := pg_get_functiondef(v_oid);
  IF v_def ~* $re$ILIKE '%mitra%'$re$ THEN
    RAISE EXCEPTION 'Aturan nama masih tersisa di get_owner_dashboard_summary';
  END IF;
  IF v_def !~ $re$mitra_investments mi WHERE mi\.outlet_id = o\.id$re$ THEN
    RAISE EXCEPTION 'Penanda investasi ikut hilang — patch salah';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = v_oid
      AND 'plan_cache_mode=force_custom_plan' = ANY (proconfig)
      AND 'search_path=public' = ANY (proconfig)
  ) THEN
    RAISE EXCEPTION 'SET plan_cache_mode / search_path hilang dari get_owner_dashboard_summary';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mitra_investments_wajib_outlet_mitra()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.outlets o WHERE o.id = NEW.outlet_id AND o.type = 'mitra'
  ) THEN
    RAISE EXCEPTION 'Data investasi hanya untuk outlet berjenis Mitra'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mitra_investments_wajib_outlet_mitra ON public.mitra_investments;
CREATE TRIGGER trg_mitra_investments_wajib_outlet_mitra
  BEFORE INSERT OR UPDATE OF outlet_id ON public.mitra_investments
  FOR EACH ROW EXECUTE FUNCTION public.mitra_investments_wajib_outlet_mitra();
