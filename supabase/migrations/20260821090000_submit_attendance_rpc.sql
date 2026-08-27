-- RPC submit_attendance: satu-satunya jalur INSERT ke attendance untuk client
-- ber-role `authenticated` (native mobile). Tabel attendance sengaja dikunci
-- INSERT-only-service_role (lihat 20260610000300_m1_attendance_rls.sql) karena
-- semula hanya web (Next.js API route, service-role key) yang menulis. RPC ini
-- me-mirror business logic app/api/submit-attendance/route.ts (geofence, shift
-- gate, unfinished-orders gate, time-window, status telat) supaya native bisa
-- absen tanpa perlu HTTP call ke Next.js — jalan via SECURITY DEFINER sehingga
-- boleh INSERT walau caller cuma role authenticated biasa.
--
-- BEDA PENTING dari route.ts: route.ts TIDAK memverifikasi body.outlet_staff_id
-- itu benar milik pemanggil (dia percaya penuh ke service-role admin client).
-- Karena RPC ini dipanggil langsung oleh HP staff (bukan server tepercaya),
-- kita WAJIB kunci outlet_staff_id = auth.uid() supaya satu staff tak bisa
-- mengabsenkan staff lain.

-- is_manual_button dipakai app/api/submit-attendance/route.ts (web) tapi tak
-- tercatat migration manapun (kemungkinan ditambah manual di dashboard) — pola
-- sama persis dgn bug outlets.radius_m sebelumnya. Idempotent-safe di sini.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_manual_button boolean NOT NULL DEFAULT false;

-- telat_toleransi dipakai native (& seharusnya oleh web) untuk status "telat
-- tapi masih dalam toleransi_menit" — kolom check lama belum mengizinkannya.
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('tepat', 'telat', 'telat_toleransi', 'alpha', 'lebih_awal', 'pulang_telat'));

