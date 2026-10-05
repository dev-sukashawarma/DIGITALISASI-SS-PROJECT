-- Uji RLS SUKA Bot. Jalankan seluruh berkas; selalu ROLLBACK (nol perubahan nyata).
-- Lulus = selesai tanpa error. Kontrol negatif ada di bagian akhir (dikomentari).
BEGIN;

DO $$
DECLARE
  v_admin uuid; v_crew uuid; v_dev uuid; v_n int; v_pc uuid;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role = 'admin' AND status = 'active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role = 'crew'  AND status = 'active' LIMIT 1;
  SELECT id INTO v_dev   FROM outlet_staff WHERE role = 'developer' AND status = 'active' LIMIT 1;
  IF v_admin IS NULL OR v_crew IS NULL OR v_dev IS NULL THEN RAISE EXCEPTION 'fixture kosong'; END IF;

  -- (a) admin bisa membuat percakapan & pesan miliknya
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO suka_bot_percakapan (judul) VALUES ('uji') RETURNING id INTO v_pc;
  INSERT INTO suka_bot_pesan (percakapan_id, peran, isi) VALUES (v_pc, 'user', 'halo');
  SELECT count(*) INTO v_n FROM suka_bot_pesan WHERE percakapan_id = v_pc;
  IF v_n <> 1 THEN RAISE EXCEPTION '(a) admin tak bisa baca pesannya: %', v_n; END IF;

  -- (b) RPC pemakaian menghitung naik
  IF public.suka_bot_catat_pemakaian(10, 5) <> 1 THEN RAISE EXCEPTION '(b) hitungan pertama bukan 1'; END IF;
  IF public.suka_bot_catat_pemakaian(10, 5) <> 2 THEN RAISE EXCEPTION '(b) hitungan kedua bukan 2'; END IF;

  -- (c) admin tidak bisa membaca log gagal (khusus developer)
  INSERT INTO suka_bot_gagal (pertanyaan, alasan) VALUES ('laba kemarin?', 'di_luar_alat');
  SELECT count(*) INTO v_n FROM suka_bot_gagal;
  IF v_n <> 0 THEN RAISE EXCEPTION '(c) admin bisa baca suka_bot_gagal'; END IF;
  RESET ROLE;

  -- (d) crew: tidak bisa melihat percakapan admin, tidak bisa insert apa pun
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM suka_bot_percakapan;
  IF v_n <> 0 THEN RAISE EXCEPTION '(d) crew melihat % percakapan', v_n; END IF;
  SELECT count(*) INTO v_n FROM suka_bot_rekap;
  IF v_n <> 0 THEN RAISE EXCEPTION '(d) crew melihat rekap'; END IF;
  BEGIN
    INSERT INTO suka_bot_percakapan (judul) VALUES ('crew');
    RAISE EXCEPTION '(d) crew berhasil insert percakapan';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.suka_bot_catat_pemakaian(1, 1);
    RAISE EXCEPTION '(d) crew berhasil memanggil RPC pemakaian';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  -- (e) developer bisa membaca log gagal
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dev, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM suka_bot_gagal;
  IF v_n < 1 THEN RAISE EXCEPTION '(e) developer tak bisa baca log gagal'; END IF;
  RESET ROLE;

  -- (f) anon nol akses
  IF has_table_privilege('anon', 'public.suka_bot_rekap', 'select') THEN RAISE EXCEPTION '(f) anon bisa select rekap'; END IF;
  IF has_function_privilege('anon', 'public.suka_bot_catat_pemakaian(integer,integer)', 'execute') THEN RAISE EXCEPTION '(f) anon bisa execute RPC'; END IF;

  -- (g) rekap unik per (tanggal, versi)
  INSERT INTO suka_bot_rekap (tanggal, versi, data, teks, dibuat_oleh) VALUES ('2026-01-01', 1, '{}', 'x', v_admin);
  BEGIN
    INSERT INTO suka_bot_rekap (tanggal, versi, data, teks, dibuat_oleh) VALUES ('2026-01-01', 1, '{}', 'y', v_admin);
    RAISE EXCEPTION '(g) rekap kembar lolos';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  RAISE NOTICE 'SEMUA LULUS';
END $$;

-- Kontrol negatif (jalankan terpisah, harus GAGAL): ganti asersi (a) menjadi
-- IF v_n <> 2 ... dan pastikan error '(a) ...' muncul.
ROLLBACK;
