-- Uji Task 1 pelacakan driver (skema, RLS, pengetatan update SJ).
-- Jalankan sebagai satu batch. Harapan: error P0001 "HASIL T1: LULUS ...".
-- Pesan galat lain = gagal.
BEGIN;
DO $$
DECLARE
  v_driver  uuid;
  v_kitchen uuid;
  v_crew    uuid;
  v_sj      uuid;
  v_n       int;
  v_t       text;
BEGIN
  -- Fixture diambil SEBELUM ganti peran (subquery di bawah RLS bisa kosong).
  SELECT id INTO v_driver  FROM outlet_staff WHERE role = 'driver'  AND status = 'active' LIMIT 1;
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role = 'kitchen' AND status = 'active' LIMIT 1;
  SELECT id INTO v_crew    FROM outlet_staff WHERE role = 'crew'    AND status = 'active' AND outlet_id IS NOT NULL LIMIT 1;
  SELECT id INTO v_sj      FROM surat_jalan  WHERE status IN ('dikirim','dikirim_lengkap') LIMIT 1;
  IF v_driver IS NULL OR v_kitchen IS NULL OR v_crew IS NULL OR v_sj IS NULL THEN
    RAISE EXCEPTION 'GAGAL: fixture tidak lengkap';
  END IF;

  -- 1. Tabel ada
  FOREACH v_t IN ARRAY ARRAY['driver_perjalanan','driver_perjalanan_stop','driver_lokasi_terkini','driver_lokasi_jejak'] LOOP
    PERFORM 1 FROM pg_class WHERE relname = v_t AND relnamespace = 'public'::regnamespace;
    IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: tabel % tidak ada', v_t; END IF;
  END LOOP;

  -- 2. Realtime: tiga tabel masuk, jejak tidak
  SELECT count(*) INTO v_n FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime'
     AND tablename IN ('driver_lokasi_terkini','driver_perjalanan','driver_perjalanan_stop');
  IF v_n <> 3 THEN RAISE EXCEPTION 'GAGAL: realtime % dari 3 tabel', v_n; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'driver_lokasi_jejak';
  IF FOUND THEN RAISE EXCEPTION 'GAGAL: jejak ikut realtime'; END IF;

  -- 3. Grant: tulis langsung dicabut, SELECT ada, anon nol
  IF has_table_privilege('authenticated', 'public.driver_perjalanan', 'INSERT')
     OR has_table_privilege('authenticated', 'public.driver_lokasi_jejak', 'INSERT')
     OR has_table_privilege('authenticated', 'public.driver_lokasi_terkini', 'UPDATE') THEN
    RAISE EXCEPTION 'GAGAL: authenticated masih bisa menulis tabel pelacakan';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.driver_perjalanan_stop', 'SELECT') THEN
    RAISE EXCEPTION 'GAGAL: authenticated tidak bisa SELECT stop';
  END IF;
  IF has_table_privilege('anon', 'public.driver_lokasi_terkini', 'SELECT') THEN
    RAISE EXCEPTION 'GAGAL: anon bisa SELECT lokasi';
  END IF;

  -- 4. Pengaturan
  PERFORM 1 FROM global_settings WHERE key = 'driver_tracking' AND (value->>'interval_detik')::int = 30;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: pengaturan driver_tracking'; END IF;

  -- Fixture data pelacakan: satu perjalanan milik driver, satu milik staf lain.
  INSERT INTO driver_perjalanan (driver_id, status, berangkat_at) VALUES (v_driver, 'selesai', now());
  INSERT INTO driver_perjalanan (driver_id, status, berangkat_at) VALUES (v_kitchen, 'selesai', now());
  INSERT INTO driver_lokasi_terkini (driver_id, lat, lng, direkam_at) VALUES (v_driver, -6.6, 106.8, now());

  -- 5. Driver hanya melihat miliknya
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_driver, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM driver_perjalanan WHERE driver_id IN (v_driver, v_kitchen);
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL: driver melihat % perjalanan (harus 1)', v_n; END IF;
  BEGIN
    INSERT INTO driver_perjalanan (driver_id, status, berangkat_at) VALUES (v_driver, 'berjalan', now());
    RAISE EXCEPTION 'GAGAL: driver bisa INSERT langsung';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Pengetatan: driver tidak bisa UPDATE surat_jalan
  UPDATE surat_jalan SET notes = notes WHERE id = v_sj;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL: driver bisa UPDATE surat_jalan'; END IF;
  RESET ROLE;

  -- 6. Kitchen (pelacak) melihat semua; tetap bisa UPDATE surat_jalan (kontrol positif)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM driver_perjalanan WHERE driver_id IN (v_driver, v_kitchen);
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL: kitchen melihat % perjalanan (harus 2)', v_n; END IF;
  SELECT count(*) INTO v_n FROM driver_lokasi_terkini WHERE driver_id = v_driver;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL: kitchen tidak melihat lokasi terkini'; END IF;
  UPDATE surat_jalan SET notes = notes WHERE id = v_sj;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL: kitchen tidak bisa UPDATE surat_jalan (pengetatan kebablasan)'; END IF;
  RESET ROLE;

  -- 7. Crew tidak melihat apa pun
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT (SELECT count(*) FROM driver_perjalanan) + (SELECT count(*) FROM driver_lokasi_terkini)
       + (SELECT count(*) FROM driver_perjalanan_stop) + (SELECT count(*) FROM driver_lokasi_jejak) INTO v_n;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL: crew melihat % baris pelacakan', v_n; END IF;
  RESET ROLE;

  -- 8. Policy update SJ item ikut menolak driver (cek katalog; tak ada SJ BNR dikirim untuk uji perilaku)
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE tablename IN ('surat_jalan','surat_jalan_item')
     AND policyname IN ('surat_jalan_update_scoped','surat_jalan_item_update_scoped','sj_item_update')
     AND qual LIKE '%is_driver_aktif()%';
  IF v_n <> 3 THEN RAISE EXCEPTION 'GAGAL: % dari 3 policy update menolak driver', v_n; END IF;

  RAISE EXCEPTION 'HASIL T1: LULUS (tabel, realtime, grant, setting, RLS driver/kitchen/crew, pengetatan SJ)';
END $$;
ROLLBACK;
