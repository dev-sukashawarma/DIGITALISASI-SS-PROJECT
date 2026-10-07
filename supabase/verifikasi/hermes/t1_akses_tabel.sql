-- Uji akses tabel Hermes (spec 2026-10-07 §5). Selalu ROLLBACK — nol perubahan nyata.
-- Lulus = selesai tanpa error.
BEGIN;
DO $$
DECLARE v_admin uuid; v_ok boolean;
BEGIN
  IF to_regclass('public.hermes_api_key') IS NULL OR to_regclass('public.hermes_api_log') IS NULL THEN
    RAISE EXCEPTION 'tabel hermes belum ada';
  END IF;
  SELECT id INTO v_admin FROM outlet_staff WHERE role = 'admin' AND status = 'active' LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'fixture admin kosong'; END IF;

  -- (a) admin login (authenticated) TIDAK boleh membaca kunci
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM 1 FROM public.hermes_api_key LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(a) authenticated bisa membaca hermes_api_key'; END IF;

  -- (b) authenticated tidak boleh menulis log
  v_ok := false;
  BEGIN INSERT INTO public.hermes_api_log (status) VALUES ('ok');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(b) authenticated bisa menulis hermes_api_log'; END IF;
  RESET ROLE;

  -- (c) anon tidak boleh membaca
  SET LOCAL ROLE anon;
  v_ok := false;
  BEGIN PERFORM 1 FROM public.hermes_api_key LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(c) anon bisa membaca hermes_api_key'; END IF;
  RESET ROLE;

  -- (d) CHECK scope menolak domain asing
  v_ok := false;
  BEGIN INSERT INTO public.hermes_api_key (nama, prefix, hash_kunci, scope)
        VALUES ('uji', 'abcdef12', repeat('a', 64), ARRAY['gaji']);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(d) scope asing diterima'; END IF;
END $$;
ROLLBACK;
-- Kontrol negatif (jalankan terpisah, harus GAGAL): ganti ARRAY['gaji'] di (d) menjadi ARRAY['penjualan'].
