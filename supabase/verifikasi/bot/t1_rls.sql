-- Uji RLS webapp Bot (spec 2026-10-07 webapp §6). Selalu ROLLBACK. Lulus = tanpa error.
BEGIN;
DO $$
DECLARE a uuid; b uuid; pa uuid; n int; v_ok boolean;
BEGIN
  IF to_regclass('public.bot_percakapan') IS NULL THEN RAISE EXCEPTION 'tabel bot belum ada'; END IF;
  SELECT id INTO a FROM outlet_staff WHERE role IN ('admin','owner') AND status='active' ORDER BY id LIMIT 1;
  SELECT id INTO b FROM outlet_staff WHERE role IN ('admin','owner','developer') AND status='active' AND id <> a ORDER BY id LIMIT 1;
  IF a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'fixture kurang'; END IF;

  -- (a) A membuat percakapan + pesan
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO bot_percakapan (profil, judul) VALUES ('ceo', 'uji') RETURNING id INTO pa;
  INSERT INTO bot_pesan (percakapan_id, peran, isi) VALUES (pa, 'user', 'halo');
  RESET ROLE;

  -- (b) B tidak melihat & tidak bisa menghapus milik A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM bot_percakapan WHERE id = pa;
  IF n <> 0 THEN RAISE EXCEPTION '(b) B melihat percakapan A'; END IF;
  SELECT count(*) INTO n FROM bot_pesan WHERE percakapan_id = pa;
  IF n <> 0 THEN RAISE EXCEPTION '(b) B melihat pesan A'; END IF;
  DELETE FROM bot_percakapan WHERE id = pa;
  RESET ROLE;
  SELECT count(*) INTO n FROM bot_percakapan WHERE id = pa;
  IF n <> 1 THEN RAISE EXCEPTION '(b) B menghapus percakapan A'; END IF;

  -- (c) B tidak bisa menulis pesan ke percakapan A
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN INSERT INTO bot_pesan (percakapan_id, peran, isi) VALUES (pa, 'user', 'nyusup');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(c) B menulis ke percakapan A'; END IF;
  RESET ROLE;

  -- (d) anon nol akses
  SET LOCAL ROLE anon;
  v_ok := false;
  BEGIN PERFORM 1 FROM bot_percakapan LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(d) anon membaca bot_percakapan'; END IF;
  RESET ROLE;
END $$;
ROLLBACK;
-- Kontrol negatif (terpisah, harus GAGAL): di (b) ganti klaim sub B menjadi A.
