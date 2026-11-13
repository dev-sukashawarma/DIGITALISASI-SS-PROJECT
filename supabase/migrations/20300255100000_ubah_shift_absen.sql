-- Absensi: karyawan bisa mengganti shift yang dipilih saat absen masuk bila salah pilih.
--
-- Kasus: crew memilih shift pagi (10:00) padahal bekerja shift siang (13:00), sehingga
-- absen 12:55 tercatat telat 175 menit. Sebelumnya hanya admin yang bisa memperbaiki.
--
-- Aturan:
--   * hanya untuk absen masuk yang masih aktif (belum absen pulang) milik staf sendiri;
--   * hanya di outlet berpilihan shift (toggle aktif + minimal 2 shift) dan staf tanpa
--     jadwal khusus — sama dengan syarat modal "Pilih shift" di submit_attendance;
--   * status & menit telat dihitung ulang dari JAM ABSEN ASLI terhadap shift baru,
--     dengan rumus yang sama dengan submit_attendance;
--   * tiap perubahan dicatat di attendance_koreksi (jejak audit, terlihat di rekap admin);
--   * maksimal 3 kali ganti per hari agar tidak dipakai menyiasati telat.
-- attendance_harian ikut diperbarui otomatis oleh trigger trg_attendance_harian.

CREATE OR REPLACE FUNCTION public.ubah_shift_absen(
  p_shift_ke  int,
  p_staff_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  DRIVER_SHIFT_KE CONSTANT int := 99;
  MAKS_GANTI_HARI CONSTANT int := 3;
  v_staff_id     uuid := coalesce(p_staff_id, auth.uid());
  v_staff        record;
  v_rec          record;
  v_cfg          record;
  v_baru_masuk   time;
  v_baru_keluar  time;
  v_jumlah_shift int;
  v_ada_aturan   boolean;
  v_now_efektif  timestamptz;
  v_now_local    timestamp;
  v_now_min      int;
  v_in_min       int;
  v_out_min      int;
  v_diff         int;
  v_status       text;
  v_telat        int;
  v_tanggal      date;
  v_sebelum      jsonb;
  v_sesudah      jsonb;
  v_pelaku       uuid := auth.uid();
BEGIN
  IF v_staff_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF v_staff_id IS DISTINCT FROM auth.uid()
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_or_developer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING errcode = '42501';
  END IF;
  IF p_shift_ke IS NULL OR NOT ((p_shift_ke BETWEEN 1 AND 12) OR p_shift_ke = DRIVER_SHIFT_KE) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'shift_invalid');
  END IF;

  SELECT role, status INTO v_staff FROM outlet_staff WHERE id = v_staff_id;
  IF NOT FOUND OR v_staff.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff_inactive');
  END IF;

  -- Absen masuk aktif: terbaru dalam 20 jam (sama dengan pencarian jejak shift saat absen
  -- pulang) dan belum ada absen pulang sesudahnya. Dikunci agar dua klik tak bertabrakan.
  SELECT a.id, a.outlet_id, a.status, a.telat_menit, a.ts_server, a.ts_client,
         a.sumber_offline, a.jam_diragukan, a.shift_jam_masuk, a.shift_jam_keluar
    INTO v_rec
    FROM attendance a
   WHERE a.outlet_staff_id = v_staff_id
     AND a.type = 'in'
     AND a.status <> 'alpha'
     AND a.ts_server >= now() - interval '20 hours'
   ORDER BY a.ts_server DESC
   LIMIT 1
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_active_in');
  END IF;
  IF EXISTS (
    SELECT 1 FROM attendance o
     WHERE o.outlet_staff_id = v_staff_id AND o.type = 'out' AND o.ts_server > v_rec.ts_server
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_clocked_out');
  END IF;

  SELECT c.toleransi_menit, coalesce(c.pilih_shift_aktif, false) AS pilih_shift_aktif
    INTO v_cfg
    FROM outlet_attendance_config c
   WHERE c.outlet_id = v_rec.outlet_id;
  SELECT count(*) INTO v_jumlah_shift FROM outlet_attendance_shift WHERE outlet_id = v_rec.outlet_id;
  SELECT EXISTS (
    SELECT 1 FROM attendance_staff_schedule_member m
     WHERE m.staff_id = v_staff_id AND m.outlet_id = v_rec.outlet_id
  ) INTO v_ada_aturan;

  IF NOT coalesce(v_cfg.pilih_shift_aktif, false) OR v_jumlah_shift < 2 OR v_ada_aturan THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_shift_choice');
  END IF;

  SELECT s.jam_masuk, s.jam_keluar INTO v_baru_masuk, v_baru_keluar
    FROM outlet_attendance_shift s
   WHERE s.outlet_id = v_rec.outlet_id AND s.urutan = p_shift_ke;
  IF v_baru_keluar IS NULL AND v_staff.role = 'driver' AND p_shift_ke IN (3, DRIVER_SHIFT_KE) THEN
    v_baru_masuk  := '09:00:00';
    v_baru_keluar := '18:00:00';
  END IF;
  IF v_baru_keluar IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'shift_invalid');
  END IF;

  IF v_rec.shift_jam_masuk IS NOT DISTINCT FROM v_baru_masuk
     AND v_rec.shift_jam_keluar IS NOT DISTINCT FROM v_baru_keluar THEN
    RETURN jsonb_build_object('ok', true, 'berubah', false, 'status', v_rec.status,
                              'telat_menit', coalesce(v_rec.telat_menit, 0),
                              'shift_jam_masuk', left(v_baru_masuk::text, 5),
                              'shift_jam_keluar', left(v_baru_keluar::text, 5));
  END IF;

  v_tanggal := (v_rec.ts_server AT TIME ZONE 'Asia/Jakarta')::date;
  IF (SELECT count(*) FROM attendance_koreksi k
       WHERE k.staff_id = v_staff_id AND k.tanggal = v_tanggal
         AND k.alasan LIKE 'Ganti shift oleh karyawan%') >= MAKS_GANTI_HARI THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'batas_ganti_shift');
  END IF;

  -- Hitung ulang dari jam absen asli (absen offline memakai jam klien bila wajar).
  v_now_efektif := CASE WHEN coalesce(v_rec.sumber_offline, false)
                             AND NOT coalesce(v_rec.jam_diragukan, false)
                             AND v_rec.ts_client IS NOT NULL
                        THEN v_rec.ts_client ELSE v_rec.ts_server END;
  v_now_local := v_now_efektif AT TIME ZONE 'Asia/Jakarta';
  v_now_min   := extract(hour from v_now_local)::int * 60 + extract(minute from v_now_local)::int;
  v_in_min    := extract(hour from v_baru_masuk)::int * 60 + extract(minute from v_baru_masuk)::int;
  v_out_min   := extract(hour from v_baru_keluar)::int * 60 + extract(minute from v_baru_keluar)::int;
  IF v_out_min < v_in_min THEN
    IF v_now_min < v_in_min - 180 THEN
      v_now_min := v_now_min + 1440;
    END IF;
  END IF;

  v_diff := v_now_min - v_in_min;
  IF v_diff <= 0 THEN
    v_status := 'tepat';
    v_telat  := NULL;
  ELSIF v_diff <= coalesce(v_cfg.toleransi_menit, 0) THEN
    v_status := 'telat_toleransi';
    v_telat  := v_diff;
  ELSE
    v_status := 'telat';
    v_telat  := v_diff;
  END IF;

  SELECT to_jsonb(a) INTO v_sebelum FROM attendance a WHERE a.id = v_rec.id;

  UPDATE attendance
     SET shift_jam_masuk  = v_baru_masuk,
         shift_jam_keluar = v_baru_keluar,
         status           = v_status,
         telat_menit      = v_telat
   WHERE id = v_rec.id;

  SELECT to_jsonb(a) INTO v_sesudah FROM attendance a WHERE a.id = v_rec.id;

  INSERT INTO attendance_koreksi (aksi, staff_id, tanggal, sebelum, sesudah, alasan, dilakukan_oleh)
  VALUES (
    'ubah', v_staff_id, v_tanggal,
    jsonb_build_array(v_sebelum), jsonb_build_array(v_sesudah),
    'Ganti shift oleh karyawan: ' || left(coalesce(v_rec.shift_jam_masuk::text, '-'), 5) || '-' ||
      left(coalesce(v_rec.shift_jam_keluar::text, '-'), 5) || ' menjadi ' ||
      left(v_baru_masuk::text, 5) || '-' || left(v_baru_keluar::text, 5),
    coalesce(v_pelaku, v_staff_id)
  );

  RETURN jsonb_build_object('ok', true, 'berubah', true, 'status', v_status,
                            'telat_menit', coalesce(v_telat, 0),
                            'shift_jam_masuk', left(v_baru_masuk::text, 5),
                            'shift_jam_keluar', left(v_baru_keluar::text, 5));
END;
$$;

COMMENT ON FUNCTION public.ubah_shift_absen(int, uuid) IS
  'Karyawan mengganti shift absen masuk yang masih aktif; status/telat dihitung ulang & dicatat di attendance_koreksi. Maks 3x/hari.';

REVOKE ALL ON FUNCTION public.ubah_shift_absen(int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ubah_shift_absen(int, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