CREATE OR REPLACE FUNCTION public.submit_attendance(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id       uuid := auth.uid();
  v_staff           outlet_staff%ROWTYPE;
  v_outlet_id       uuid := (payload->>'outlet_id')::uuid;
  v_type            text := payload->>'type';
  v_gps_lat         double precision := (payload->>'gps_lat')::double precision;
  v_gps_lng         double precision := (payload->>'gps_lng')::double precision;
  v_gps_accuracy    double precision := coalesce((payload->>'gps_accuracy')::double precision, 0);
  v_is_manual       boolean := coalesce((payload->>'is_manual_button')::boolean, false);
  v_id              uuid := coalesce(nullif(payload->>'id', '')::uuid, gen_random_uuid());
  v_outlet_lat      double precision;
  v_outlet_lng      double precision;
  v_distance_m      double precision;
  v_cfg_jam_masuk   time;
  v_cfg_jam_keluar  time;
  v_cfg_toleransi   int;
  v_cfg_window_mode text;
  v_global_cfg      jsonb;
  v_now_server      timestamptz := now();
  v_now_local       timestamp;
  v_now_minutes     int;
  v_deadline_minutes int;
  v_diff_minutes    int;
  v_status          text := 'tepat';
  v_telat_menit     int;
  GEOFENCE_RADIUS_M constant double precision := 150.0;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF v_outlet_id IS NULL OR v_type NOT IN ('in','out') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  SELECT * INTO v_staff FROM outlet_staff WHERE id = v_caller_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff_not_found');
  END IF;
  IF v_staff.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff_inactive');
  END IF;

  IF v_staff.role NOT IN ('spv','owner','admin','admin_hr','regional_manager','area_manager')
     AND v_staff.outlet_id <> v_outlet_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_outlets
      WHERE staff_id = v_caller_id AND outlet_id = v_outlet_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cross_outlet');
    END IF;
  END IF;

  SELECT lat, lng INTO v_outlet_lat, v_outlet_lng FROM outlets WHERE id = v_outlet_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'outlet_not_found');
  END IF;

  IF v_outlet_lat IS NOT NULL AND v_outlet_lng IS NOT NULL
     AND v_gps_lat IS NOT NULL AND v_gps_lng IS NOT NULL THEN
    v_distance_m := 6371000 * 2 * asin(sqrt(
      sin(radians(v_gps_lat - v_outlet_lat) / 2) ^ 2 +
      cos(radians(v_outlet_lat)) * cos(radians(v_gps_lat)) *
      sin(radians(v_gps_lng - v_outlet_lng) / 2) ^ 2
    ));
    IF greatest(0, v_distance_m - v_gps_accuracy) > GEOFENCE_RADIUS_M THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_far_from_outlet');
    END IF;
  END IF;

  IF v_type = 'out' THEN
    IF EXISTS (SELECT 1 FROM shifts WHERE outlet_id = v_outlet_id AND status = 'open') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'shift_not_closed');
    END IF;
    IF EXISTS (
      SELECT 1 FROM orders
      WHERE outlet_id = v_outlet_id AND status IN ('pending','preparing','ready')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unfinished_orders');
    END IF;
  END IF;

  SELECT jam_masuk, jam_keluar, toleransi_menit, absen_window_mode
    INTO v_cfg_jam_masuk, v_cfg_jam_keluar, v_cfg_toleransi, v_cfg_window_mode
    FROM outlet_attendance_config WHERE outlet_id = v_outlet_id;

  IF NOT FOUND THEN
    SELECT value INTO v_global_cfg FROM global_settings WHERE key = 'global_attendance_config';
    IF v_global_cfg IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'config_missing');
    END IF;
    v_cfg_jam_masuk   := coalesce((v_global_cfg->>'jam_masuk')::time, '09:00');
    v_cfg_jam_keluar  := coalesce((v_global_cfg->>'jam_keluar')::time, '17:00');
    v_cfg_toleransi   := coalesce((v_global_cfg->>'toleransi_menit')::int, 0);
    v_cfg_window_mode := coalesce(v_global_cfg->>'absen_window_mode', 'auto');
  END IF;

  v_now_local := v_now_server AT TIME ZONE 'Asia/Jakarta';
  v_now_minutes := extract(hour from v_now_local)::int * 60 + extract(minute from v_now_local)::int;

  IF coalesce(v_cfg_window_mode, 'auto') = 'auto' AND v_type = 'out' THEN
    v_deadline_minutes := extract(hour from v_cfg_jam_keluar)::int * 60 + extract(minute from v_cfg_jam_keluar)::int - 30;
    IF v_now_minutes < v_deadline_minutes THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_early_out');
    END IF;
  END IF;

  IF v_type = 'out' THEN
    v_deadline_minutes := extract(hour from v_cfg_jam_keluar)::int * 60 + extract(minute from v_cfg_jam_keluar)::int;
    v_diff_minutes := v_now_minutes - v_deadline_minutes;
    IF v_diff_minutes < 0 THEN
      v_status := 'lebih_awal';
      v_telat_menit := abs(v_diff_minutes);
    ELSIF v_diff_minutes >= 1 THEN
      v_status := 'pulang_telat';
      v_telat_menit := v_diff_minutes;
    ELSE
      v_status := 'tepat';
    END IF;
  ELSE
    v_deadline_minutes := extract(hour from v_cfg_jam_masuk)::int * 60 + extract(minute from v_cfg_jam_masuk)::int;
    v_diff_minutes := v_now_minutes - v_deadline_minutes;
    IF v_diff_minutes <= 0 THEN
      v_status := 'tepat';
    ELSIF v_diff_minutes <= coalesce(v_cfg_toleransi, 0) THEN
      v_status := 'telat_toleransi';
      v_telat_menit := v_diff_minutes;
    ELSE
      v_status := 'telat';
      v_telat_menit := v_diff_minutes;
    END IF;
  END IF;

  INSERT INTO attendance (
    id, outlet_staff_id, outlet_id, type, ts_server, ts_client,
    gps_lat, gps_lng, distance_m, match_distance, selfie_url,
    status, telat_menit, is_manual_button
  ) VALUES (
    v_id, v_caller_id, v_outlet_id, v_type, v_now_server, (payload->>'ts_client')::timestamptz,
    v_gps_lat, v_gps_lng, v_distance_m, coalesce((payload->>'match_distance')::numeric, 0), payload->>'selfie_path',
    v_status, v_telat_menit, v_is_manual
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_type = 'in' AND v_staff.outlet_id <> v_outlet_id THEN
    UPDATE outlet_staff SET outlet_id = v_outlet_id WHERE id = v_caller_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_status, 'ts_server', v_now_server, 'attendance_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_attendance(jsonb) TO authenticated;

-- DOWN:
-- DROP FUNCTION IF EXISTS public.submit_attendance(jsonb);
-- ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
-- ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('tepat', 'telat', 'alpha', 'lebih_awal', 'pulang_telat'));
