-- =============================================================================
-- Pelacakan driver — perbaikan temuan review akhir.
--   I1  driver_tandai_tiba: UPDATE dijaga status 'menunggu' agar tidak menimpa
--       tiba dari verifikasi outlet yang commit di saat bersamaan.
--   I2  pelacakan_sinkron_sj: kunci driver_perjalanan SEBELUM menulis stop
--       (urutan kunci sama dengan RPC driver) — cegah deadlock yang bisa
--       membatalkan verifikasi SJ outlet.
--   I6  driver_kirim_lokasi: titik telat yang masuk ke perjalanan yang sudah
--       tertutup menghitung ulang total_km.
-- Uji: supabase/verifikasi/pelacakan_driver/t5_perbaikan_review.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public._pelacakan_hitung_km(p_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT round(COALESCE(SUM(d), 0) / 1000, 2) FROM (
    SELECT public._pelacakan_haversine_m(lag(lat) OVER w, lag(lng) OVER w, lat, lng) AS d
      FROM public.driver_lokasi_jejak
     WHERE perjalanan_id = p_id
    WINDOW w AS (ORDER BY direkam_at)
  ) x;
$$;
REVOKE ALL ON FUNCTION public._pelacakan_hitung_km(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._pelacakan_tutup_perjalanan(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.driver_perjalanan_stop SET status = 'tidak_ditandai'
   WHERE perjalanan_id = p_id AND status = 'menunggu';

  UPDATE public.driver_perjalanan
     SET status       = p_status,
         selesai_at   = now(),
         total_km     = public._pelacakan_hitung_km(p_id),
         durasi_detik = GREATEST(0, extract(epoch FROM now() - berangkat_at))::int
   WHERE id = p_id AND status = 'berjalan';
END;
$$;

-- ---------------------------------------------------------------- I1
CREATE OR REPLACE FUNCTION public.driver_tandai_tiba(p_stop_id uuid, p_lat numeric, p_lng numeric, p_akurasi_m numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid := public._pelacakan_driver_saya();
  v_stop   record;
  v_jarak  numeric;
  v_status text;
BEGIN
  SELECT s.perjalanan_id, s.outlet_id, p.driver_id
    INTO v_stop
    FROM public.driver_perjalanan_stop s
    JOIN public.driver_perjalanan p ON p.id = s.perjalanan_id
   WHERE s.id = p_stop_id;
  IF NOT FOUND OR v_stop.driver_id <> v_driver THEN
    RAISE EXCEPTION 'Stop tidak ditemukan';
  END IF;

  -- Urutan kunci: perjalanan lalu stop (sama dengan trigger sinkron SJ).
  SELECT status INTO v_status FROM public.driver_perjalanan WHERE id = v_stop.perjalanan_id FOR UPDATE;
  IF v_status <> 'berjalan' THEN
    RAISE EXCEPTION 'Perjalanan sudah ditutup';
  END IF;

  SELECT public._pelacakan_haversine_m(p_lat, p_lng, o.lat, o.lng) INTO v_jarak
    FROM public.outlets o WHERE o.id = v_stop.outlet_id;

  UPDATE public.driver_perjalanan_stop
     SET status = 'tiba', tiba_at = now(), tiba_sumber = 'driver',
         tiba_lat = p_lat, tiba_lng = p_lng, tiba_akurasi_m = p_akurasi_m,
         tiba_jarak_m = round(v_jarak, 1)
   WHERE id = p_stop_id AND status = 'menunggu';

  IF NOT FOUND THEN
    SELECT status, tiba_sumber INTO v_stop FROM public.driver_perjalanan_stop WHERE id = p_stop_id;
    IF v_stop.status = 'tiba' AND v_stop.tiba_sumber = 'verifikasi_outlet' THEN
      RAISE EXCEPTION 'Surat jalan ini sudah tiba (verifikasi outlet)';
    END IF;
    RAISE EXCEPTION 'Stop ini sudah %', v_stop.status;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.driver_perjalanan_stop
                  WHERE perjalanan_id = v_stop.perjalanan_id AND status = 'menunggu') THEN
    PERFORM public._pelacakan_tutup_perjalanan(v_stop.perjalanan_id, 'selesai');
  END IF;

  SELECT status INTO v_status FROM public.driver_perjalanan WHERE id = v_stop.perjalanan_id;
  RETURN jsonb_build_object('tiba_jarak_m', round(v_jarak, 1), 'perjalanan_status', v_status);
END;
$$;

-- ---------------------------------------------------------------- I2
CREATE OR REPLACE FUNCTION public.pelacakan_sinkron_sj()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pid uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN ('diterima_sebagian','diterima_lengkap','selesai','dibatalkan') THEN
    RETURN NEW;
  END IF;

  SELECT perjalanan_id INTO v_pid FROM public.driver_perjalanan_stop
   WHERE surat_jalan_id = NEW.id AND status = 'menunggu';
  IF v_pid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Kunci perjalanan dulu, baru stop — urutan sama dengan RPC driver.
  PERFORM 1 FROM public.driver_perjalanan WHERE id = v_pid FOR UPDATE;

  IF NEW.status = 'dibatalkan' THEN
    UPDATE public.driver_perjalanan_stop SET status = 'dibatalkan'
     WHERE surat_jalan_id = NEW.id AND status = 'menunggu';
  ELSE
    UPDATE public.driver_perjalanan_stop
       SET status = 'tiba', tiba_at = now(), tiba_sumber = 'verifikasi_outlet'
     WHERE surat_jalan_id = NEW.id AND status = 'menunggu';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.driver_perjalanan_stop
                  WHERE perjalanan_id = v_pid AND status = 'menunggu') THEN
    PERFORM public._pelacakan_tutup_perjalanan(v_pid, 'selesai');
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------- I6
CREATE OR REPLACE FUNCTION public.driver_kirim_lokasi(p_titik jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver   uuid := public._pelacakan_driver_saya();
  v_diterima int := 0;
  v_n        int;
  v_tutup    uuid[] := '{}';
  t          record;
  p          record;
  v_status   text;
BEGIN
  IF p_titik IS NULL OR jsonb_typeof(p_titik) <> 'array' THEN
    RAISE EXCEPTION 'Titik harus berupa array';
  END IF;
  IF jsonb_array_length(p_titik) > 500 THEN
    RAISE EXCEPTION 'Maksimal 500 titik per kiriman';
  END IF;

  FOR t IN
    SELECT (e->>'lat')::numeric AS lat, (e->>'lng')::numeric AS lng,
           (e->>'akurasi_m')::numeric AS akurasi_m, (e->>'kecepatan_mps')::numeric AS kecepatan_mps,
           (e->>'arah_derajat')::numeric AS arah_derajat, (e->>'baterai_persen')::int AS baterai_persen,
           (e->>'direkam_at')::timestamptz AS direkam_at
      FROM jsonb_array_elements(p_titik) e
     ORDER BY (e->>'direkam_at')::timestamptz
  LOOP
    CONTINUE WHEN t.lat IS NULL OR t.lng IS NULL OR t.direkam_at IS NULL
               OR t.lat NOT BETWEEN -90 AND 90 OR t.lng NOT BETWEEN -180 AND 180;

    -- Perjalanan pemilik titik: terakhir yang berangkat sebelum titik direkam (toleransi jam HP 2 mnt).
    SELECT id, status, selesai_at INTO p
      FROM public.driver_perjalanan
     WHERE driver_id = v_driver AND berangkat_at <= t.direkam_at + interval '2 minutes'
     ORDER BY berangkat_at DESC LIMIT 1;
    CONTINUE WHEN NOT FOUND;
    CONTINUE WHEN p.status <> 'berjalan' AND t.direkam_at > p.selesai_at;

    INSERT INTO public.driver_lokasi_jejak (perjalanan_id, driver_id, lat, lng, akurasi_m, direkam_at)
    VALUES (p.id, v_driver, t.lat, t.lng, t.akurasi_m, t.direkam_at)
    ON CONFLICT (driver_id, direkam_at) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_diterima := v_diterima + v_n;

    IF v_n > 0 AND p.status <> 'berjalan' AND NOT p.id = ANY(v_tutup) THEN
      v_tutup := v_tutup || p.id;
    END IF;

    -- Pin live hanya untuk perjalanan berjalan, dan hanya maju.
    IF p.status = 'berjalan' THEN
      INSERT INTO public.driver_lokasi_terkini AS k
             (driver_id, perjalanan_id, lat, lng, akurasi_m, kecepatan_mps, arah_derajat, baterai_persen, direkam_at, diterima_at)
      VALUES (v_driver, p.id, t.lat, t.lng, t.akurasi_m, t.kecepatan_mps, t.arah_derajat, t.baterai_persen, t.direkam_at, now())
      ON CONFLICT (driver_id) DO UPDATE
         SET perjalanan_id = EXCLUDED.perjalanan_id, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
             akurasi_m = EXCLUDED.akurasi_m, kecepatan_mps = EXCLUDED.kecepatan_mps,
             arah_derajat = EXCLUDED.arah_derajat, baterai_persen = EXCLUDED.baterai_persen,
             direkam_at = EXCLUDED.direkam_at, diterima_at = EXCLUDED.diterima_at
       WHERE k.direkam_at < EXCLUDED.direkam_at;
    END IF;
  END LOOP;

  -- Titik telat ke perjalanan tertutup: ringkasan km dihitung ulang.
  UPDATE public.driver_perjalanan SET total_km = public._pelacakan_hitung_km(id)
   WHERE id = ANY(v_tutup);

  -- Status yang menentukan service HP: perjalanan berjalan bila ada, selain itu yang terakhir.
  SELECT status INTO v_status FROM public.driver_perjalanan
   WHERE driver_id = v_driver ORDER BY (status = 'berjalan') DESC, berangkat_at DESC LIMIT 1;

  RETURN jsonb_build_object('status_perjalanan', COALESCE(v_status, 'tidak_ada'),
                            'pengaturan', public._pelacakan_pengaturan(),
                            'diterima', v_diterima);
END;
$$;
