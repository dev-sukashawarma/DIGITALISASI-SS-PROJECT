-- Developer boleh menyimpan aturan absensi PUSAT dan membaca jadwal outlet.
--
-- 28 Sep 2026: developer di app native bisa menyimpan jadwal khusus outlet (sejak
-- 20260928095531, lewat assert_attendance_settings_admin) tetapi tombol "Simpan Pengaturan"
-- aturan pusat gagal: "Akses ditolak: hanya admin, admin_hr, dan regional_manager yang dapat
-- mengubah aturan pusat." — save_global_attendance_config punya daftar peran sendiri.
--
-- 1. save_global_attendance_config memakai assert_attendance_settings_admin(), jadi daftar
--    peran pengatur absensi hanya ada di satu tempat. Selebihnya isi fungsi identik.
--    EXECUTE untuk anon dicabut: tanpa auth.uid() fungsi ini selalu menolak.
-- 2. can_read_attendance_config ikut developer, supaya papan kehadiran & pengaturan yang
--    membaca outlet_attendance_config / outlet_attendance_shift langsung tidak jatuh diam-diam
--    ke jam pusat untuk developer.

CREATE OR REPLACE FUNCTION public.save_global_attendance_config(
  p_jam_masuk time without time zone,
  p_jam_keluar time without time zone,
  p_toleransi_menit integer,
  p_radius_m integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_mode text;
BEGIN
  PERFORM public.assert_attendance_settings_admin();

  IF p_jam_masuk IS NULL OR p_jam_keluar IS NULL THEN
    RAISE EXCEPTION 'Jam masuk dan jam keluar wajib diisi.';
  END IF;

  IF p_toleransi_menit < 0 THEN
    RAISE EXCEPTION 'Toleransi tidak boleh kurang dari 0 menit.';
  END IF;

  IF p_radius_m <= 0 THEN
    RAISE EXCEPTION 'Radius geofence harus lebih besar dari 0 meter.';
  END IF;

  -- Pertahankan mode yang sudah ada. Versi lama menulis 'auto' keras di sini, sehingga
  -- menyimpan dari HP diam-diam mengembalikan mode "manual" yang di-set lewat web.
  -- Panel pusat di Android memang belum punya field mode, jadi jangan diubah dari sini.
  SELECT coalesce(gs.value->>'absen_window_mode', 'auto')
    INTO existing_mode
  FROM public.global_settings gs
  WHERE gs.key = 'global_attendance_config';

  INSERT INTO public.global_settings(key, value)
  VALUES (
    'global_attendance_config',
    jsonb_build_object(
      'jam_masuk', to_char(p_jam_masuk, 'HH24:MI'),
      'jam_keluar', to_char(p_jam_keluar, 'HH24:MI'),
      'toleransi_menit', p_toleransi_menit,
      'radius_m', p_radius_m,
      'absen_window_mode', coalesce(existing_mode, 'auto')
    )
  )
  ON CONFLICT (key) DO UPDATE
    SET value = excluded.value,
        updated_at = now();

  -- Sengaja TIDAK menyentuh outlet_attendance_config sama sekali.
  RETURN jsonb_build_object(
    'success', true,
    'scope', 'global_only'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_global_attendance_config(time without time zone, time without time zone, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_global_attendance_config(time without time zone, time without time zone, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_attendance_config(target_outlet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.outlet_staff me
    where me.id = auth.uid()
      and me.status = 'active'
      and (
        me.role = any (array['admin'::text, 'admin_hr'::text, 'regional_manager'::text, 'developer'::text])
        or me.outlet_id = target_outlet_id
        or exists (
          select 1
          from public.staff_outlets assignment
          where assignment.staff_id = me.id
            and assignment.outlet_id = target_outlet_id
        )
      )
  );
$$;
