-- =============================================================================
-- Pelacakan driver distribusi — RPC milik driver.
-- Spec: docs/superpowers/specs/2026-10-27-pelacakan-driver-design.md (§6.2)
--
-- Semua SECURITY DEFINER: tabel pelacakan tidak punya policy tulis.
-- Identitas selalu dari auth.uid(); tidak ada parameter driver_id.
-- Tidak ada fungsi di sini yang menulis surat_jalan / ledger_stok / stok_balance.
-- =============================================================================

-- ---------------------------------------------------------------- internal
CREATE OR REPLACE FUNCTION public._pelacakan_haversine_m(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
  ELSE (2 * 6371000 * asin(sqrt(
          power(sin(radians((lat2 - lat1)::float8) / 2), 2)
        + cos(radians(lat1::float8)) * cos(radians(lat2::float8))
          * power(sin(radians((lng2 - lng1)::float8) / 2), 2))))::numeric
  END;
$$;

CREATE OR REPLACE FUNCTION public._pelacakan_pengaturan()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT '{"interval_detik":30,"jarak_min_m":100,"batas_tutup_wib":"21:00","retensi_hari":60}'::jsonb
         || COALESCE((SELECT value FROM public.global_settings WHERE key = 'driver_tracking'), '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public._pelacakan_driver_saya()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.outlet_staff
                  WHERE id = auth.uid() AND status = 'active' AND role = 'driver') THEN
    RAISE EXCEPTION 'Fitur pengantaran hanya driver aktif' USING ERRCODE = '42501';
  END IF;
  RETURN auth.uid();
END;
$$;

-- Menutup perjalanan: stop menunggu -> tidak_ditandai, isi selesai_at/total_km/durasi.
CREATE OR REPLACE FUNCTION public._pelacakan_tutup_perjalanan(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_km numeric;
BEGIN
  UPDATE public.driver_perjalanan_stop SET status = 'tidak_ditandai'
   WHERE perjalanan_id = p_id AND status = 'menunggu';

  SELECT COALESCE(SUM(d), 0) / 1000 INTO v_km FROM (
    SELECT public._pelacakan_haversine_m(
             lag(lat) OVER w, lag(lng) OVER w, lat, lng) AS d
      FROM public.driver_lokasi_jejak
     WHERE perjalanan_id = p_id
    WINDOW w AS (ORDER BY direkam_at)
  ) x;

  UPDATE public.driver_perjalanan
     SET status       = p_status,
         selesai_at   = now(),
         total_km     = round(v_km, 2),
         durasi_detik = GREATEST(0, extract(epoch FROM now() - berangkat_at))::int
   WHERE id = p_id AND status = 'berjalan';
END;
$$;

REVOKE ALL ON FUNCTION public._pelacakan_haversine_m(numeric, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._pelacakan_pengaturan()              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._pelacakan_driver_saya()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._pelacakan_tutup_perjalanan(uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- SJ siap dibawa
CREATE OR REPLACE FUNCTION public.driver_sj_siap_dibawa()
RETURNS TABLE(surat_jalan_id uuid, document_number text, outlet_id uuid, outlet_name text,
              lat numeric, lng numeric, jumlah_item int, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._pelacakan_driver_saya();
  RETURN QUERY
  SELECT sj.id, sj.document_number, sj.outlet_id, o.name, o.lat, o.lng,
         (SELECT count(*)::int FROM public.surat_jalan_item i WHERE i.surat_jalan_id = sj.id),
         sj.created_at
    FROM public.surat_jalan sj
    JOIN public.outlets o ON o.id = sj.outlet_id
   WHERE sj.status IN ('dikirim','dikirim_lengkap')
     AND GREATEST(sj.created_at, COALESCE(sj.updated_at, sj.created_at)) >= now() - interval '3 days'
     AND NOT EXISTS (SELECT 1 FROM public.driver_perjalanan_stop s
                      WHERE s.surat_jalan_id = sj.id AND s.status <> 'dibatalkan')
   ORDER BY o.name, sj.created_at;
END;
$$;

-- ---------------------------------------------------------------- mulai
CREATE OR REPLACE FUNCTION public.driver_mulai_perjalanan(p_sj_ids uuid[], p_lat numeric, p_lng numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid := public._pelacakan_driver_saya();
  v_pid    uuid;
  r        record;
BEGIN
  IF p_sj_ids IS NULL OR cardinality(p_sj_ids) = 0 THEN
    RAISE EXCEPTION 'Pilih minimal satu surat jalan';
  END IF;
  IF cardinality(p_sj_ids) <> (SELECT count(DISTINCT x) FROM unnest(p_sj_ids) x) THEN
    RAISE EXCEPTION 'Surat jalan dipilih lebih dari sekali';
  END IF;
  IF EXISTS (SELECT 1 FROM public.driver_perjalanan WHERE driver_id = v_driver AND status = 'berjalan') THEN
    RAISE EXCEPTION 'Driver masih ada perjalanan berjalan';
  END IF;

  -- Kunci SJ sebelum cek ganda (dua HP / tombol ganda).
  PERFORM 1 FROM public.surat_jalan WHERE id = ANY(p_sj_ids) ORDER BY id FOR UPDATE;

  FOR r IN SELECT x.id, sj.status, sj.document_number,
                  EXISTS (SELECT 1 FROM public.driver_perjalanan_stop s
                           WHERE s.surat_jalan_id = x.id AND s.status <> 'dibatalkan') AS dibawa
             FROM unnest(p_sj_ids) AS x(id)
             LEFT JOIN public.surat_jalan sj ON sj.id = x.id LOOP
    IF r.status IS NULL THEN
      RAISE EXCEPTION 'Surat jalan % tidak ditemukan', r.id;
    ELSIF r.dibawa THEN
      RAISE EXCEPTION 'Surat jalan % sudah dibawa perjalanan lain', COALESCE(r.document_number, r.id::text);
    ELSIF r.status NOT IN ('dikirim','dikirim_lengkap') THEN
      RAISE EXCEPTION 'Surat jalan % belum berstatus dikirim (status: %)', COALESCE(r.document_number, r.id::text), r.status;
    END IF;
  END LOOP;

  INSERT INTO public.driver_perjalanan (driver_id, status, berangkat_at, berangkat_lat, berangkat_lng)
  VALUES (v_driver, 'berjalan', now(), p_lat, p_lng)
  RETURNING id INTO v_pid;

  INSERT INTO public.driver_perjalanan_stop (perjalanan_id, surat_jalan_id, outlet_id, urutan)
  SELECT v_pid, x.id, sj.outlet_id, x.n
    FROM unnest(p_sj_ids) WITH ORDINALITY AS x(id, n)
    JOIN public.surat_jalan sj ON sj.id = x.id;

  RETURN jsonb_build_object('perjalanan_id', v_pid, 'pengaturan', public._pelacakan_pengaturan());
END;
$$;

-- ---------------------------------------------------------------- ubah urutan
CREATE OR REPLACE FUNCTION public.driver_ubah_urutan(p_perjalanan_id uuid, p_stop_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid := public._pelacakan_driver_saya();
  v_tuntas int;
BEGIN
  PERFORM 1 FROM public.driver_perjalanan
   WHERE id = p_perjalanan_id AND driver_id = v_driver AND status = 'berjalan' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perjalanan tidak berjalan atau bukan milik driver'; END IF;

  IF p_stop_ids IS NULL
     OR cardinality(p_stop_ids) <> (SELECT count(DISTINCT x) FROM unnest(p_stop_ids) x)
     OR (SELECT array_agg(x ORDER BY x) FROM unnest(p_stop_ids) x)
        IS DISTINCT FROM
        (SELECT array_agg(id ORDER BY id) FROM public.driver_perjalanan_stop
          WHERE perjalanan_id = p_perjalanan_id AND status = 'menunggu') THEN
    RAISE EXCEPTION 'Urutan harus memuat persis semua stop yang belum tiba';
  END IF;

  SELECT count(*) INTO v_tuntas FROM public.driver_perjalanan_stop
   WHERE perjalanan_id = p_perjalanan_id AND status <> 'menunggu';

  UPDATE public.driver_perjalanan_stop s
     SET urutan = v_tuntas + x.n
    FROM unnest(p_stop_ids) WITH ORDINALITY AS x(id, n)
   WHERE s.id = x.id;
END;
$$;

-- ---------------------------------------------------------------- tiba
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
  SELECT s.*, p.status AS p_status, p.driver_id
    INTO v_stop
    FROM public.driver_perjalanan_stop s
    JOIN public.driver_perjalanan p ON p.id = s.perjalanan_id
   WHERE s.id = p_stop_id;
  IF NOT FOUND OR v_stop.driver_id <> v_driver THEN
    RAISE EXCEPTION 'Stop tidak ditemukan';
  END IF;
  PERFORM 1 FROM public.driver_perjalanan WHERE id = v_stop.perjalanan_id FOR UPDATE;
  IF v_stop.p_status <> 'berjalan' THEN
    RAISE EXCEPTION 'Perjalanan sudah ditutup';
  END IF;
  IF v_stop.status = 'tiba' AND v_stop.tiba_sumber = 'verifikasi_outlet' THEN
    RAISE EXCEPTION 'Surat jalan ini sudah tiba (verifikasi outlet)';
  ELSIF v_stop.status <> 'menunggu' THEN
    RAISE EXCEPTION 'Stop ini sudah %', v_stop.status;
  END IF;

  SELECT public._pelacakan_haversine_m(p_lat, p_lng, o.lat, o.lng) INTO v_jarak
    FROM public.outlets o WHERE o.id = v_stop.outlet_id;

  UPDATE public.driver_perjalanan_stop
     SET status = 'tiba', tiba_at = now(), tiba_sumber = 'driver',
         tiba_lat = p_lat, tiba_lng = p_lng, tiba_akurasi_m = p_akurasi_m,
         tiba_jarak_m = round(v_jarak, 1)
   WHERE id = p_stop_id;

  IF NOT EXISTS (SELECT 1 FROM public.driver_perjalanan_stop
                  WHERE perjalanan_id = v_stop.perjalanan_id AND status = 'menunggu') THEN
    PERFORM public._pelacakan_tutup_perjalanan(v_stop.perjalanan_id, 'selesai');
  END IF;

  SELECT status INTO v_status FROM public.driver_perjalanan WHERE id = v_stop.perjalanan_id;
  RETURN jsonb_build_object('tiba_jarak_m', round(v_jarak, 1), 'perjalanan_status', v_status);
END;
$$;

-- ---------------------------------------------------------------- kirim lokasi
CREATE OR REPLACE FUNCTION public.driver_kirim_lokasi(p_titik jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver   uuid := public._pelacakan_driver_saya();
  v_diterima int := 0;
  v_n        int;
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

  -- Status yang menentukan service HP: perjalanan berjalan bila ada, selain itu yang terakhir.
  SELECT status INTO v_status FROM public.driver_perjalanan
   WHERE driver_id = v_driver ORDER BY (status = 'berjalan') DESC, berangkat_at DESC LIMIT 1;

  RETURN jsonb_build_object('status_perjalanan', COALESCE(v_status, 'tidak_ada'),
                            'pengaturan', public._pelacakan_pengaturan(),
                            'diterima', v_diterima);
END;
$$;

-- ---------------------------------------------------------------- selesaikan
CREATE OR REPLACE FUNCTION public.driver_selesaikan_perjalanan(p_perjalanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid := public._pelacakan_driver_saya();
  r record;
BEGIN
  PERFORM 1 FROM public.driver_perjalanan
   WHERE id = p_perjalanan_id AND driver_id = v_driver AND status = 'berjalan' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perjalanan tidak berjalan atau bukan milik driver'; END IF;

  PERFORM public._pelacakan_tutup_perjalanan(p_perjalanan_id, 'selesai');
  SELECT total_km, durasi_detik INTO r FROM public.driver_perjalanan WHERE id = p_perjalanan_id;
  RETURN jsonb_build_object('total_km', r.total_km, 'durasi_detik', r.durasi_detik);
END;
$$;

-- ---------------------------------------------------------------- perjalanan aktif
CREATE OR REPLACE FUNCTION public.driver_perjalanan_aktif()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid := public._pelacakan_driver_saya();
  p record;
BEGIN
  SELECT * INTO p FROM public.driver_perjalanan
   WHERE driver_id = v_driver AND status = 'berjalan';
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'perjalanan', jsonb_build_object('id', p.id, 'status', p.status, 'berangkat_at', p.berangkat_at),
    'pengaturan', public._pelacakan_pengaturan(),
    'stops', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', s.id, 'surat_jalan_id', s.surat_jalan_id, 'document_number', sj.document_number,
               'outlet_id', s.outlet_id, 'outlet_name', o.name, 'lat', o.lat, 'lng', o.lng,
               'urutan', s.urutan, 'status', s.status, 'tiba_at', s.tiba_at,
               'tiba_sumber', s.tiba_sumber, 'tiba_jarak_m', s.tiba_jarak_m)
             ORDER BY s.urutan)
        FROM public.driver_perjalanan_stop s
        JOIN public.surat_jalan sj ON sj.id = s.surat_jalan_id
        JOIN public.outlets o ON o.id = s.outlet_id
       WHERE s.perjalanan_id = p.id), '[]'::jsonb));
END;
$$;

-- ---------------------------------------------------------------- hak eksekusi
REVOKE ALL ON FUNCTION public.driver_sj_siap_dibawa()                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.driver_mulai_perjalanan(uuid[], numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.driver_ubah_urutan(uuid, uuid[])                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.driver_tandai_tiba(uuid, numeric, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.driver_kirim_lokasi(jsonb)                      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.driver_selesaikan_perjalanan(uuid)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.driver_perjalanan_aktif()                       FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_sj_siap_dibawa()                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_mulai_perjalanan(uuid[], numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_ubah_urutan(uuid, uuid[])                TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_tandai_tiba(uuid, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_kirim_lokasi(jsonb)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_selesaikan_perjalanan(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_perjalanan_aktif()                       TO authenticated;
