-- submit_attendance (dipakai app native) memakai radius geofence dari pengaturan.
--
-- Insiden 22 Sep 2026: kru MITRA CILEUNGSI tidak bisa absen dari app native
-- ("Gagal: too_far_from_outlet"), padahal app menampilkan "101m dari Anda" dan
-- absen lewat web di outlet yang sama tetap lolos.
--
-- Akar: versi live fungsi ini (di-deploy di luar migration, setelah 21 Sep siang)
-- mengunci GEOFENCE_RADIUS_M = 30 dan MAX_GPS_ACCURACY_M = 50. Sementara itu:
--   * route web /api/submit-attendance memakai radius_m outlet_attendance_config,
--     lalu global_attendance_config.radius_m, lalu 100 m; akurasi maksimal 150 m;
--   * app native (ClockViewModel.loadGeofenceRadius) memakai urutan yang sama.
-- Kru Cileungsi rutin tercatat 80–100 m dari titik outlet, jadi lolos di app dan
-- web tetapi selalu ditolak RPC.
--
-- Perbaikan: radius dibaca dengan urutan yang sama dengan web & app, dan batas
-- akurasi GPS disamakan (150 m). Selebihnya isi fungsi identik dengan versi live.

CREATE OR REPLACE FUNCTION public.submit_attendance(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_id               uuid;
  v_target_staff_id  uuid;
  v_outlet_id        uuid;
  v_type             text;
  v_gps_lat          double precision;
  v_gps_lng          double precision;
  v_gps_accuracy     numeric;
  v_is_manual        boolean;
  v_distance_m       numeric;
  v_now_server       timestamptz := now();
  v_now_efektif      timestamptz;
  v_target_staff     record;
  v_target_outlet    record;
  v_status           text;
  v_telat_menit      int;
  v_cfg_found        boolean;
  v_cfg_jam_masuk    time;
  v_cfg_jam_keluar   time;
  v_cfg_toleransi    int;
  v_cfg_window_mode  text;
  v_global_cfg       jsonb;
  v_now_local        timestamp;
  v_now_minutes      int;
  v_in_minutes       int;
  v_out_minutes      int;
  v_deadline_minutes int;
  v_diff_minutes     int;
  v_is_global_role   boolean;
  v_cfg_pilih_shift  boolean;
  v_cfg_s2_masuk     time;
  v_cfg_s2_keluar    time;
  v_opsi_shift       boolean;
  v_shift_ke         int;
  v_shift_masuk      time;
  v_shift_keluar     time;
  v_jam_masuk_ef     time;
  v_jam_keluar_ef    time;
  v_pulang_1         int;
  v_pulang_2         int;
  v_pulang_milik     int;
  v_penutup          boolean := true;
  v_ts_client        timestamptz;
  v_offline          boolean := false;
  v_jam_diragukan    boolean := false;
  v_status_lama      text;
  v_di_kantor_pusat  boolean := false;
  v_radius_m         numeric;
  -- Cadangan bila outlet maupun pusat tidak mengisi radius — sama dengan
  -- GEOFENCE_RADIUS_M di apps/absensi/src/lib/gps.ts.
  DEFAULT_RADIUS_M   CONSTANT numeric := 100;
  MAX_GPS_ACCURACY_M CONSTANT numeric := 150;
BEGIN
  v_id              := coalesce((payload->>'id')::uuid, gen_random_uuid());
  v_target_staff_id := (payload->>'outlet_staff_id')::uuid;
  v_outlet_id       := (payload->>'outlet_id')::uuid;
  v_type            := coalesce(payload->>'type', 'in');
  v_gps_lat         := (payload->>'gps_lat')::double precision;
  v_gps_lng         := (payload->>'gps_lng')::double precision;
  v_gps_accuracy    := (payload->>'gps_accuracy')::numeric;
  v_is_manual       := coalesce((payload->>'is_manual_button')::boolean, false);
  v_shift_ke        := (payload->>'shift_ke')::int;
  v_ts_client       := (payload->>'ts_client')::timestamptz;
  v_offline         := coalesce((payload->>'sumber_offline')::boolean, false);

  IF v_target_staff_id IS NULL OR v_outlet_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  SELECT role, outlet_id, status INTO v_target_staff
    FROM outlet_staff WHERE id = v_target_staff_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff_not_found');
  END IF;
  IF v_target_staff.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff_inactive');
  END IF;

  v_is_global_role := v_target_staff.role IN (
    'spv','owner','admin','admin_hr','regional_manager','area_manager','developer'
  );
  IF NOT v_is_global_role AND v_target_staff.outlet_id <> v_outlet_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_outlets
      WHERE staff_id = v_target_staff_id AND outlet_id = v_outlet_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cross_outlet');
    END IF;
  END IF;

  SELECT lat, lng, is_active, slug, type, name INTO v_target_outlet
    FROM outlets WHERE id = v_outlet_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'outlet_not_found');
  END IF;
  IF v_target_outlet.is_active = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'outlet_inactive');
  END IF;

  -- Deteksi apakah outlet ini adalah Kantor Pusat
  v_di_kantor_pusat := (
    v_outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    OR v_target_outlet.slug = 'kantor-pusat'
    OR (v_target_outlet.type = 'office' AND v_target_outlet.name ILIKE '%kantor%')
  );

  -- Validasi GPS (kecuali bila koordinat outlet null)
  IF v_target_outlet.lat IS NOT NULL AND v_target_outlet.lng IS NOT NULL THEN
    IF coalesce(v_gps_accuracy, 999) > MAX_GPS_ACCURACY_M THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gps_accuracy_low');
    END IF;
    IF v_gps_lat IS NULL OR v_gps_lng IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'location_required');
    END IF;

    -- Radius: jadwal khusus outlet -> pengaturan pusat -> 100 m (urutan route web).
    SELECT nullif(radius_m, 0) INTO v_radius_m
      FROM outlet_attendance_config WHERE outlet_id = v_outlet_id;
    IF coalesce(v_radius_m, 0) <= 0 THEN
      SELECT nullif(value->>'radius_m', '')::numeric INTO v_radius_m
        FROM global_settings WHERE key = 'global_attendance_config';
    END IF;
    IF coalesce(v_radius_m, 0) <= 0 THEN
      v_radius_m := DEFAULT_RADIUS_M;
    END IF;

    v_distance_m := (
      6371000 * 2 * asin(sqrt(
        sin(radians(v_gps_lat - v_target_outlet.lat) / 2)^2 +
        cos(radians(v_target_outlet.lat)) * cos(radians(v_gps_lat)) *
        sin(radians(v_gps_lng - v_target_outlet.lng) / 2)^2
      ))
    );

    IF greatest(0, v_distance_m - v_gps_accuracy) > v_radius_m THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_far_from_outlet');
    END IF;
  END IF;

  v_now_efektif := v_now_server;
  IF v_offline AND v_ts_client IS NOT NULL THEN
    IF v_ts_client > v_now_server + interval '10 minutes'
       OR v_ts_client < v_now_server - interval '7 days' THEN
      v_jam_diragukan := true;
    ELSE
      v_now_efektif := v_ts_client;
    END IF;
  END IF;

  SELECT status INTO v_status_lama FROM attendance WHERE id = v_id;
  IF v_status_lama IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'status', v_status_lama, 'ts_server', v_now_server,
                              'attendance_id', v_id, 'duplikat', true);
  END IF;

  IF v_type = 'in' THEN
    IF EXISTS (
      SELECT 1 FROM attendance
      WHERE outlet_staff_id = v_target_staff_id
        AND type = 'in'
        AND status <> 'alpha'
        AND ts_server >= (v_now_efektif - interval '12 hours')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_clocked_in');
    END IF;
  END IF;

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

  v_opsi_shift := coalesce(v_cfg_pilih_shift, false)
                  AND v_cfg_jam_masuk IS NOT NULL AND v_cfg_jam_keluar IS NOT NULL
                  AND v_cfg_s2_masuk IS NOT NULL AND v_cfg_s2_keluar IS NOT NULL;

  IF v_opsi_shift THEN
    IF v_type = 'out' THEN
      SELECT shift_jam_masuk, shift_jam_keluar INTO v_shift_masuk, v_shift_keluar
        FROM attendance
       WHERE outlet_staff_id = v_target_staff_id
         AND type = 'in'
         AND status <> 'alpha'
         AND ts_server >= (v_now_efektif - interval '20 hours')
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

      v_pulang_1 := extract(hour from v_cfg_jam_keluar)::int * 60 + extract(minute from v_cfg_jam_keluar)::int;
      IF v_cfg_jam_keluar < v_cfg_jam_masuk THEN v_pulang_1 := v_pulang_1 + 1440; END IF;
      v_pulang_2 := extract(hour from v_cfg_s2_keluar)::int * 60 + extract(minute from v_cfg_s2_keluar)::int;
      IF v_cfg_s2_keluar < v_cfg_s2_masuk THEN v_pulang_2 := v_pulang_2 + 1440; END IF;

      IF left(v_shift_keluar::text, 5) = left(v_cfg_jam_keluar::text, 5) THEN
        v_pulang_milik := v_pulang_1;
      ELSIF left(v_shift_keluar::text, 5) = left(v_cfg_s2_keluar::text, 5) THEN
        v_pulang_milik := v_pulang_2;
      ELSIF left(v_shift_keluar::text, 5) = '18:00' THEN
        v_pulang_milik := 18 * 60;
      END IF;
      v_penutup := v_pulang_milik IS NULL OR v_pulang_milik = greatest(v_pulang_1, v_pulang_2);
    END IF;
  END IF;

  -- Gerbang absen pulang (laci kasir & pesanan) — hanya crew shift penutup dan BUKAN di Kantor Pusat.
  -- Kantor Pusat tidak ada operasional kasir / pesanan, sehingga shift kasir & order berjalan dilewati.
  IF v_type = 'out' AND v_penutup AND NOT coalesce(v_di_kantor_pusat, false) THEN
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

  v_now_local   := v_now_efektif AT TIME ZONE 'Asia/Jakarta';
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
    shift_jam_masuk, shift_jam_keluar,
    sumber_offline, jam_diragukan
  ) VALUES (
    v_id, v_target_staff_id, v_outlet_id, v_type, v_now_server, (payload->>'ts_client')::timestamptz,
    v_gps_lat, v_gps_lng, v_distance_m, coalesce((payload->>'match_distance')::numeric, 0), payload->>'selfie_path',
    v_status, v_telat_menit, v_is_manual, 'native',
    CASE WHEN v_shift_keluar IS NOT NULL THEN v_shift_masuk END,
    v_shift_keluar,
    v_offline, v_jam_diragukan
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_type = 'in' AND v_target_staff.outlet_id <> v_outlet_id THEN
    UPDATE outlet_staff SET outlet_id = v_outlet_id WHERE id = v_target_staff_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_status, 'ts_server', v_now_server,
                            'attendance_id', v_id, 'jam_diragukan', v_jam_diragukan);
END;
$function$;
