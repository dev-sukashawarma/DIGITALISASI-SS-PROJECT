-- Uji perbaikan review akhir (I1 tiba bersamaan, I2 urutan kunci, I6 km setelah titik telat).
-- I1/I2 adalah balapan antar-transaksi yang tak bisa direproduksi dalam satu
-- transaksi; dikunci lewat bentuk fungsinya (penjaga status & urutan kunci).
-- Harapan: error P0001 "HASIL T5: LULUS ...".
BEGIN;
DO $$
DECLARE
  v_driver uuid; o1 uuid; sj1 uuid; v_pid uuid; v_km_awal numeric; v_km numeric; v_def text;
BEGIN
  -- I1: UPDATE stop di driver_tandai_tiba hanya mengenai stop yang masih menunggu
  v_def := pg_get_functiondef('public.driver_tandai_tiba(uuid,numeric,numeric,numeric)'::regprocedure);
  IF v_def !~ 'WHERE id = p_stop_id AND status = ''menunggu''' THEN
    RAISE EXCEPTION 'GAGAL I1: UPDATE tiba tanpa penjaga status menunggu';
  END IF;

  -- I2: trigger sinkron mengunci driver_perjalanan SEBELUM menulis stop
  v_def := pg_get_functiondef('public.pelacakan_sinkron_sj()'::regprocedure);
  IF position('FOR UPDATE' IN v_def) = 0
     OR position('FOR UPDATE' IN v_def) > position('UPDATE public.driver_perjalanan_stop' IN v_def) THEN
    RAISE EXCEPTION 'GAGAL I2: trigger tidak mengunci perjalanan sebelum stop';
  END IF;

  -- I6: titik telat yang masuk setelah perjalanan ditutup memperbarui total_km
  SELECT id INTO v_driver FROM outlet_staff WHERE role = 'driver' AND status = 'active' LIMIT 1;
  SELECT id INTO o1 FROM outlets WHERE is_active AND type IN ('internal','mitra') LIMIT 1;
  INSERT INTO surat_jalan (outlet_id, status, document_number) VALUES (o1, 'dikirim', 'UJI-T5-1') RETURNING id INTO sj1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_driver, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_pid := (driver_mulai_perjalanan(ARRAY[sj1], -6.60, 106.80)->>'perjalanan_id')::uuid;
  RESET ROLE;
  UPDATE driver_perjalanan SET berangkat_at = now() - interval '1 hour' WHERE id = v_pid;
  SET LOCAL ROLE authenticated;
  PERFORM driver_kirim_lokasi(jsonb_build_array(
    jsonb_build_object('lat', -6.60, 'lng', 106.8, 'direkam_at', now() - interval '50 minutes'),
    jsonb_build_object('lat', -6.61, 'lng', 106.8, 'direkam_at', now() - interval '40 minutes')));
  PERFORM driver_selesaikan_perjalanan(v_pid);
  SELECT total_km INTO v_km_awal FROM driver_perjalanan WHERE id = v_pid;
  PERFORM driver_kirim_lokasi(jsonb_build_array(
    jsonb_build_object('lat', -6.62, 'lng', 106.8, 'direkam_at', now() - interval '30 minutes')));
  SELECT total_km INTO v_km FROM driver_perjalanan WHERE id = v_pid;
  RESET ROLE;
  IF v_km_awal NOT BETWEEN 1.0 AND 1.2 THEN RAISE EXCEPTION 'GAGAL I6: km awal %', v_km_awal; END IF;
  IF v_km NOT BETWEEN 2.1 AND 2.3 THEN RAISE EXCEPTION 'GAGAL I6: km setelah titik telat % (awal %)', v_km, v_km_awal; END IF;

  RAISE EXCEPTION 'HASIL T5: LULUS (I1 penjaga status, I2 urutan kunci, I6 km dihitung ulang)';
END $$;
ROLLBACK;
