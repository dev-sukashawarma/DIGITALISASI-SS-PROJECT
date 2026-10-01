-- Telat yang masih DALAM TOLERANSI (attendance.status = 'telat_toleransi') diperlakukan
-- sebagai HADIR di rekap HR, bukan Terlambat.
--
-- Sebelumnya attendance_harian_hitung memetakan telat_toleransi → 'terlambat' dan ikut
-- menjumlahkan menitnya ke telat_menit_denda (potongan payroll), sehingga setelan
-- "Batas toleransi keterlambatan" di Pengaturan Absensi tidak berefek apa pun di HR.
--
--  * attendance_harian.status   : telat_toleransi → 'hadir' (status_in tetap mentah,
--                                 telat_menit tetap diisi untuk label "Telat dlm Toleransi").
--  * telat_menit_denda          : menit telat_toleransi TIDAK ikut denda.
--  * hr_rekap_absensi_staf      : hari_tepat menghitung telat_toleransi sebagai tepat.
--  * hr_absensi_harian          : baris memuat 'status_in' agar UI bisa memberi label biru.
--
-- Definisi diambil dari pg_get_functiondef produksi (2026-10-01), hanya baris di atas yang berubah.

CREATE OR REPLACE FUNCTION public.attendance_harian_hitung(p_staff uuid, p_outlet uuid, p_tgl date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('attendance_harian:' || p_staff || ':' || p_outlet || ':' || p_tgl, 0));

  WITH raw AS (
    SELECT a.id, a.type, a.ts_server, a.status, a.selfie_url, a.gps_lat, a.gps_lng,
           a.telat_menit, a.is_manual_button
    FROM attendance a
    WHERE a.outlet_staff_id = p_staff
      AND a.outlet_id = p_outlet
      AND a.ts_server >= (p_tgl::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND a.ts_server <  ((p_tgl + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
  ),
  agg AS (
    SELECT
      (array_agg(r.id ORDER BY r.ts_server))[1]                                           AS first_id,
      min(r.ts_server)                                                                     AS first_ts,
      min(r.ts_server) FILTER (WHERE r.type = 'in')                                        AS clock_in,
      max(r.ts_server) FILTER (WHERE r.type = 'out')                                       AS clock_out,
      (array_agg(r.status ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]           AS status_in,
      (array_agg(r.telat_menit ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]      AS telat_in,
      COALESCE(sum(r.telat_menit) FILTER (
        WHERE r.type = 'in' AND r.status IS DISTINCT FROM 'telat_toleransi'
          AND (COALESCE(r.telat_menit, 0) > 0 OR r.status IN ('telat', 'terlambat'))
      ), 0)::integer                                                                       AS telat_denda,
      COALESCE((array_agg(r.is_manual_button ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1], false) AS manual_in,
      (array_agg(r.selfie_url ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]       AS selfie_in,
      (array_agg(r.gps_lat ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]          AS lat,
      (array_agg(r.gps_lng ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]          AS lng,
      (array_agg(r.selfie_url ORDER BY r.ts_server DESC) FILTER (WHERE r.type = 'out'))[1] AS selfie_out,
      count(*) AS n
    FROM raw r
  )
  INSERT INTO attendance_harian AS h (
    staff_id, outlet_id, tgl, first_id, first_ts, clock_in, clock_out, status_in, status,
    telat_menit, telat_menit_denda, manual_in, selfie_in, selfie_out, lat, lng,
    sumber, keterangan, leave_id, updated_at
  )
  SELECT p_staff, p_outlet, p_tgl, g.first_id, g.first_ts, g.clock_in, g.clock_out, g.status_in,
    CASE
      WHEN g.status_in IN ('telat', 'terlambat') THEN 'terlambat'
      WHEN g.status_in IN ('alpha', 'alfa') THEN 'alfa'
      ELSE 'hadir'
    END,
    CASE WHEN g.status_in IN ('telat', 'terlambat', 'telat_toleransi') THEN COALESCE(g.telat_in, 0) ELSE 0 END,
    g.telat_denda, g.manual_in, g.selfie_in, g.selfie_out, g.lat, g.lng,
    'absen', NULL, NULL, now()
  FROM agg g
  WHERE g.n > 0
  ON CONFLICT (staff_id, outlet_id, tgl) DO UPDATE SET
    first_id = EXCLUDED.first_id, first_ts = EXCLUDED.first_ts,
    clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,
    status_in = EXCLUDED.status_in, status = EXCLUDED.status,
    telat_menit = EXCLUDED.telat_menit, telat_menit_denda = EXCLUDED.telat_menit_denda,
    manual_in = EXCLUDED.manual_in, selfie_in = EXCLUDED.selfie_in, selfie_out = EXCLUDED.selfie_out,
    lat = EXCLUDED.lat, lng = EXCLUDED.lng,
    sumber = 'absen', keterangan = NULL, leave_id = NULL, updated_at = now();

  IF NOT FOUND THEN
    DELETE FROM attendance_harian
    WHERE staff_id = p_staff AND outlet_id = p_outlet AND tgl = p_tgl AND sumber = 'absen';
  END IF;

  -- Absen masuk → alfa/cuti hari itu gugur; absen dihapus → alfa/cuti dihitung ulang
  PERFORM hr_hitung_status_nonabsen(p_tgl, p_staff);
END;
$function$;

CREATE OR REPLACE FUNCTION public.hr_absensi_harian(p_from date, p_to date, p_outlet uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_exclude_staff uuid[] DEFAULT '{}'::uuid[], p_exclude_outlet uuid[] DEFAULT '{}'::uuid[], p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status  text := NULLIF(NULLIF(p_status, ''), 'all');
  v_q       text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_staff   uuid[];
  v_ex_s    uuid[] := COALESCE(p_exclude_staff, '{}');
  v_ex_o    uuid[] := COALESCE(p_exclude_outlet, '{}');
  v_limit   integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 5000);
  v_offset  integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_ring    jsonb;
  v_total   bigint;
  v_rows    jsonb;
BEGIN
  IF v_q IS NOT NULL THEN
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    SELECT COALESCE(array_agg(s.id), '{}') INTO v_staff
    FROM outlet_staff s
    WHERE s.name ILIKE v_q OR s.username ILIKE v_q;
  END IF;

  SELECT
    jsonb_build_object(
      'hadir',     count(*) FILTER (WHERE h.status = 'hadir'),
      'terlambat', count(*) FILTER (WHERE h.status = 'terlambat'),
      'izin',      count(*) FILTER (WHERE h.status = 'izin'),
      'sakit',     count(*) FILTER (WHERE h.status = 'sakit'),
      'cuti',      count(*) FILTER (WHERE h.status = 'cuti'),
      'alfa',      count(*) FILTER (WHERE h.status = 'alfa')
    ),
    count(*) FILTER (WHERE v_status IS NULL OR h.status = v_status)
  INTO v_ring, v_total
  FROM attendance_harian h
  WHERE h.tgl BETWEEN p_from AND p_to
    AND (p_outlet IS NULL OR h.outlet_id = p_outlet)
    AND NOT (h.staff_id = ANY (v_ex_s))
    AND NOT (h.outlet_id = ANY (v_ex_o))
    AND (v_staff IS NULL OR h.staff_id = ANY (v_staff));

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', COALESCE(p.first_id::text, p.staff_id || ':' || p.tgl),
      'staff_id', p.staff_id,
      'outlet_id', p.outlet_id,
      'date', to_char(p.tgl, 'YYYY-MM-DD'),
      'clock_in', p.clock_in,
      'clock_out', p.clock_out,
      'status', p.status,
      'status_in', p.status_in,
      'sumber', p.sumber,
      'late_minutes', p.telat_menit,
      'notes', CASE WHEN p.sumber = 'absen' THEN NULLIF(concat_ws(', ',
          CASE WHEN p.manual_in THEN 'Absen Manual' END,
          CASE WHEN p.status_in = 'telat_toleransi' THEN 'Telat dalam toleransi' END), '')
        ELSE p.keterangan END,
      'selfie_in', p.selfie_in,
      'selfie_out', p.selfie_out,
      'lat', p.lat,
      'lng', p.lng,
      'created_at', p.first_ts,
      'outlet_staff', CASE WHEN s.id IS NULL THEN NULL ELSE
        jsonb_build_object('name', s.name, 'role', s.role, 'username', s.username) END,
      'outlets', CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('name', o.name) END
    ) ORDER BY p.tgl DESC, p.clock_in DESC NULLS LAST, p.staff_id), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT h.*
    FROM attendance_harian h
    WHERE h.tgl BETWEEN p_from AND p_to
      AND (p_outlet IS NULL OR h.outlet_id = p_outlet)
      AND (v_status IS NULL OR h.status = v_status)
      AND NOT (h.staff_id = ANY (v_ex_s))
      AND NOT (h.outlet_id = ANY (v_ex_o))
      AND (v_staff IS NULL OR h.staff_id = ANY (v_staff))
    ORDER BY h.tgl DESC, h.clock_in DESC NULLS LAST, h.staff_id
    LIMIT v_limit OFFSET v_offset
  ) p
  LEFT JOIN outlet_staff s ON s.id = p.staff_id
  LEFT JOIN outlets o      ON o.id = p.outlet_id;

  RETURN jsonb_build_object('total', v_total, 'ringkasan', v_ring, 'rows', v_rows);
END;
$function$;

CREATE OR REPLACE FUNCTION public.hr_rekap_absensi_staf(p_from date, p_to date)
 RETURNS TABLE(staff_id uuid, hari_masuk integer, hari_tepat integer, telat_menit_total integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- DISTINCT tgl: staf yang absen di 2 outlet pada hari yang sama tetap dihitung 1 hari
  SELECT h.staff_id,
         count(DISTINCT h.tgl) FILTER (WHERE h.clock_in IS NOT NULL)::integer,
         count(DISTINCT h.tgl) FILTER (WHERE h.status_in IN ('tepat', 'telat_toleransi'))::integer,
         COALESCE(sum(h.telat_menit_denda), 0)::integer
  FROM attendance_harian h
  WHERE h.tgl BETWEEN p_from AND p_to
  GROUP BY h.staff_id
  HAVING count(*) FILTER (WHERE h.clock_in IS NOT NULL) > 0;
$function$;

-- Hitung ulang hari yang clock-in pertamanya telat_toleransi
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT staff_id, outlet_id, tgl FROM attendance_harian WHERE status_in = 'telat_toleransi' LOOP
    PERFORM attendance_harian_hitung(r.staff_id, r.outlet_id, r.tgl);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
