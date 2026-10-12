-- Migration: 20300254001000_fix_emergency_crew_submit_attendance_and_rls.sql
-- Perbaikan Kritis:
-- 1. Perbaiki submit_attendance agar:
--    a. Memeriksa langsung tabel emergency_crew_assignments untuk assignment hari ini (mencegah deadlock H-1).
--    b. TIDAK PERNAH menimpa outlet_staff.outlet_id (home outlet) saat kru reguler bertugas BKO.
-- 2. Perbaiki RLS emergency_crew_assignments agar tidak bocor (USING true) ke akun publik/non-admin.
-- 3. Perbaiki trigger sinkronisasi attendance_outlet_access saat target_outlet diubah.

-- 1. Perbarui RLS pada emergency_crew_assignments
DROP POLICY IF EXISTS emergency_crew_assignments_select ON public.emergency_crew_assignments;
CREATE POLICY emergency_crew_assignments_select ON public.emergency_crew_assignments
  FOR SELECT TO authenticated
  USING (
    staff_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.outlet_staff
      WHERE id = (SELECT auth.uid())
        AND status = 'active'
        AND role IN ('admin', 'admin_hr', 'developer', 'owner', 'spv', 'regional_manager', 'area_manager')
    )
  );

DROP POLICY IF EXISTS emergency_crew_assignments_admin ON public.emergency_crew_assignments;
CREATE POLICY emergency_crew_assignments_admin ON public.emergency_crew_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff
      WHERE id = (SELECT auth.uid())
        AND status = 'active'
        AND role IN ('admin', 'admin_hr', 'developer', 'owner')
    )
  );

-- 2. Perbaiki Trigger Sinkronisasi BKO
CREATE OR REPLACE FUNCTION public.fn_sync_emergency_attendance_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE;
BEGIN
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;

  -- Jika operasi UPDATE dan target_outlet_id berubah, hapus target lama
  IF TG_OP = 'UPDATE' AND OLD.target_outlet_id IS DISTINCT FROM NEW.target_outlet_id THEN
    DELETE FROM public.attendance_outlet_access
    WHERE staff_id = OLD.staff_id AND outlet_id = OLD.target_outlet_id;
  END IF;

  -- Jika status active dan assignment_date adalah hari ini, tambahkan akses absensi
  IF NEW.status = 'active' AND NEW.assignment_date = v_today THEN
    INSERT INTO public.attendance_outlet_access (staff_id, outlet_id, granted_by)
    VALUES (NEW.staff_id, NEW.target_outlet_id, NEW.assigned_by)
    ON CONFLICT (staff_id, outlet_id) DO NOTHING;
  END IF;

  -- Jika dibatalkan atau selesai, cabut akses absensi sementara bila ada
  IF NEW.status IN ('cancelled', 'completed') THEN
    DELETE FROM public.attendance_outlet_access
    WHERE staff_id = NEW.staff_id AND outlet_id = NEW.target_outlet_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Perbarui submit_attendance RPC
