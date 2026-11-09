-- supabase/verifikasi/ganti_satuan/t1_skema.sql — harapan: NOTICE 'HASIL T1: LULUS' (lewat konektor MCP: tanpa galat = lulus)
-- Task 1 Ganti Satuan: kolom satuan_diganti_at, tabel log, penjaga WHEN di 10 trigger efek samping.
-- Sebelum migration 20261109103055 harus GAGAL pada asersi (a).
BEGIN;
DO $$
DECLARE
  v_trg text[][] := ARRAY[
    ['stok_balance','on_stok_balance_update_send_push'],
    ['stok_balance','trg_bot_manager_stok_drop50'],
    ['stok_balance','trg_bot_manager_stok_kritis'],
    ['stok_balance','trg_bot_telegram_penurunan_stok_tidak_wajar'],
    ['stok_balance','trg_bot_telegram_stok_kritis'],
    ['stok_waste_reports','trg_sync_waste_ledger'],
    ['stok_waste_reports','trg_validate_stok_waste_report_input'],
    ['stok_waste_reports','trg_waste_report_approval'],
    ['stok_waste_reports','trg_stok_push_waste_pending_approval'],
    ['terima_vendor_outlet','trg_sync_terima_vendor_ledger']];
  i int; v_def text; v_crew uuid; v_ok boolean; v_w uuid; v_n0 bigint; v_n1 bigint;
BEGIN
  -- (a) kolom & tabel
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='bahan_baku' AND column_name='satuan_diganti_at') THEN
    RAISE EXCEPTION 'GAGAL (a): kolom bahan_baku.satuan_diganti_at tidak ada';
  END IF;
  IF to_regclass('public.bahan_baku_ganti_satuan') IS NULL THEN
    RAISE EXCEPTION 'GAGAL (a): tabel bahan_baku_ganti_satuan tidak ada';
  END IF;

  -- (b) tiap trigger ada dan memuat penjaga
  FOR i IN 1 .. array_length(v_trg, 1) LOOP
    SELECT pg_get_triggerdef(t.oid) INTO v_def FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relnamespace='public'::regnamespace AND c.relname = v_trg[i][1] AND t.tgname = v_trg[i][2];
    IF v_def IS NULL THEN RAISE EXCEPTION 'GAGAL (b): trigger %.% hilang', v_trg[i][1], v_trg[i][2]; END IF;
    IF v_def !~ 'app\.ganti_satuan' THEN RAISE EXCEPTION 'GAGAL (b): %.% tanpa penjaga', v_trg[i][1], v_trg[i][2]; END IF;
  END LOOP;

  -- (c) crew tidak bisa membaca log
  SELECT id INTO v_crew FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN
    -- RLS: crew boleh SELECT tapi hasilnya wajib kosong (policy hanya owner/admin)
    IF (SELECT count(*) FROM public.bahan_baku_ganti_satuan) = 0 THEN v_ok := true; END IF;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c)'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bahan_baku_ganti_satuan'
             AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'GAGAL (c): ada policy tulis di tabel log';
  END IF;

  -- (d) perilaku: laporan waste APPROVED yang benar-benar memotong stok
  SELECT w.id INTO v_w FROM stok_waste_reports w
   WHERE w.status='APPROVED' AND w.created_at >= '2026-09-02 00:00:00+07' AND w.qty > 0
     AND EXISTS (SELECT 1 FROM ledger_stok l WHERE l.ref_waste_id = w.id AND l.qty <> 0)
   ORDER BY w.created_at DESC LIMIT 1;
  IF v_w IS NULL THEN RAISE EXCEPTION 'GAGAL (d): fixture waste tak ada'; END IF;

  -- dengan bendera: tak ada baris ledger baru
  SELECT count(*) INTO v_n0 FROM ledger_stok WHERE ref_waste_id = v_w;
  PERFORM set_config('app.ganti_satuan', 'on', true);
  UPDATE stok_waste_reports SET qty = qty * 2 WHERE id = v_w;
  SELECT count(*) INTO v_n1 FROM ledger_stok WHERE ref_waste_id = v_w;
  IF v_n1 <> v_n0 THEN RAISE EXCEPTION 'GAGAL (d): bendera menyala tapi ledger bertambah % -> %', v_n0, v_n1; END IF;

  -- kontrol: tanpa bendera, UPDATE yang sama menulis ledger
  PERFORM set_config('app.ganti_satuan', '', true);
  UPDATE stok_waste_reports SET qty = qty * 2 WHERE id = v_w;
  SELECT count(*) INTO v_n1 FROM ledger_stok WHERE ref_waste_id = v_w;
  IF v_n1 <= v_n0 THEN RAISE EXCEPTION 'GAGAL (d-kontrol): tanpa bendera tidak menulis ledger'; END IF;

  RAISE NOTICE 'HASIL T1: LULUS';
END $$;
ROLLBACK;
