-- Dashboard HR: tampilkan status absen pulang (Pulang Cepat) — sinkron dengan Rekap
-- Absensi (Stealth) admin-dashboard.
--
-- Keputusan owner 2026-10-03: pulang LEWAT jam pulang tidak diberi label "Pulang Telat"
-- (cukup "Pulang"); pulang LEBIH AWAL tetap ditandai "Pulang Cepat". Data
-- attendance.status ('pulang_telat'/'lebih_awal') TIDAK diubah — hanya label di layar.
--
-- hr_absensi_harian kini ikut mengembalikan 'out_status' & 'out_minutes' per baris.
-- Definisi diambil dari pg_get_functiondef produksi (2026-10-03); yang berubah hanya
-- dua key itu + LEFT JOIN LATERAL ke baris 'out'. Aditif: kunci lama tetap sama.

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
      'out_status', ao.status,
      'out_minutes', ao.telat_menit,
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
  LEFT JOIN outlets o      ON o.id = p.outlet_id
  -- Status absen pulang (baris 'out' yang jadi clock_out). Hanya untuk baris di halaman
  -- ini (≤ p_limit), memakai idx_attendance_staff_ts.
  LEFT JOIN LATERAL (
    SELECT a.status, a.telat_menit
      FROM attendance a
     WHERE a.outlet_staff_id = p.staff_id
       AND a.outlet_id = p.outlet_id
       AND a.type = 'out'
       AND a.ts_server = p.clock_out
     LIMIT 1
  ) ao ON p.clock_out IS NOT NULL;

  RETURN jsonb_build_object('total', v_total, 'ringkasan', v_ring, 'rows', v_rows);
END;
$function$;