CREATE OR REPLACE FUNCTION public.submit_attendance(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  v_cfg_pilih_shift  boolean;
  v_opsi_shift       boolean;
  v_shift_ke         int;
  v_shift_masuk      time;
  v_shift_keluar     time;
  v_jam_masuk_ef     time;
  v_jam_keluar_ef    time;
  v_pulang_milik     int;
  v_pulang_maks      int;
  v_penutup          boolean := true;
  v_ts_client        timestamptz;
  v_offline          boolean := false;
  v_jam_diragukan    boolean := false;
  v_status_lama      text;
  v_di_kantor_pusat  boolean := false;
  v_radius_m         numeric;
  v_source           text;
  v_aturan_masuk     time;
  v_aturan_keluar    time;
  v_pulang_aturan    int;
  DEFAULT_RADIUS_M   CONSTANT numeric := 100;
  MAX_GPS_ACCURACY_M CONSTANT numeric := 150;
  DRIVER_SHIFT_KE    CONSTANT int := 99;
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
  v_offline         := coalesce(
                         (payload->>'sumber_offline')::boolean,
                         (payload->>'is_offline')::boolean,
                         (payload->>'from_queue')::boolean,
                         false);
  v_source          := CASE WHEN payload->>'source' = 'web' THEN 'web' ELSE 'native' END;

  IF v_target_staff_id IS NULL OR v_outlet_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'auth_required');
    END IF;
    IF auth.uid() <> v_target_staff_id THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_staff');
    END IF;
  END IF;

  SELECT role, outlet_id, status INTO v_target_staff
    FROM outlet_staff WHERE id = v_target_staff_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff_not_found');
  END IF;
  IF v_target_staff.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff_inactive');
  END IF;

  -- Izin outlet: peran pengawas, outlet utama, penempatan (staff_outlets), izin tambahan,
  -- izin semua outlet, DAN penugasan darurat (BKO Sementara) untuk hari ini.
  IF NOT absen_peran_global(v_target_staff.role)
     AND v_target_staff.outlet_id IS DISTINCT FROM v_outlet_id
     AND NOT EXISTS (SELECT 1 FROM attendance_outlet_access
                      WHERE staff_id = v_target_staff_id AND outlet_id = v_outlet_id)
     AND NOT EXISTS (SELECT 1 FROM staff_outlets
                      WHERE staff_id = v_target_staff_id AND outlet_id = v_outlet_id)
     AND NOT EXISTS (SELECT 1 FROM attendance_any_outlet_staff
                      WHERE staff_id = v_target_staff_id)
     AND NOT EXISTS (SELECT 1 FROM emergency_crew_assignments
                      WHERE staff_id = v_target_staff_id
                        AND target_outlet_id = v_outlet_id
                        AND assignment_date = (now() AT TIME ZONE 'Asia/Jakarta')::DATE
                        AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cross_outlet');
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

  SELECT true, jam_masuk, jam_keluar, toleransi_menit, absen_window_mode, pilih_shift_aktif
    INTO v_cfg_found, v_cfg_jam_masuk, v_cfg_jam_keluar, v_cfg_toleransi, v_cfg_window_mode,
         v_cfg_pilih_shift
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

  SELECT j.jam_masuk, j.jam_keluar INTO v_aturan_masuk, v_aturan_keluar
    FROM attendance_staff_schedule_member m
    JOIN attendance_staff_schedule j ON j.id = m.schedule_id
   WHERE m.staff_id = v_target_staff_id AND m.outlet_id = v_outlet_id;

  IF v_type = 'out' THEN
    SELECT max(menit_pulang(a.jam_masuk, a.jam_keluar)) INTO v_pulang_aturan
      FROM attendance_staff_schedule a WHERE a.outlet_id = v_outlet_id;
  END IF;

  IF coalesce(v_cfg_pilih_shift, false) THEN
    SELECT max(extract(hour from s.jam_keluar)::int * 60 + extract(minute from s.jam_keluar)::int
               + CASE WHEN s.jam_keluar < s.jam_masuk THEN 1440 ELSE 0 END),
           count(*) >= 2
      INTO v_pulang_maks, v_opsi_shift
      FROM outlet_attendance_shift s
     WHERE s.outlet_id = v_outlet_id;
  END IF;
  v_opsi_shift := coalesce(v_opsi_shift, false);

  IF v_aturan_keluar IS NOT NULL THEN
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
      v_shift_masuk := v_aturan_masuk;
      v_shift_keluar := v_aturan_keluar;
    END IF;
    v_jam_masuk_ef := v_shift_masuk;
    v_jam_keluar_ef := v_shift_keluar;
    v_pulang_milik := menit_pulang(v_shift_masuk, v_shift_keluar);
    v_penutup := v_pulang_milik >= greatest(
                   coalesce(v_pulang_maks, menit_pulang(v_cfg_jam_masuk, coalesce(v_cfg_jam_keluar, '17:00'))),
                   coalesce(v_pulang_aturan, 0));
  ELSIF v_opsi_shift THEN
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
      IF v_shift_ke IS NOT NULL THEN
        SELECT s.jam_masuk, s.jam_keluar INTO v_shift_masuk, v_shift_keluar
          FROM outlet_attendance_shift s
         WHERE s.outlet_id = v_outlet_id AND s.urutan = v_shift_ke;
      END IF;
      IF v_shift_keluar IS NULL AND v_target_staff.role = 'driver'
         AND v_shift_ke IN (3, DRIVER_SHIFT_KE) THEN
        v_shift_masuk := '09:00:00';
        v_shift_keluar := '18:00:00';
      ELSIF v_shift_keluar IS NULL AND v_type = 'in' THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'shift_required');
      END IF;
    END IF;

    IF v_shift_keluar IS NOT NULL THEN
      v_jam_masuk_ef := v_shift_masuk;
      v_jam_keluar_ef := v_shift_keluar;
      v_pulang_milik := extract(hour from v_shift_keluar)::int * 60 + extract(minute from v_shift_keluar)::int
                        + CASE WHEN v_shift_keluar < v_shift_masuk THEN 1440 ELSE 0 END;
      v_penutup := v_pulang_maks IS NULL
                   OR v_pulang_milik >= greatest(v_pulang_maks, coalesce(v_pulang_aturan, 0));
    END IF;
  ELSIF v_pulang_aturan IS NOT NULL THEN
    v_penutup := menit_pulang(v_cfg_jam_masuk, v_jam_keluar_ef) >= v_pulang_aturan;
  END IF;

  -- Gerbang absen pulang (laci kasir & pesanan) — hanya crew shift penutup dan BUKAN di Kantor Pusat.
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
    v_id, v_target_staff_id, v_outlet_id, v_type, v_now_server, v_ts_client,
    v_gps_lat, v_gps_lng, v_distance_m, coalesce((payload->>'match_distance')::numeric, 0), payload->>'selfie_path',
    v_status, v_telat_menit, v_is_manual, v_source,
    CASE WHEN v_shift_keluar IS NOT NULL THEN v_shift_masuk END,
    v_shift_keluar,
    v_offline, v_jam_diragukan
  )
  ON CONFLICT (id) DO NOTHING;

  -- PERBAIKAN KRITIS BKO:
  -- Jangan menimpa outlet_staff.outlet_id jika ada penugasan BKO darurat hari ini,
  -- atau jika staff adalah crew reguler / trainee (home outlet di Database Karyawan tetap utuh).
  IF v_type = 'in' AND v_target_staff.outlet_id <> v_outlet_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.emergency_crew_assignments
      WHERE staff_id = v_target_staff_id
        AND target_outlet_id = v_outlet_id
        AND assignment_date = (now() AT TIME ZONE 'Asia/Jakarta')::DATE
        AND status = 'active'
    ) AND v_target_staff.role NOT IN ('crew', 'crew_regular', 'crew_trainee') THEN
      UPDATE outlet_staff SET outlet_id = v_outlet_id WHERE id = v_target_staff_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_status, 'ts_server', v_now_server,
                            'attendance_id', v_id, 'jam_diragukan', v_jam_diragukan);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_attendance(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_attendance(jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
