-- Koreksi absensi: status masuk/pulang DIHITUNG ULANG dari jam, bukan dipilih manual.
--
-- Masalah (Rekap Absensi Stealth, 2026-10-03): saat jam masuk/pulang diedit, label
-- "Terlambat / Telat dlm Toleransi / Pulang Telat" tidak ikut berubah. RPC
-- koreksi_absensi (20260929100000) menyimpan status & menit APA ADANYA dari klien,
-- sementara modal hanya menebak status bila baris punya shift_jam_masuk, dan tidak
-- pernah mengenal toleransi. Contoh nyata: Muhamad Rifqi Darmawan 2 Okt, jam masuk
-- dikoreksi 15:55 → 13:15, tetap tercatat 'telat' 175 menit (dan 175 menit itu ikut
-- telat_menit_denda payroll di attendance_harian).
--
-- Perbaikan: satu sumber aturan di database.
--   * aturan_jam_absen(outlet)  — jam masuk/keluar/toleransi: outlet_attendance_config,
--                                 fallback global_settings.global_attendance_config
--                                 (urutan sama dengan submit_attendance).
--   * hitung_status_absen(...)  — aturan status IDENTIK dengan submit_attendance
--                                 (20300235000000): masuk ≤0 tepat, ≤toleransi
--                                 telat_toleransi, selebihnya telat; pulang <0 lebih_awal,
--                                 ≥1 pulang_telat, 0 tepat. Shift lewat tengah malam
--                                 ditangani dengan cara yang sama.
--     ⚠️ Kalau aturan di submit_attendance berubah, ubah fungsi ini juga (dan cermin
--        TS-nya: apps/admin-dashboard/src/lib/absensi/statusAbsen.ts).
--   * koreksi_absensi — signature TIDAK berubah (klien lama tetap jalan). Status masuk
--     dari klien hanya dihormati bila 'alpha' (keputusan manusia, bukan turunan jam);
--     selain itu status & menit dihitung. Status/menit pulang dari klien diabaikan.
--
-- Semua layar membaca attendance.status/telat_menit (Rekap Stealth, Absensi & Shift,
-- app HR lewat attendance_harian yang diisi trigger trg_attendance_harian), jadi
-- semuanya ikut sinkron tanpa perubahan lain.

