-- supabase/verifikasi/hpp_dinamis/t1_pengerasan.sql
-- Harapan: "HASIL T1: LULUS ..."
BEGIN;
DO $$
DECLARE v_keju uuid; v_kecil_baru numeric; v_kecil_manual numeric; v_ok boolean;
        v_owner uuid; v_n int;
BEGIN
  SELECT id INTO v_owner FROM outlet_staff WHERE role='owner' AND status='active' LIMIT 1;
  SELECT id INTO v_keju FROM bahan_baku WHERE nama='KEJU';  -- bahan 3 tingkat, 9 baris waste di rentang
  IF v_owner IS NULL OR v_keju IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- (a) hpp_kecil KEJU di breakdown = harga_beli / kemasan_qty
  SELECT bh.harga_beli / bh.kemasan_qty INTO v_kecil_manual FROM bahan_baku_harga bh WHERE bh.bahan_baku_id=v_keju;
  SELECT max(hpp_kecil) INTO v_kecil_baru FROM get_waste_breakdown('2026-08-01','2026-09-14') WHERE bahan_baku_id = v_keju;
  IF v_kecil_baru IS NOT NULL AND abs(v_kecil_baru - v_kecil_manual) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (a): hpp_kecil KEJU % <> %', v_kecil_baru, v_kecil_manual;
  END IF;
  IF v_kecil_baru IS NULL THEN
    RAISE EXCEPTION 'GAGAL (a): KEJU tidak punya baris waste di rentang -- ganti fixture';
  END IF;
  EXECUTE 'RESET ROLE';

  -- (b) po_on_verified tidak ada
  SELECT count(*) INTO v_n FROM pg_proc WHERE proname='po_on_verified';
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (b): po_on_verified ada'; END IF;

  -- (c) kontrol negatif: asersi yang PASTI salah harus melempar
  v_ok := false;
  BEGIN
    IF v_kecil_manual = v_kecil_manual THEN RAISE EXCEPTION 'KONTROL'; END IF;
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): kontrol negatif tidak melempar'; END IF;

  RAISE EXCEPTION 'HASIL T1: LULUS (hpp_kecil kemasan_qty, po_on_verified hilang, kontrol negatif)';
END $$;
ROLLBACK;
