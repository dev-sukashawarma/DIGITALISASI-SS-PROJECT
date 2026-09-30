-- attendance_shift_config: outlet TANPA jadwal outlet tetapi punya aturan jadwal staf kini
-- selalu mengembalikan objek (jam pusat + menit_pulang_penutup), bukan hanya untuk staf
-- anggota aturan. Tanpa ini klien staf non-anggota menerima NULL, menganggap dirinya
-- penutup, lalu memblokir absen pulang yang oleh submit_attendance justru diizinkan
-- (staf beraturan pulang lebih malam = dialah penutupnya).
--
-- Outlet tanpa jadwal outlet dan tanpa aturan staf: tetap NULL seperti sebelumnya.

CREATE OR REPLACE FUNCTION public.attendance_shift_config(p_outlet_id uuid, p_staff_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_staff  uuid := coalesce(p_staff_id, auth.uid());
  v_cfg    jsonb;
  v_jadwal jsonb;
  v_global jsonb;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
           'nama', j.nama,
           'jam_masuk', left(j.jam_masuk::text, 5),
           'jam_keluar', left(j.jam_keluar::text, 5))
    INTO v_jadwal
    FROM attendance_staff_schedule_member m
    JOIN attendance_staff_schedule j ON j.id = m.schedule_id
   WHERE m.staff_id = v_staff AND m.outlet_id = p_outlet_id;

  SELECT jsonb_build_object(
           'jam_masuk', left(c.jam_masuk::text, 5),
           'jam_keluar', left(c.jam_keluar::text, 5),
           'pilih_shift_aktif', coalesce(c.pilih_shift_aktif, false),
           'shift2_jam_masuk', left(c.shift2_jam_masuk::text, 5),
           'shift2_jam_keluar', left(c.shift2_jam_keluar::text, 5),
           'shifts', coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'ke', s.urutan, 'nama', s.nama,
                      'jam_masuk', left(s.jam_masuk::text, 5),
                      'jam_keluar', left(s.jam_keluar::text, 5)) ORDER BY s.urutan)
               FROM outlet_attendance_shift s WHERE s.outlet_id = c.outlet_id
           ), '[]'::jsonb))
    INTO v_cfg
    FROM outlet_attendance_config c
   WHERE c.outlet_id = p_outlet_id;

  IF v_cfg IS NULL THEN
    IF v_jadwal IS NULL
       AND NOT EXISTS (SELECT 1 FROM attendance_staff_schedule a WHERE a.outlet_id = p_outlet_id) THEN
      RETURN NULL;
    END IF;
    SELECT value INTO v_global FROM global_settings WHERE key = 'global_attendance_config';
    v_cfg := jsonb_build_object(
      'jam_masuk', coalesce(left(v_global->>'jam_masuk', 5), '09:00'),
      'jam_keluar', coalesce(left(v_global->>'jam_keluar', 5), '17:00'),
      'pilih_shift_aktif', false,
      'shift2_jam_masuk', NULL,
      'shift2_jam_keluar', NULL,
      'shifts', '[]'::jsonb);
  END IF;

  RETURN v_cfg || jsonb_build_object(
    'jadwal_staf', v_jadwal,
    'menit_pulang_penutup', menit_pulang_penutup_outlet(p_outlet_id));
END;
$$;

REVOKE ALL ON FUNCTION public.attendance_shift_config(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attendance_shift_config(uuid, uuid) TO anon, authenticated, service_role;