CREATE OR REPLACE FUNCTION public.aturan_jam_absen(p_outlet_id uuid)
RETURNS TABLE (jam_masuk time, jam_keluar time, toleransi_menit integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_global jsonb;
BEGIN
  RETURN QUERY
    SELECT c.jam_masuk, c.jam_keluar, coalesce(c.toleransi_menit, 0)
      FROM outlet_attendance_config c
     WHERE c.outlet_id = p_outlet_id;
  IF FOUND THEN RETURN; END IF;

  SELECT value INTO v_global FROM global_settings WHERE key = 'global_attendance_config';
  jam_masuk       := coalesce((v_global->>'jam_masuk')::time, '09:00');
  jam_keluar      := coalesce((v_global->>'jam_keluar')::time, '17:00');
  toleransi_menit := coalesce((v_global->>'toleransi_menit')::int, 0);
  RETURN NEXT;
END;
$$;

-- Tidak sensitif (jam kerja); dibutuhkan modal edit untuk pratinjau status.
REVOKE ALL ON FUNCTION public.aturan_jam_absen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aturan_jam_absen(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.hitung_status_absen(
  p_type         text,
  p_jam          time,
  p_outlet_id    uuid,
  p_shift_masuk  time,
  p_shift_keluar time
)
RETURNS TABLE (status text, menit integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg       record;
  v_masuk     time;
  v_keluar    time;
  v_in_m      int;
  v_out_m     int;
  v_jam_m     int;
  v_diff      int;
BEGIN
  SELECT * INTO v_cfg FROM public.aturan_jam_absen(p_outlet_id);
  -- Shift yang tercatat di baris absen menang; tanpa shift → jam config outlet
  -- (sama dengan submit_attendance saat opsi pilih-shift tidak aktif).
  v_masuk  := coalesce(p_shift_masuk, v_cfg.jam_masuk, '09:00');
  v_keluar := coalesce(p_shift_keluar, v_cfg.jam_keluar, '17:00');

  v_in_m  := extract(hour FROM v_masuk)::int * 60 + extract(minute FROM v_masuk)::int;
  v_out_m := extract(hour FROM v_keluar)::int * 60 + extract(minute FROM v_keluar)::int;
  v_jam_m := extract(hour FROM p_jam)::int * 60 + extract(minute FROM p_jam)::int;

  IF v_out_m < v_in_m THEN
    v_out_m := v_out_m + 1440;
    IF v_jam_m < v_in_m - 180 THEN v_jam_m := v_jam_m + 1440; END IF;
  END IF;

  IF p_type = 'out' THEN
    v_diff := v_jam_m - v_out_m;
    IF v_diff < 0 THEN
      status := 'lebih_awal';   menit := -v_diff;
    ELSIF v_diff >= 1 THEN
      status := 'pulang_telat'; menit := v_diff;
    ELSE
      status := 'tepat';        menit := 0;
    END IF;
  ELSE
    v_diff := v_jam_m - v_in_m;
    IF v_diff <= 0 THEN
      status := 'tepat';           menit := 0;
    ELSIF v_diff <= coalesce(v_cfg.toleransi_menit, 0) THEN
      status := 'telat_toleransi'; menit := v_diff;
    ELSE
      status := 'telat';           menit := v_diff;
    END IF;
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.hitung_status_absen(text, time, uuid, time, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hitung_status_absen(text, time, uuid, time, time) TO authenticated, service_role;

-- ── koreksi_absensi: sama dengan 20260929100000 kecuali penentuan status/menit ──
CREATE OR REPLACE FUNCTION public.koreksi_absensi(
  p_staff_id      uuid,
  p_tanggal       date,
  p_outlet_id     uuid,
  p_jam_masuk     time,
  p_status_masuk  text,
  p_telat_masuk   integer,
  p_jam_pulang    time,
  p_status_pulang text,
  p_menit_pulang  integer,
  p_alasan        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_mulai     timestamptz := (p_tanggal::timestamp) AT TIME ZONE 'Asia/Jakarta';
  v_selesai   timestamptz := ((p_tanggal + 1)::timestamp) AT TIME ZONE 'Asia/Jakarta';
  v_sebelum   jsonb;
  v_sesudah   jsonb;
  v_in        attendance%ROWTYPE;
  v_out       attendance%ROWTYPE;
  v_ada_in    boolean;
  v_ada_out   boolean;
  v_ts_in     timestamptz;
  v_ts_out    timestamptz;
  v_shift_in  time;
  v_shift_out time;
  v_status    text;
  v_menit     integer;
BEGIN
  IF v_uid IS NULL OR NOT public.boleh_koreksi_absensi() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya owner, admin, HR, atau developer yang boleh mengoreksi absensi'
      USING errcode = '42501';
  END IF;

  IF p_staff_id IS NULL OR p_tanggal IS NULL THEN
    RAISE EXCEPTION 'Staf dan tanggal wajib diisi' USING errcode = '22023';
  END IF;
  IF coalesce(length(btrim(p_alasan)), 0) < 3 THEN
    RAISE EXCEPTION 'Alasan koreksi wajib diisi (minimal 3 huruf)' USING errcode = '22023';
  END IF;
  IF p_jam_masuk IS NULL AND p_jam_pulang IS NULL THEN
    RAISE EXCEPTION 'Jam masuk dan jam pulang tidak boleh kosong keduanya — gunakan Hapus'
      USING errcode = '22023';
  END IF;
  -- NULL = hitung otomatis. Nilai lama tetap diterima (klien versi lama) tapi hanya
  -- 'alpha' yang dihormati.
  IF p_status_masuk IS NOT NULL AND p_status_masuk NOT IN ('tepat', 'telat_toleransi', 'telat', 'alpha') THEN
    RAISE EXCEPTION 'Status masuk tidak dikenal: %', p_status_masuk USING errcode = '22023';
  END IF;
  IF p_status_pulang IS NOT NULL AND p_status_pulang NOT IN ('tepat', 'lebih_awal', 'pulang_telat') THEN
    RAISE EXCEPTION 'Status pulang tidak dikenal: %', p_status_pulang USING errcode = '22023';
  END IF;
  IF p_jam_masuk IS NOT NULL AND p_jam_pulang IS NOT NULL AND p_jam_pulang <= p_jam_masuk THEN
    RAISE EXCEPTION 'Jam pulang harus setelah jam masuk' USING errcode = '22023';
  END IF;

  PERFORM 1 FROM attendance
   WHERE outlet_staff_id = p_staff_id AND ts_server >= v_mulai AND ts_server < v_selesai
   FOR UPDATE;

  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.ts_server), '[]'::jsonb) INTO v_sebelum
    FROM attendance a
   WHERE a.outlet_staff_id = p_staff_id AND a.ts_server >= v_mulai AND a.ts_server < v_selesai;

  SELECT * INTO v_in FROM attendance
   WHERE outlet_staff_id = p_staff_id AND type = 'in' AND ts_server >= v_mulai AND ts_server < v_selesai
   ORDER BY ts_server ASC LIMIT 1;
  v_ada_in := FOUND;
  SELECT * INTO v_out FROM attendance
   WHERE outlet_staff_id = p_staff_id AND type = 'out' AND ts_server >= v_mulai AND ts_server < v_selesai
   ORDER BY ts_server DESC LIMIT 1;
  v_ada_out := FOUND;

  IF NOT v_ada_in AND NOT v_ada_out THEN
    RAISE EXCEPTION 'Data absensi staf ini pada tanggal tersebut tidak ditemukan (mungkin sudah dihapus)'
      USING errcode = 'P0002';
  END IF;
  IF p_outlet_id IS NULL
     AND ((p_jam_masuk IS NOT NULL AND NOT v_ada_in) OR (p_jam_pulang IS NOT NULL AND NOT v_ada_out)) THEN
    RAISE EXCEPTION 'Outlet wajib diisi untuk menambah absen baru' USING errcode = '22023';
  END IF;

  v_shift_in  := coalesce(v_in.shift_jam_masuk, v_out.shift_jam_masuk);
  v_shift_out := coalesce(v_out.shift_jam_keluar, v_in.shift_jam_keluar);

  -- ── Sisi masuk ──
  IF p_jam_masuk IS NULL THEN
    IF v_ada_in THEN DELETE FROM attendance WHERE id = v_in.id; END IF;
  ELSE
    v_ts_in := (p_tanggal + p_jam_masuk) AT TIME ZONE 'Asia/Jakarta';
    IF p_status_masuk = 'alpha' THEN
      v_status := 'alpha'; v_menit := 0;
    ELSE
      SELECT h.status, h.menit INTO v_status, v_menit
        FROM public.hitung_status_absen('in', p_jam_masuk,
               CASE WHEN v_ada_in THEN v_in.outlet_id ELSE p_outlet_id END,
               v_shift_in, v_shift_out) h;
    END IF;
    IF v_ada_in THEN
      UPDATE attendance
         SET ts_server = v_ts_in, status = v_status, telat_menit = v_menit
       WHERE id = v_in.id;
    ELSE
      INSERT INTO attendance (id, outlet_staff_id, outlet_id, type, ts_server, status, telat_menit,
                              is_manual_button, source, shift_jam_masuk, shift_jam_keluar)
      VALUES (gen_random_uuid(), p_staff_id, p_outlet_id, 'in', v_ts_in, v_status, v_menit,
              true, 'web', v_shift_in, v_shift_out);
    END IF;
  END IF;

  -- ── Sisi pulang ──
  IF p_jam_pulang IS NULL THEN
    IF v_ada_out THEN DELETE FROM attendance WHERE id = v_out.id; END IF;
  ELSE
    v_ts_out := (p_tanggal + p_jam_pulang) AT TIME ZONE 'Asia/Jakarta';
    SELECT h.status, h.menit INTO v_status, v_menit
      FROM public.hitung_status_absen('out', p_jam_pulang,
             CASE WHEN v_ada_out THEN v_out.outlet_id ELSE p_outlet_id END,
             v_shift_in, v_shift_out) h;
    IF v_ada_out THEN
      UPDATE attendance
         SET ts_server = v_ts_out, status = v_status, telat_menit = v_menit
       WHERE id = v_out.id;
    ELSE
      INSERT INTO attendance (id, outlet_staff_id, outlet_id, type, ts_server, status, telat_menit,
                              is_manual_button, source, shift_jam_masuk, shift_jam_keluar)
      VALUES (gen_random_uuid(), p_staff_id, p_outlet_id, 'out', v_ts_out, v_status, v_menit,
              true, 'web', v_shift_in, v_shift_out);
    END IF;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.ts_server), '[]'::jsonb) INTO v_sesudah
    FROM attendance a
   WHERE a.outlet_staff_id = p_staff_id AND a.ts_server >= v_mulai AND a.ts_server < v_selesai;

  INSERT INTO attendance_koreksi (aksi, staff_id, tanggal, sebelum, sesudah, alasan, dilakukan_oleh)
  VALUES ('ubah', p_staff_id, p_tanggal, v_sebelum, v_sesudah, btrim(p_alasan), v_uid);

  RETURN jsonb_build_object('ok', true, 'sesudah', v_sesudah);
END;
$$;

REVOKE ALL ON FUNCTION public.koreksi_absensi(uuid, date, uuid, time, text, integer, time, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koreksi_absensi(uuid, date, uuid, time, text, integer, time, text, integer, text) TO authenticated;
