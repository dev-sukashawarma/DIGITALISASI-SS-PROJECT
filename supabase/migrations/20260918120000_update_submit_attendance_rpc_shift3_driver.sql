-- Update RPC submit_attendance to support Shift 3 (09:00 - 18:00) for driver role
-- from native app (Android) and web.

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.submit_attendance(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id         uuid := auth.uid();
  v_caller_staff      outlet_staff%ROWTYPE;
  v_target_staff_id   uuid := coalesce(nullif(payload->>'outlet_staff_id', '')::uuid, v_caller_id);
  v_target_staff      outlet_staff%ROWTYPE;
  v_outlet_id         uuid := (payload->>'outlet_id')::uuid;
  v_type              text := payload->>'type';
  v_gps_lat           double precision := (payload->>'gps_lat')::double precision;
  v_gps_lng           double precision := (payload->>'gps_lng')::double precision;
  v_gps_accuracy      double precision := coalesce((payload->>'gps_accuracy')::double precision, 0);
  v_is_manual         boolean := coalesce((payload->>'is_manual_button')::boolean, false);
  v_id                uuid := coalesce(nullif(payload->>'id', '')::uuid, gen_random_uuid());
  -- [SHIFT] Angka JSON 1, 2, atau 3 (khusus driver) yang sah
  v_shift_ke          int := CASE
                               WHEN jsonb_typeof(payload->'shift_ke') = 'number'
                                AND (payload->>'shift_ke') IN ('1', '2', '3')
                               THEN (payload->>'shift_ke')::int
                             END;
  v_outlet_lat        double precision;
  v_outlet_lng        double precision;
  v_distance_m        double precision;
  v_cfg_found         boolean := false;
  v_cfg_jam_masuk     time;
  v_cfg_jam_keluar    time;
  v_cfg_toleransi     int;
  v_cfg_window_mode   text;
  v_cfg_pilih_shift   boolean;
  v_cfg_s2_masuk      time;
  v_cfg_s2_keluar     time;
  v_opsi_shift        boolean := false;
  v_shift_masuk       time;
  v_shift_keluar      time;
  v_jam_masuk_ef      time;
  v_jam_keluar_ef     time;
  v_penutup           boolean := true;
  v_pulang_1          int;
  v_pulang_2          int;
  v_pulang_milik      int;
  v_global_cfg        jsonb;
  v_now_server        timestamptz := now();
  v_now_local         timestamp;
  v_now_minutes       int;
  v_in_minutes        int;
  v_out_minutes       int;
  v_deadline_minutes  int;
  v_diff_minutes      int;
  v_status            text := 'tepat';
  v_telat_menit       int;
  GEOFENCE_RADIUS_M   constant double precision := 150.0;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF v_outlet_id IS NULL OR v_type NOT IN ('in','out') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  SELECT * INTO v_caller_staff FROM outlet_staff WHERE id = v_caller_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff_not_found');
  END IF;
  IF v_caller_staff.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff_inactive');
  END IF;

  IF v_target_staff_id <> v_caller_id THEN
    IF v_caller_staff.role NOT IN ('kiosk','spv','owner','admin','admin_hr','regional_manager','area_manager') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_role');
    END IF;
    SELECT * INTO v_target_staff FROM outlet_staff WHERE id = v_target_staff_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'staff_not_found');
    END IF;
    IF v_target_staff.status <> 'active' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'staff_inactive');
    END IF;
  ELSE
    v_target_staff := v_caller_staff;
  END IF;

  IF v_target_staff.role NOT IN ('spv','owner','admin','admin_hr','regional_manager','area_manager')
     AND v_target_staff.outlet_id <> v_outlet_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_outlets
      WHERE staff_id = v_target_staff_id AND outlet_id = v_outlet_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cross_outlet');
    END IF;
  END IF;

  SELECT lat, lng INTO v_outlet_lat, v_outlet_lng FROM outlets WHERE id = v_outlet_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'outlet_not_found');
  END IF;

  IF v_outlet_lat IS NOT NULL AND v_outlet_lng IS NOT NULL THEN
    IF v_gps_lat IS NULL OR v_gps_lng IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gps_required');
    END IF;
    v_distance_m := 6371000 * 2 * asin(sqrt(
      sin(radians(v_gps_lat - v_outlet_lat) / 2) ^ 2 +
      cos(radians(v_outlet_lat)) * cos(radians(v_gps_lat)) *
      sin(radians(v_gps_lng - v_outlet_lng) / 2) ^ 2
    ));
    IF greatest(0, v_distance_m - v_gps_accuracy) > GEOFENCE_RADIUS_M THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_far_from_outlet');
    END IF;
  END IF;

  IF v_type = 'in' THEN
    IF EXISTS (
      SELECT 1 FROM attendance
      WHERE outlet_staff_id = v_target_staff_id
        AND type = 'in'
        AND status <> 'alpha'
        AND ts_server >= (v_now_server - interval '12 hours')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_clocked_in');
    END IF;
  END IF;

  -- Konfigurasi jam outlet
  SELECT true, jam_masuk, jam_keluar, toleransi_menit, absen_window_mode,
         pilih_shift_aktif, shift2_jam_masuk, shift2_jam_keluar
    INTO v_cfg_found, v_cfg_jam_masuk, v_cfg_jam_keluar, v_cfg_toleransi, v_cfg_window_mode,
         v_cfg_pilih_shift, v_cfg_s2_masuk, v_cfg_s2_keluar
    FROM outlet_attendance_config WHERE outlet_id = v_outlet_id;

  IF NOT coalesce(v_cfg_found, false) THEN
    SELECT value INTO v_global_cfg FROM global_settings WHERE key = 'global_attendance_config';
    IF v_global_cfg IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'config_missing');
    END IF;
    v_cfg_jam_masuk   := coalesce((v_global_cfg->>'jam_masuk')::time, '09:00');
    v_cfg_jam_keluar  := coalesce((v_global_cfg->>'jam_keluar')::time, '17:00');
    v_cfg_toleransi   := coalesce((v_global_cfg->>'toleransi_menit')::int, 0);
    v_cfg_window_mode := coalesce(v_global_cfg->>'absen_window_mode', 'auto');
    v_cfg_pilih_shift := false;
  END IF;

  v_jam_masuk_ef  := v_cfg_jam_masuk;
  v_jam_keluar_ef := coalesce(v_cfg_jam_keluar, '17:00');

  -- [SHIFT] Tentukan shift
  v_opsi_shift := coalesce(v_cfg_pilih_shift, false)
                  AND v_cfg_jam_masuk IS NOT NULL AND v_cfg_jam_keluar IS NOT NULL
                  AND v_cfg_s2_masuk IS NOT NULL AND v_cfg_s2_keluar IS NOT NULL;

  IF v_opsi_shift THEN
    -- Absen pulang: jejak shift dari absen masuk orang itu SELALU menang
    IF v_type = 'out' THEN
      SELECT shift_jam_masuk, shift_jam_keluar INTO v_shift_masuk, v_shift_keluar
        FROM attendance
       WHERE outlet_staff_id = v_target_staff_id
         AND type = 'in'
         AND status <> 'alpha'
         AND ts_server >= (v_now_server - interval '20 hours')
       ORDER BY ts_server DESC
       LIMIT 1;
      IF v_shift_masuk IS NULL OR v_shift_keluar IS NULL THEN
        v_shift_masuk := NULL;
        v_shift_keluar := NULL;
      END IF;
    END IF;

    IF v_shift_keluar IS NULL THEN
      IF v_shift_ke = 1 THEN
        v_shift_masuk := v_cfg_jam_masuk;
        v_shift_keluar := v_cfg_jam_keluar;
      ELSIF v_shift_ke = 2 THEN
        v_shift_masuk := v_cfg_s2_masuk;
        v_shift_keluar := v_cfg_s2_keluar;
      ELSIF v_shift_ke = 3 AND v_target_staff.role = 'driver' THEN
        v_shift_masuk := '09:00:00';
        v_shift_keluar := '18:00:00';
      ELSIF v_type = 'in' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'shift_required');
      END IF;
    END IF;

    IF v_shift_keluar IS NOT NULL THEN
      v_jam_masuk_ef := v_shift_masuk;
      v_jam_keluar_ef := v_shift_keluar;

      -- isShiftPenutup(): jam pulang lewat tengah malam dihitung besok (+1440).
      v_pulang_1 := extract(hour from v_cfg_jam_keluar)::int * 60 + extract(minute from v_cfg_jam_keluar)::int;
      IF v_cfg_jam_keluar < v_cfg_jam_masuk THEN v_pulang_1 := v_pulang_1 + 1440; END IF;
      v_pulang_2 := extract(hour from v_cfg_s2_keluar)::int * 60 + extract(minute from v_cfg_s2_keluar)::int;
      IF v_cfg_s2_keluar < v_cfg_s2_masuk THEN v_pulang_2 := v_pulang_2 + 1440; END IF;

      -- Dibandingkan sebagai HH:MM
      IF left(v_shift_keluar::text, 5) = left(v_cfg_jam_keluar::text, 5) THEN
        v_pulang_milik := v_pulang_1;
      ELSIF left(v_shift_keluar::text, 5) = left(v_cfg_s2_keluar::text, 5) THEN
        v_pulang_milik := v_pulang_2;
      ELSIF left(v_shift_keluar::text, 5) = '18:00' THEN
        v_pulang_milik := 18 * 60;
      END IF;
      -- Jejak yang tak cocok dengan shift mana pun (jam diubah admin) → anggap penutup.
      v_penutup := v_pulang_milik IS NULL OR v_pulang_milik = greatest(v_pulang_1, v_pulang_2);
    END IF;
  END IF;

  -- Gerbang absen pulang (laci kasir & pesanan) — hanya crew shift penutup.
  IF v_type = 'out' AND v_penutup THEN
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

  v_now_local   := v_now_server AT TIME ZONE 'Asia/Jakarta';
  v_now_minutes := extract(hour from v_now_local)::int * 60 + extract(minute from v_now_local)::int;
  v_in_minutes  := extract(hour from v_jam_masuk_ef)::int * 60 + extract(minute from v_jam_masuk_ef)::int;
  v_out_minutes := extract(hour from v_jam_keluar_ef)::int * 60 + extract(minute from v_jam_keluar_ef)::int;

  IF v_out_minutes < v_in_minutes THEN
    v_out_minutes := v_out_minutes + 1440;
    IF v_now_minutes < v_in_minutes - 180 THEN
      v_now_minutes := v_now_minutes + 1440;
    END IF;
  END IF;

  IF coalesce(v_cfg_window_mode, 'auto') = 'auto' AND v_type = 'out' THEN
    v_deadline_minutes := v_out_minutes - 30;
    IF v_now_minutes < v_deadline_minutes THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_early_out');
    END IF;
  END IF;

  IF v_type = 'out' THEN
    v_deadline_minutes := v_out_minutes;
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
    v_deadline_minutes := v_in_minutes;
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
    status, telat_menit, is_manual_button, source,
    shift_jam_masuk, shift_jam_keluar
  ) VALUES (
    v_id, v_target_staff_id, v_outlet_id, v_type, v_now_server, (payload->>'ts_client')::timestamptz,
    v_gps_lat, v_gps_lng, v_distance_m, coalesce((payload->>'match_distance')::numeric, 0), payload->>'selfie_path',
    v_status, v_telat_menit, v_is_manual, 'native',
    -- [SHIFT] NULL untuk outlet satu shift, sama dengan web.
    CASE WHEN v_shift_keluar IS NOT NULL THEN v_shift_masuk END,
    v_shift_keluar
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_type = 'in' AND v_target_staff.outlet_id <> v_outlet_id THEN
    UPDATE outlet_staff SET outlet_id = v_outlet_id WHERE id = v_target_staff_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_status, 'ts_server', v_now_server, 'attendance_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_attendance(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
