-- Uji Task 3 pelacakan driver (sinkron SJ, status outlet, tutup otomatis, retensi).
-- Harapan: error P0001 "HASIL T3: LULUS ...". Pesan galat lain = gagal.
BEGIN;
DO $$
DECLARE
  v_driver uuid; v_crew uuid; v_crew_lain uuid; v_outlet uuid;
  o2 uuid; sj1 uuid; sj2 uuid; sj3 uuid; sj4 uuid;
  v_pid uuid; v_pid2 uuid; v_n int; r record; v_json text;
  v_ledger_sebelum int; v_ledger_sesudah int;
BEGIN
  SELECT id INTO v_driver FROM outlet_staff WHERE role = 'driver' AND status = 'active' LIMIT 1;
  SELECT id, outlet_id INTO v_crew, v_outlet FROM outlet_staff
   WHERE role = 'crew' AND status = 'active' AND outlet_id IS NOT NULL LIMIT 1;
  SELECT id INTO v_crew_lain FROM outlet_staff
   WHERE role = 'crew' AND status = 'active' AND outlet_id IS NOT NULL AND outlet_id <> v_outlet LIMIT 1;
  SELECT id INTO o2 FROM outlets WHERE is_active AND type IN ('internal','mitra') AND id <> v_outlet LIMIT 1;
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (v_outlet, 'dikirim', 'UJI-T3-1') RETURNING id INTO sj1;
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (o2,       'dikirim', 'UJI-T3-2') RETURNING id INTO sj2;
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (o2,       'dikirim', 'UJI-T3-3') RETURNING id INTO sj3;
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (v_outlet, 'dikirim', 'UJI-T3-4') RETURNING id INTO sj4;

  -- Perjalanan: urutan sj2, sj1 (outletnya crew di urutan 2)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_driver, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_pid := (driver_mulai_perjalanan(ARRAY[sj2, sj1], -6.6, 106.8)->>'perjalanan_id')::uuid;
  RESET ROLE;

  -- 1. status_antar_sj untuk crew outlet tujuan: 1 outlet lagi, tanpa koordinat
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT * INTO r FROM status_antar_sj(sj1);
  IF NOT r.dilacak OR r.outlet_sebelum <> 1 OR r.status_stop <> 'menunggu' OR r.nama_driver IS NULL THEN
    RAISE EXCEPTION 'GAGAL: status_antar_sj %', row_to_json(r);
  END IF;
  SELECT row_to_json(x)::text INTO v_json FROM status_antar_sj(sj1) x;
  IF v_json ~* '(lat|lng|jarak|akurasi)' THEN RAISE EXCEPTION 'GAGAL: status outlet memuat koordinat %', v_json; END IF;
  SELECT * INTO r FROM status_antar_sj(sj4);
  IF r.dilacak IS DISTINCT FROM false THEN RAISE EXCEPTION 'GAGAL: SJ tanpa perjalanan harus dilacak=false'; END IF;
  RESET ROLE;

  -- 2. crew outlet lain tidak mendapat apa pun
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew_lain, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM status_antar_sj(sj1);
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL: crew outlet lain melihat status antar'; END IF;
  RESET ROLE;

  -- 3. verifikasi outlet -> stop tiba sumber verifikasi_outlet, tanpa ledger tambahan dari trigger ini
  PERFORM 1 FROM pg_proc WHERE proname = 'pelacakan_sinkron_sj' AND pg_get_functiondef(oid) NOT LIKE '%ledger_stok%' AND pg_get_functiondef(oid) NOT LIKE '%stok_balance%';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: fungsi sinkron tidak ada / menyentuh stok'; END IF;
  UPDATE surat_jalan SET status = 'diterima_lengkap' WHERE id = sj2;
  PERFORM 1 FROM driver_perjalanan_stop WHERE surat_jalan_id = sj2 AND status = 'tiba'
    AND tiba_sumber = 'verifikasi_outlet' AND tiba_lat IS NULL AND tiba_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: verifikasi outlet tidak menandai tiba'; END IF;

  -- 4. setelah itu crew outlet sj1 melihat "0 outlet lagi"
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT * INTO r FROM status_antar_sj(sj1);
  IF r.outlet_sebelum <> 0 THEN RAISE EXCEPTION 'GAGAL: outlet_sebelum %', r.outlet_sebelum; END IF;
  RESET ROLE;

  -- 5. driver menekan Tiba pada stop yang sudah diverifikasi outlet -> ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_driver, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM driver_tandai_tiba((SELECT id FROM driver_perjalanan_stop WHERE surat_jalan_id = sj2), -6.6, 106.8, 5);
    RAISE EXCEPTION 'GAGAL: tiba menimpa verifikasi outlet';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%sudah tiba (verifikasi outlet)%' THEN RAISE EXCEPTION 'GAGAL: pesan %', SQLERRM; END IF;
  END;
  RESET ROLE;

  -- 6. stop terakhir terverifikasi -> perjalanan selesai
  UPDATE surat_jalan SET status = 'diterima_sebagian' WHERE id = sj1;
  PERFORM 1 FROM driver_perjalanan WHERE id = v_pid AND status = 'selesai' AND selesai_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: perjalanan tidak selesai setelah semua terverifikasi'; END IF;

  -- 7. SJ dibatalkan -> stop dibatalkan; tidak_ditandai tidak diubah verifikasi belakangan
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_driver, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_pid2 := (driver_mulai_perjalanan(ARRAY[sj3, sj4], -6.6, 106.8)->>'perjalanan_id')::uuid;
  RESET ROLE;
  UPDATE surat_jalan SET status = 'dibatalkan' WHERE id = sj3;
  PERFORM 1 FROM driver_perjalanan_stop WHERE surat_jalan_id = sj3 AND status = 'dibatalkan';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: stop SJ batal tidak dibatalkan'; END IF;

  -- 8. tutup otomatis: batas 23:59 & jam 12:00 WIB -> tetap; batas 00:00 -> tertutup
  UPDATE global_settings SET value = value || '{"batas_tutup_wib":"23:59"}' WHERE key = 'driver_tracking';
  v_n := pelacakan_tutup_otomatis(((now() AT TIME ZONE 'Asia/Jakarta')::date + time '12:00') AT TIME ZONE 'Asia/Jakarta');
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL: tutup otomatis sebelum batas (% ditutup)', v_n; END IF;
  UPDATE global_settings SET value = value || '{"batas_tutup_wib":"00:00"}' WHERE key = 'driver_tracking';
  v_n := pelacakan_tutup_otomatis(((now() AT TIME ZONE 'Asia/Jakarta')::date + time '12:00') AT TIME ZONE 'Asia/Jakarta');
  IF v_n < 1 THEN RAISE EXCEPTION 'GAGAL: tutup otomatis tidak menutup'; END IF;
  PERFORM 1 FROM driver_perjalanan WHERE id = v_pid2 AND status = 'ditutup_otomatis';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: status bukan ditutup_otomatis'; END IF;
  PERFORM 1 FROM driver_perjalanan_stop WHERE surat_jalan_id = sj4 AND status = 'tidak_ditandai';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: stop menunggu tidak jadi tidak_ditandai'; END IF;
  UPDATE surat_jalan SET status = 'diterima_lengkap' WHERE id = sj4;
  PERFORM 1 FROM driver_perjalanan_stop WHERE surat_jalan_id = sj4 AND status = 'tidak_ditandai';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: verifikasi belakangan mengubah tidak_ditandai'; END IF;

  -- 9. perjalanan yang berangkat kemarin ditutup walau belum lewat batas hari ini
  UPDATE global_settings SET value = value || '{"batas_tutup_wib":"23:59"}' WHERE key = 'driver_tracking';
  INSERT INTO driver_perjalanan (driver_id, status, berangkat_at) VALUES (v_driver, 'berjalan', now() - interval '30 hours') RETURNING id INTO v_pid;
  v_n := pelacakan_tutup_otomatis(((now() AT TIME ZONE 'Asia/Jakarta')::date + time '08:00') AT TIME ZONE 'Asia/Jakarta');
  PERFORM 1 FROM driver_perjalanan WHERE id = v_pid AND status = 'ditutup_otomatis';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: perjalanan kemarin tidak ditutup'; END IF;

  -- 10. retensi jejak: 61 hari hapus, 59 hari tetap; ringkasan tetap
  INSERT INTO driver_lokasi_jejak (perjalanan_id, driver_id, lat, lng, direkam_at) VALUES
    (v_pid, v_driver, -6.6, 106.8, now() - interval '61 days'),
    (v_pid, v_driver, -6.6, 106.8, now() - interval '59 days');
  v_n := pelacakan_retensi_jejak();
  SELECT count(*) INTO v_n FROM driver_lokasi_jejak WHERE perjalanan_id = v_pid;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL: retensi menyisakan % titik (harus 1)', v_n; END IF;
  PERFORM 1 FROM driver_perjalanan WHERE id = v_pid;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: retensi menghapus ringkasan'; END IF;

  -- 11. cron terdaftar
  SELECT count(*) INTO v_n FROM cron.job
   WHERE (jobname = 'driver-tutup-perjalanan' AND schedule = '*/15 * * * *')
      OR (jobname = 'driver-retensi-jejak'    AND schedule = '40 20 * * *');
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL: cron % dari 2', v_n; END IF;

  RAISE EXCEPTION 'HASIL T3: LULUS (status outlet tanpa koordinat, scope outlet, verifikasi->tiba, tolak tiba ganda, auto selesai, batal, tutup otomatis, kemarin, retensi, cron)';
END $$;
ROLLBACK;
