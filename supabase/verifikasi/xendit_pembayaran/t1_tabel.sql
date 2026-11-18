-- Uji tabel xendit_pembayaran. Jalan di dalam transaksi dan SELALU dibatalkan
-- (RAISE di akhir) — tidak meninggalkan data. "UJI OK" = lulus.
BEGIN;
DO $$
DECLARE
  v_crew uuid; v_fin uuid; n int; ok boolean;
BEGIN
  INSERT INTO public.xendit_pembayaran (xendit_id, nominal, dibayar_at, sumber)
  VALUES ('uji-1', 34204, now(), 'file');

  -- xendit_id unik
  BEGIN
    INSERT INTO public.xendit_pembayaran (xendit_id, nominal, dibayar_at, sumber) VALUES ('uji-1', 1, now(), 'file');
    RAISE EXCEPTION 'GAGAL: xendit_id dobel diterima';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- cara_cocok dibatasi
  BEGIN
    INSERT INTO public.xendit_pembayaran (xendit_id, nominal, dibayar_at, sumber, cara_cocok) VALUES ('uji-2', 1, now(), 'file', 'ngawur');
    RAISE EXCEPTION 'GAGAL: cara_cocok ngawur diterima';
  EXCEPTION WHEN check_violation THEN NULL; END;

  SELECT id INTO v_crew FROM public.outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  SELECT id INTO v_fin  FROM public.outlet_staff WHERE role = 'admin_finance' AND status = 'active' LIMIT 1;

  -- crew tidak melihat apa pun
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.xendit_pembayaran WHERE xendit_id = 'uji-1';
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'GAGAL: crew melihat % baris', n; END IF;

  -- admin_finance melihat
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_fin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.xendit_pembayaran WHERE xendit_id = 'uji-1';
  -- authenticated tidak boleh menulis
  ok := false;
  BEGIN
    INSERT INTO public.xendit_pembayaran (xendit_id, nominal, dibayar_at, sumber) VALUES ('uji-3', 1, now(), 'file');
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  RESET ROLE;
  IF n <> 1 THEN RAISE EXCEPTION 'GAGAL: admin_finance melihat % baris', n; END IF;
  IF NOT ok THEN RAISE EXCEPTION 'GAGAL: authenticated bisa INSERT'; END IF;

  RAISE EXCEPTION 'UJI OK';
END $$;
ROLLBACK;
