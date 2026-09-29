-- Koreksi & hapus absensi dari halaman Rekap Absensi (Stealth) — admin-dashboard.
--
-- Satu baris di layar = satu staf × satu tanggal WIB, gabungan paling banyak dua baris
-- `attendance` (type 'in' dan 'out'). Koreksi harus menyentuh keduanya dalam SATU
-- transaksi, jadi ditulis sebagai RPC, bukan dua UPDATE dari aplikasi.
--
-- Keamanan:
--   * SECURITY DEFINER + cek peran di DALAM fungsi (auth.uid()), bukan di UI/server action
--     saja. Tulis langsung ke `attendance` untuk `authenticated` tetap tidak diberi policy.
--   * Peran: owner, admin, admin_hr, developer (aktif).
--   * Semua baris yang diubah/dihapus dikunci (FOR UPDATE) dan divalidasi milik staf &
--     tanggal yang sama — id dari klien tidak dipercaya.
--   * Jejak audit (`attendance_koreksi`) menyimpan snapshot sebelum & sesudah + alasan.
--     Absensi = dasar payroll, jadi setiap koreksi wajib bisa ditelusuri.
--
-- Nol perubahan pada tabel `attendance` itu sendiri (skema, trigger, policy).

-- ── Jejak audit ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_koreksi (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aksi           text NOT NULL CHECK (aksi IN ('ubah', 'hapus')),
  staff_id       uuid NOT NULL,
  tanggal        date NOT NULL,
  sebelum        jsonb NOT NULL DEFAULT '[]'::jsonb,
  sesudah        jsonb NOT NULL DEFAULT '[]'::jsonb,
  alasan         text NOT NULL,
  dilakukan_oleh uuid NOT NULL,
  dilakukan_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_koreksi_staff_tanggal
  ON public.attendance_koreksi (staff_id, tanggal DESC);

ALTER TABLE public.attendance_koreksi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_koreksi FROM anon, authenticated;
GRANT SELECT ON public.attendance_koreksi TO authenticated;

-- Penjaga peran, satu tempat.
CREATE OR REPLACE FUNCTION public.boleh_koreksi_absensi()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = (SELECT auth.uid())
      AND role IN ('owner', 'admin', 'admin_hr', 'developer')
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.boleh_koreksi_absensi() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boleh_koreksi_absensi() TO authenticated, service_role;

DROP POLICY IF EXISTS attendance_koreksi_select ON public.attendance_koreksi;
CREATE POLICY attendance_koreksi_select ON public.attendance_koreksi
  FOR SELECT TO authenticated
  USING ((SELECT public.boleh_koreksi_absensi()));

-- ── Ubah ───────────────────────────────────────────────────────────────────
-- p_jam_masuk / p_jam_pulang NULL = sisi itu dihapus (bila ada).
-- Sisi yang belum ada tapi diisi jam = dibuat baris baru (absen manual) di p_outlet_id.
-- Outlet baris yang sudah ada TIDAK diubah (masuk & pulang bisa di outlet berbeda).
-- p_telat_masuk / p_menit_pulang NULL = dihitung dari jam shift yang tercatat di baris.
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
  v_uid      uuid := auth.uid();
  v_mulai    timestamptz := (p_tanggal::timestamp) AT TIME ZONE 'Asia/Jakarta';
  v_selesai  timestamptz := ((p_tanggal + 1)::timestamp) AT TIME ZONE 'Asia/Jakarta';
  v_sebelum  jsonb;
  v_sesudah  jsonb;
  v_in       attendance%ROWTYPE;
  v_out      attendance%ROWTYPE;
  v_ada_in   boolean;
  v_ada_out  boolean;
  v_ts_in    timestamptz;
  v_ts_out   timestamptz;
  v_shift_in time;
  v_shift_out time;
  v_telat    integer;
  v_menit    integer;
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
  IF p_jam_masuk IS NOT NULL
     AND (p_status_masuk IS NULL OR p_status_masuk NOT IN ('tepat', 'telat_toleransi', 'telat', 'alpha')) THEN
    RAISE EXCEPTION 'Status masuk tidak dikenal: %', p_status_masuk USING errcode = '22023';
  END IF;
  IF p_jam_pulang IS NOT NULL
     AND (p_status_pulang IS NULL OR p_status_pulang NOT IN ('tepat', 'lebih_awal', 'pulang_telat')) THEN
    RAISE EXCEPTION 'Status pulang tidak dikenal: %', p_status_pulang USING errcode = '22023';
  END IF;
  IF p_jam_masuk IS NOT NULL AND p_jam_pulang IS NOT NULL AND p_jam_pulang <= p_jam_masuk THEN
    RAISE EXCEPTION 'Jam pulang harus setelah jam masuk' USING errcode = '22023';
  END IF;
  IF coalesce(p_telat_masuk, 0) < 0 OR coalesce(p_menit_pulang, 0) < 0 THEN
    RAISE EXCEPTION 'Menit tidak boleh negatif' USING errcode = '22023';
  END IF;

  -- Kunci seluruh baris staf pada tanggal itu (memakai idx_attendance_staff_date).
  PERFORM 1 FROM attendance
   WHERE outlet_staff_id = p_staff_id AND ts_server >= v_mulai AND ts_server < v_selesai
   FOR UPDATE;

  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.ts_server), '[]'::jsonb) INTO v_sebelum
    FROM attendance a
   WHERE a.outlet_staff_id = p_staff_id AND a.ts_server >= v_mulai AND a.ts_server < v_selesai;

  -- Pasangan yang dipakai layar: 'in' paling awal, 'out' paling akhir.
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
    v_telat := CASE
      WHEN p_status_masuk IN ('tepat', 'alpha') THEN 0
      WHEN p_telat_masuk IS NOT NULL THEN p_telat_masuk
      WHEN v_shift_in IS NOT NULL THEN greatest(0, floor(extract(epoch FROM (p_jam_masuk - v_shift_in)) / 60)::int)
      ELSE 0
    END;
    IF v_ada_in THEN
      UPDATE attendance
         SET ts_server = v_ts_in, status = p_status_masuk, telat_menit = v_telat
       WHERE id = v_in.id;
    ELSE
      INSERT INTO attendance (id, outlet_staff_id, outlet_id, type, ts_server, status, telat_menit,
                              is_manual_button, source, shift_jam_masuk, shift_jam_keluar)
      VALUES (gen_random_uuid(), p_staff_id, p_outlet_id, 'in', v_ts_in, p_status_masuk, v_telat,
              true, 'web', v_shift_in, v_shift_out);
    END IF;
  END IF;

  -- ── Sisi pulang ──
  IF p_jam_pulang IS NULL THEN
    IF v_ada_out THEN DELETE FROM attendance WHERE id = v_out.id; END IF;
  ELSE
    v_ts_out := (p_tanggal + p_jam_pulang) AT TIME ZONE 'Asia/Jakarta';
    v_menit := CASE
      WHEN p_status_pulang = 'tepat' THEN 0
      WHEN p_menit_pulang IS NOT NULL THEN p_menit_pulang
      WHEN v_shift_out IS NOT NULL THEN abs(floor(extract(epoch FROM (p_jam_pulang - v_shift_out)) / 60)::int)
      ELSE 0
    END;
    IF v_ada_out THEN
      UPDATE attendance
         SET ts_server = v_ts_out, status = p_status_pulang, telat_menit = v_menit
       WHERE id = v_out.id;
    ELSE
      INSERT INTO attendance (id, outlet_staff_id, outlet_id, type, ts_server, status, telat_menit,
                              is_manual_button, source, shift_jam_masuk, shift_jam_keluar)
      VALUES (gen_random_uuid(), p_staff_id, p_outlet_id, 'out', v_ts_out, p_status_pulang, v_menit,
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

-- ── Hapus ──────────────────────────────────────────────────────────────────
-- Menghapus SEMUA baris absensi staf pada tanggal WIB itu (masuk & pulang, lintas outlet),
-- sama dengan satu baris di layar. Snapshot lengkap disimpan di jejak audit.
CREATE OR REPLACE FUNCTION public.hapus_absensi(
  p_staff_id uuid,
  p_tanggal  date,
  p_alasan   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_mulai   timestamptz := (p_tanggal::timestamp) AT TIME ZONE 'Asia/Jakarta';
  v_selesai timestamptz := ((p_tanggal + 1)::timestamp) AT TIME ZONE 'Asia/Jakarta';
  v_sebelum jsonb;
  v_jumlah  integer;
BEGIN
  IF v_uid IS NULL OR NOT public.boleh_koreksi_absensi() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya owner, admin, HR, atau developer yang boleh menghapus absensi'
      USING errcode = '42501';
  END IF;
  IF p_staff_id IS NULL OR p_tanggal IS NULL THEN
    RAISE EXCEPTION 'Staf dan tanggal wajib diisi' USING errcode = '22023';
  END IF;
  IF coalesce(length(btrim(p_alasan)), 0) < 3 THEN
    RAISE EXCEPTION 'Alasan penghapusan wajib diisi (minimal 3 huruf)' USING errcode = '22023';
  END IF;

  WITH dihapus AS (
    DELETE FROM attendance
     WHERE outlet_staff_id = p_staff_id AND ts_server >= v_mulai AND ts_server < v_selesai
    RETURNING *
  )
  SELECT count(*), coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.ts_server), '[]'::jsonb)
    INTO v_jumlah, v_sebelum
    FROM dihapus d;

  IF v_jumlah = 0 THEN
    RAISE EXCEPTION 'Data absensi staf ini pada tanggal tersebut tidak ditemukan (mungkin sudah dihapus)'
      USING errcode = 'P0002';
  END IF;

  INSERT INTO attendance_koreksi (aksi, staff_id, tanggal, sebelum, sesudah, alasan, dilakukan_oleh)
  VALUES ('hapus', p_staff_id, p_tanggal, v_sebelum, '[]'::jsonb, btrim(p_alasan), v_uid);

  RETURN jsonb_build_object('ok', true, 'dihapus', v_jumlah);
END;
$$;

REVOKE ALL ON FUNCTION public.hapus_absensi(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hapus_absensi(uuid, date, text) TO authenticated;
