-- Uji Task 2 pelacakan driver (RPC driver).
-- Harapan: error P0001 "HASIL T2: LULUS ...". Pesan galat lain = gagal.
BEGIN;
DO $$
DECLARE
  v_driver  uuid;  v_driver2 uuid;  v_crew uuid;
  o1 uuid; o2 uuid; o3 uuid;
  o1lat numeric; o1lng numeric;
  sj1 uuid; sj2 uuid; sj3 uuid; sj_draft uuid;
  v_res jsonb; v_pid uuid; v_pid2 uuid; v_stop1 uuid; v_stop2 uuid; v_stop3 uuid;
  v_n int; v_ok boolean; v_msg text; v_ts timestamptz;
BEGIN
  -- ---------- fixture (sebagai postgres, sebelum ganti peran)
  SELECT id INTO v_driver FROM outlet_staff WHERE role = 'driver' AND status = 'active' LIMIT 1;
  SELECT id INTO v_crew   FROM outlet_staff WHERE role = 'crew' AND status = 'active' AND outlet_id IS NOT NULL LIMIT 1;
  SELECT id INTO v_driver2 FROM outlet_staff WHERE role = 'crew' AND status = 'active' AND id <> v_crew LIMIT 1;
  UPDATE outlet_staff SET role = 'driver' WHERE id = v_driver2;          -- driver kedua sementara
  SELECT id, lat, lng INTO o1, o1lat, o1lng FROM outlets WHERE is_active AND type IN ('internal','mitra') AND lat IS NOT NULL ORDER BY name LIMIT 1;
  SELECT id INTO o2 FROM outlets WHERE is_active AND type IN ('internal','mitra') AND lat IS NOT NULL AND id <> o1 ORDER BY name LIMIT 1;
  SELECT id INTO o3 FROM outlets WHERE is_active AND type IN ('internal','mitra') AND id NOT IN (o1, o2) ORDER BY name LIMIT 1;
  UPDATE outlets SET lat = NULL, lng = NULL WHERE id = o3;               -- outlet tanpa koordinat
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (o1, 'dikirim', 'UJI-PLK-1') RETURNING id INTO sj1;
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (o2, 'dikirim', 'UJI-PLK-2') RETURNING id INTO sj2;
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (o3, 'dikirim', 'UJI-PLK-3') RETURNING id INTO sj3;
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (o1, 'draft',   'UJI-PLK-D') RETURNING id INTO sj_draft;

  -- ---------- crew ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM driver_mulai_perjalanan(ARRAY[sj1], -6.6, 106.8);
    RAISE EXCEPTION 'GAGAL: crew bisa mulai perjalanan';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%hanya driver%' THEN RAISE EXCEPTION 'GAGAL: pesan crew salah: %', SQLERRM; END IF;
  END;
  RESET ROLE;

  -- ---------- driver
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_driver, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_n FROM driver_sj_siap_dibawa() WHERE surat_jalan_id IN (sj1, sj2, sj3, sj_draft);
  IF v_n <> 3 THEN RAISE EXCEPTION 'GAGAL: sj_siap_dibawa % (harus 3, tanpa draft)', v_n; END IF;

  v_res := driver_mulai_perjalanan(ARRAY[sj1, sj2, sj3], o1lat, o1lng);
  v_pid := (v_res->>'perjalanan_id')::uuid;
  IF v_pid IS NULL OR (v_res->'pengaturan'->>'interval_detik')::int <> 30 THEN
    RAISE EXCEPTION 'GAGAL: respons mulai %', v_res;
  END IF;
  SELECT id INTO v_stop1 FROM driver_perjalanan_stop WHERE perjalanan_id = v_pid AND surat_jalan_id = sj1 AND urutan = 1;
  SELECT id INTO v_stop2 FROM driver_perjalanan_stop WHERE perjalanan_id = v_pid AND surat_jalan_id = sj2 AND urutan = 2;
  SELECT id INTO v_stop3 FROM driver_perjalanan_stop WHERE perjalanan_id = v_pid AND surat_jalan_id = sj3 AND urutan = 3;
  IF v_stop1 IS NULL OR v_stop2 IS NULL OR v_stop3 IS NULL THEN RAISE EXCEPTION 'GAGAL: stop/urutan salah'; END IF;

  SELECT count(*) INTO v_n FROM driver_sj_siap_dibawa() WHERE surat_jalan_id IN (sj1, sj2, sj3);
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL: SJ yang sudah dibawa masih tampil siap'; END IF;

  BEGIN
    PERFORM driver_mulai_perjalanan(ARRAY[sj_draft], 0, 0);
    RAISE EXCEPTION 'GAGAL: boleh dua perjalanan berjalan';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%masih ada perjalanan berjalan%' THEN RAISE EXCEPTION 'GAGAL: pesan berjalan salah: %', SQLERRM; END IF;
  END;

  -- ubah urutan: tukar 2 dan 3
  PERFORM driver_ubah_urutan(v_pid, ARRAY[v_stop1, v_stop3, v_stop2]);
  SELECT urutan INTO v_n FROM driver_perjalanan_stop WHERE id = v_stop3;
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL: ubah urutan stop3 = %', v_n; END IF;

  -- tiba stop1 ~30 m dari outlet
  v_res := driver_tandai_tiba(v_stop1, o1lat + 0.00027, o1lng, 8);
  IF (v_res->>'tiba_jarak_m')::numeric NOT BETWEEN 25 AND 35 THEN RAISE EXCEPTION 'GAGAL: jarak tiba %', v_res; END IF;
  PERFORM 1 FROM driver_perjalanan_stop WHERE id = v_stop1 AND status = 'tiba' AND tiba_sumber = 'driver';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: stop1 bukan tiba/driver'; END IF;

  -- stop tuntas tak boleh diurutkan ulang
  BEGIN
    PERFORM driver_ubah_urutan(v_pid, ARRAY[v_stop1, v_stop2, v_stop3]);
    RAISE EXCEPTION 'GAGAL: stop tuntas bisa diurutkan';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'GAGAL%' THEN RAISE; END IF;
  END;

  -- tiba ganda ditolak
  BEGIN
    PERFORM driver_tandai_tiba(v_stop1, o1lat, o1lng, 8);
    RAISE EXCEPTION 'GAGAL: tiba dua kali';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'GAGAL%' THEN RAISE; END IF;
  END;

  -- outlet tanpa koordinat -> jarak NULL (lompat urutan dibolehkan: stop3 sekarang urutan 2, stop2 urutan 3; tekan stop2 dulu)
  v_res := driver_tandai_tiba(v_stop2, -6.5, 106.8, 10);
  IF v_res->>'perjalanan_status' <> 'berjalan' THEN RAISE EXCEPTION 'GAGAL: perjalanan selesai terlalu cepat'; END IF;
  v_res := driver_tandai_tiba(v_stop3, -6.5, 106.8, 10);
  IF v_res ? 'tiba_jarak_m' AND v_res->>'tiba_jarak_m' IS NOT NULL THEN RAISE EXCEPTION 'GAGAL: jarak outlet tanpa koordinat = %', v_res; END IF;
  IF v_res->>'perjalanan_status' <> 'selesai' THEN RAISE EXCEPTION 'GAGAL: semua tiba tapi perjalanan %', v_res; END IF;
  IF driver_perjalanan_aktif() IS NOT NULL THEN RAISE EXCEPTION 'GAGAL: masih ada perjalanan aktif'; END IF;
  RESET ROLE;

  -- ---------- SJ ganda (driver kedua memakai SJ yang stop-nya sudah tiba = tidak dibatalkan)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_driver2, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM driver_mulai_perjalanan(ARRAY[sj1], 0, 0);
    RAISE EXCEPTION 'GAGAL: SJ ganda diterima';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%UJI-PLK-1%' THEN RAISE EXCEPTION 'GAGAL: pesan SJ ganda tak menyebut nomor: %', SQLERRM; END IF;
  END;
  RESET ROLE;

  -- ---------- lokasi & selesaikan manual
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (o1, 'dikirim', 'UJI-PLK-4') RETURNING id INTO sj1;
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (o2, 'dikirim', 'UJI-PLK-5') RETURNING id INTO sj2;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_driver, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_pid2 := (driver_mulai_perjalanan(ARRAY[sj1, sj2], -6.60, 106.80)->>'perjalanan_id')::uuid;
  RESET ROLE;
  UPDATE driver_perjalanan SET berangkat_at = now() - interval '1 hour' WHERE id = v_pid2;
  SET LOCAL ROLE authenticated;

  v_res := driver_kirim_lokasi(jsonb_build_array(
    jsonb_build_object('lat', -6.600, 'lng', 106.800, 'akurasi_m', 5, 'direkam_at', now() - interval '50 minutes'),
    jsonb_build_object('lat', -6.610, 'lng', 106.800, 'akurasi_m', 5, 'direkam_at', now() - interval '40 minutes'),
    jsonb_build_object('lat', -6.620, 'lng', 106.800, 'akurasi_m', 5, 'baterai_persen', 80, 'direkam_at', now() - interval '30 minutes')));
  IF (v_res->>'diterima')::int <> 3 OR v_res->>'status_perjalanan' <> 'berjalan' THEN RAISE EXCEPTION 'GAGAL: kirim lokasi %', v_res; END IF;
  v_res := driver_kirim_lokasi(jsonb_build_array(
    jsonb_build_object('lat', -6.600, 'lng', 106.800, 'akurasi_m', 5, 'direkam_at', now() - interval '50 minutes')));
  IF (v_res->>'diterima')::int <> 0 THEN RAISE EXCEPTION 'GAGAL: titik dobel diterima %', v_res; END IF;
  -- titik lebih lama tidak memundurkan pin
  PERFORM driver_kirim_lokasi(jsonb_build_array(
    jsonb_build_object('lat', -6.605, 'lng', 106.800, 'direkam_at', now() - interval '45 minutes')));
  SELECT direkam_at INTO v_ts FROM driver_lokasi_terkini WHERE driver_id = v_driver;
  IF v_ts <> now() - interval '30 minutes' THEN RAISE EXCEPTION 'GAGAL: pin mundur ke %', v_ts; END IF;
  -- 501 titik ditolak
  BEGIN
    PERFORM driver_kirim_lokasi((SELECT jsonb_agg(jsonb_build_object('lat', -6.6, 'lng', 106.8, 'direkam_at', now() - make_interval(secs => g)))
                                   FROM generate_series(1, 501) g));
    RAISE EXCEPTION 'GAGAL: 501 titik diterima';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'GAGAL%' THEN RAISE; END IF;
  END;

  -- selesaikan dengan stop menunggu
  v_res := driver_selesaikan_perjalanan(v_pid2);
  IF (v_res->>'total_km')::numeric NOT BETWEEN 2.0 AND 2.6 THEN RAISE EXCEPTION 'GAGAL: total_km %', v_res; END IF;
  SELECT count(*) INTO v_n FROM driver_perjalanan_stop WHERE perjalanan_id = v_pid2 AND status = 'tidak_ditandai';
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL: stop tidak_ditandai %', v_n; END IF;

  -- titik telat: sebelum selesai_at diterima, sesudahnya dibuang
  v_res := driver_kirim_lokasi(jsonb_build_array(
    jsonb_build_object('lat', -6.63, 'lng', 106.8, 'direkam_at', now() - interval '20 minutes'),
    jsonb_build_object('lat', -6.64, 'lng', 106.8, 'direkam_at', now() + interval '5 minutes')));
  IF (v_res->>'diterima')::int <> 1 OR v_res->>'status_perjalanan' <> 'selesai' THEN RAISE EXCEPTION 'GAGAL: titik telat %', v_res; END IF;
  SELECT direkam_at INTO v_ts FROM driver_lokasi_terkini WHERE driver_id = v_driver;
  IF v_ts <> now() - interval '30 minutes' THEN RAISE EXCEPTION 'GAGAL: titik telat mengubah pin %', v_ts; END IF;
  RESET ROLE;

  RAISE EXCEPTION 'HASIL T2: LULUS (tolak crew, siap dibawa, mulai, ganda, urutan, tiba+jarak, tanpa koordinat, selesai otomatis, lokasi idempoten, pin tak mundur, batas 500, titik telat, selesaikan)';
END $$;
ROLLBACK;
