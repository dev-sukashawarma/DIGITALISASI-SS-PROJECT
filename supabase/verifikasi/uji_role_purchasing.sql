-- Uji 20260911130000 sebagai user asli. ROLLBACK.
-- Harapan: "HASIL: LULUS ..."
BEGIN;
DO $$
DECLARE v_purch uuid; v_crew uuid; n_hist int; n_pr int; n_crew int; n_total int;
BEGIN
  SELECT id INTO v_purch FROM public.outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM public.outlet_staff WHERE role='crew' AND status='active' LIMIT 1;
  SELECT count(*) INTO n_total FROM public.bahan_baku_harga_history;
  IF v_purch IS NULL OR v_crew IS NULL THEN RAISE EXCEPTION 'GAGAL: data uji tak ketemu'; END IF;
  IF n_total = 0 THEN RAISE EXCEPTION 'GAGAL: riwayat harga kosong -- uji tak bermakna'; END IF;

  -- purchasing
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n_hist FROM public.bahan_baku_harga_history;
  SELECT count(*) INTO n_pr   FROM public.purchase_request;
  EXECUTE 'RESET ROLE';
  IF n_hist <> n_total THEN RAISE EXCEPTION 'GAGAL: purchasing lihat % dari % baris riwayat', n_hist, n_total; END IF;
  -- n_pr boleh 0 bila tabel kosong; bandingkan dengan total
  IF n_pr <> (SELECT count(*) FROM public.purchase_request) THEN
    RAISE EXCEPTION 'GAGAL: purchasing lihat % permintaan beli, total %', n_pr, (SELECT count(*) FROM public.purchase_request);
  END IF;

  -- crew: kontrol -- tetap NOL
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n_crew FROM public.bahan_baku_harga_history;
  EXECUTE 'RESET ROLE';
  IF n_crew <> 0 THEN RAISE EXCEPTION 'GAGAL: crew bisa baca % baris riwayat harga', n_crew; END IF;

  RAISE EXCEPTION 'HASIL: LULUS (purchasing baca riwayat %/% & permintaan beli %, crew 0)', n_hist, n_total, n_pr;
END $$;
ROLLBACK;
