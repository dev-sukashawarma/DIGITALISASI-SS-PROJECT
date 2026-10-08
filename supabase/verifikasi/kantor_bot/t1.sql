-- Uji status_kantor_bot(). Jalankan seluruh berkas sekali; semua dalam transaksi + ROLLBACK.
-- LULUS = berakhir tanpa error dengan NOTICE 'T1 LULUS'.
BEGIN;
DO $$
DECLARE
  v_owner uuid;
  v_crew  uuid;
  v_n int;
  v_kolom text[];
  v_ditolak boolean := false;
BEGIN
  -- Ambil fixture SEBELUM berganti peran (RLS bisa menyembunyikan baris).
  SELECT id INTO v_owner FROM outlet_staff WHERE role IN ('owner','admin','developer') AND status = 'active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  IF v_owner IS NULL OR v_crew IS NULL THEN RAISE EXCEPTION 'fixture tidak ada'; END IF;

  -- (a) owner/admin bisa membaca; jumlah = kunci aktif
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.status_kantor_bot();
  RESET ROLE;
  IF v_n <> (SELECT count(*) FROM hermes_api_key WHERE aktif) THEN
    RAISE EXCEPTION '(a) jumlah baris % ≠ kunci aktif', v_n;
  END IF;

  -- (b) kolom keluaran persis, tanpa kolom sensitif
  SELECT array_agg(p ORDER BY o) INTO v_kolom
  FROM unnest((SELECT proargnames FROM pg_proc WHERE proname = 'status_kantor_bot'))
       WITH ORDINALITY AS t(p, o);
  IF v_kolom <> ARRAY['id','nama','scope','dibuat_at','terakhir_at','status_terakhir','alat_terakhir','panggilan_hari_ini'] THEN
    RAISE EXCEPTION '(b) kolom keluaran salah: %', v_kolom;
  END IF;

  -- (c) crew ditolak 42501
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM * FROM public.status_kantor_bot();
  EXCEPTION WHEN insufficient_privilege THEN v_ditolak := true;
  END;
  RESET ROLE;
  IF NOT v_ditolak THEN RAISE EXCEPTION '(c) crew tidak ditolak'; END IF;

  -- (d) anon & PUBLIC tanpa EXECUTE; authenticated punya
  IF has_function_privilege('anon', 'public.status_kantor_bot()', 'EXECUTE') THEN
    RAISE EXCEPTION '(d) anon punya EXECUTE';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.status_kantor_bot()', 'EXECUTE') THEN
    RAISE EXCEPTION '(d) authenticated tanpa EXECUTE';
  END IF;

  -- (e) SECURITY DEFINER + search_path terkunci
  IF NOT (SELECT prosecdef FROM pg_proc WHERE proname = 'status_kantor_bot') THEN
    RAISE EXCEPTION '(e) bukan SECURITY DEFINER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'status_kantor_bot'
                 AND proconfig @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION '(e) search_path tidak terkunci';
  END IF;

  RAISE NOTICE 'T1 LULUS';
END $$;
ROLLBACK;
