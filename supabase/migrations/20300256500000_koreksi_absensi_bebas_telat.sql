-- Koreksi absensi: fitur "Hilangkan label telat" dengan catatan izin wajib.
-- Saat p_bebas_telat = true:
--   1. Catatan izin (p_catatan) WAJIB diisi minimal 3 karakter (divalidasi di DB).
--   2. Baris absen masuk di tabel `attendance` disimpan sebagai status = 'tepat',
--      telat_menit = 0, catatan = p_catatan (jam masuk asli tetap dipertahankan).
--   3. Trigger trg_attendance_harian otomatis memperbarui `attendance_harian`
--      (status = 'hadir', status_in = 'tepat', telat_menit = 0, telat_menit_denda = 0,
--      keterangan = p_catatan), sehingga Dashboard HR, Rekap Payroll, dan Evaluasi Kinerja
--      langsung ikut hilang label/denda telatnya secara sinkron & realtime.
--   4. Tercatat penuh di jejak audit `attendance_koreksi`.

CREATE OR REPLACE FUNCTION public.koreksi_absensi_v2(
  p_staff_id      uuid,
  p_tanggal       date,
  p_outlet_id     uuid,
  p_jam_masuk     time,
  p_status_masuk  text,
  p_telat_masuk   integer,
  p_jam_pulang    time,
  p_status_pulang text,
  p_menit_pulang  integer,
  p_alasan        text,
  p_bebas_telat   boolean DEFAULT false,
  p_catatan       text    DEFAULT NULL
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
  v_catatan   text;
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
  IF p_status_masuk IS NOT NULL AND p_status_masuk NOT IN ('tepat', 'telat_toleransi', 'telat', 'alpha') THEN
    RAISE EXCEPTION 'Status masuk tidak dikenal: %', p_status_masuk USING errcode = '22023';
  END IF;
  IF p_status_pulang IS NOT NULL AND p_status_pulang NOT IN ('tepat', 'lebih_awal', 'pulang_telat') THEN
    RAISE EXCEPTION 'Status pulang tidak dikenal: %', p_status_pulang USING errcode = '22023';
  END IF;
  IF coalesce(p_bebas_telat, false) THEN
    IF p_jam_masuk IS NULL THEN
      RAISE EXCEPTION 'Jam masuk wajib aktif untuk menghilangkan label telat' USING errcode = '22023';
    END IF;
    IF p_status_masuk = 'alpha' THEN
      RAISE EXCEPTION 'Tidak dapat menandai Alfa sekaligus menghilangkan label telat' USING errcode = '22023';
    END IF;
    IF coalesce(length(btrim(p_catatan)), 0) < 3 THEN
      RAISE EXCEPTION 'Catatan izin wajib diisi (minimal 3 karakter) untuk menghilangkan label telat'
        USING errcode = '22023';
    END IF;
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
    -- Pertahankan detik asli ts_server bila jam & menit tidak diubah.
    IF v_ada_in AND to_char(v_in.ts_server AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') = to_char(p_jam_masuk, 'HH24:MI') THEN
      v_ts_in := v_in.ts_server;
    ELSE
      v_ts_in := (p_tanggal + p_jam_masuk) AT TIME ZONE 'Asia/Jakarta';
    END IF;

    IF p_status_masuk = 'alpha' THEN
      v_status  := 'alpha';
      v_menit   := 0;
      v_catatan := NULL;
    ELSIF coalesce(p_bebas_telat, false) THEN
      v_status  := 'tepat';
      v_menit   := 0;
      v_catatan := btrim(p_catatan);
    ELSE
      SELECT h.status, h.menit INTO v_status, v_menit
        FROM public.hitung_status_absen('in', p_jam_masuk,
               CASE WHEN v_ada_in THEN v_in.outlet_id ELSE p_outlet_id END,
               v_shift_in, v_shift_out) h;
      v_catatan := NULLIF(btrim(coalesce(p_catatan, '')), '');
    END IF;

    IF v_ada_in THEN
      UPDATE attendance
         SET ts_server = v_ts_in,
             status = v_status,
             telat_menit = v_menit,
             catatan = v_catatan
       WHERE id = v_in.id;
    ELSE
      INSERT INTO attendance (id, outlet_staff_id, outlet_id, type, ts_server, status, telat_menit,
                              is_manual_button, source, shift_jam_masuk, shift_jam_keluar, catatan)
      VALUES (gen_random_uuid(), p_staff_id, p_outlet_id, 'in', v_ts_in, v_status, v_menit,
              true, 'web', v_shift_in, v_shift_out, v_catatan);
    END IF;
  END IF;

  -- ── Sisi pulang ──
  IF p_jam_pulang IS NULL THEN
    IF v_ada_out THEN DELETE FROM attendance WHERE id = v_out.id; END IF;
  ELSE
    IF v_ada_out AND to_char(v_out.ts_server AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') = to_char(p_jam_pulang, 'HH24:MI') THEN
      v_ts_out := v_out.ts_server;
    ELSE
      v_ts_out := (p_tanggal + p_jam_pulang) AT TIME ZONE 'Asia/Jakarta';
    END IF;

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

REVOKE ALL ON FUNCTION public.koreksi_absensi_v2(uuid, date, uuid, time, text, integer, time, text, integer, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koreksi_absensi_v2(uuid, date, uuid, time, text, integer, time, text, integer, text, boolean, text) TO authenticated;

-- Wrapper kompatibilitas mundur untuk pemanggil 10 argumen lama.
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.koreksi_absensi_v2(
    p_staff_id, p_tanggal, p_outlet_id, p_jam_masuk, p_status_masuk,
    p_telat_masuk, p_jam_pulang, p_status_pulang, p_menit_pulang, p_alasan,
    false, NULL
  );
$$;

REVOKE ALL ON FUNCTION public.koreksi_absensi(uuid, date, uuid, time, text, integer, time, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koreksi_absensi(uuid, date, uuid, time, text, integer, time, text, integer, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
