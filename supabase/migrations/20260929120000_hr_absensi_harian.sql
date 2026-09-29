-- Absensi & Log Foto (apps/HR /attendance) — pengelompokan harian + pagination di server.
--
-- Masalah: hook lama menarik baris mentah `attendance` dengan .limit(1000) lalu
-- mengelompokkan di browser. Satu hari kerja = 2 baris (in + out), jadi rentang
-- 1–30 September (2.405 baris) terpotong di baris ke-1000 → hanya ±tgl 18 ke atas
-- yang tampil, dan kartu ringkasan ikut salah. Selain itu status `alpha` terbaca
-- sebagai "hadir".
--
-- Fungsi ini mengembalikan SATU jsonb: { total, ringkasan, rows } — satu round-trip
-- per halaman, hanya baris halaman itu yang dikirim ke browser.
--
-- SECURITY INVOKER: RLS `attendance` (accessible_outlet_ids dll.) tetap berlaku.
-- Daftar akun test/dev & outlet tes dikirim dari klien (p_exclude_*) supaya aturan
-- penyaringnya tetap satu sumber (`isTestOrDevStaff`/`isTestOutlet` di apps/HR).

CREATE OR REPLACE FUNCTION public.hr_absensi_harian(
  p_from           date,
  p_to             date,
  p_outlet         uuid    DEFAULT NULL,
  p_status         text    DEFAULT NULL,
  p_search         text    DEFAULT NULL,
  p_exclude_staff  uuid[]  DEFAULT '{}',
  p_exclude_outlet uuid[]  DEFAULT '{}',
  p_limit          integer DEFAULT 50,
  p_offset         integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH raw AS (
    SELECT a.id, a.outlet_staff_id, a.outlet_id, a.type, a.ts_server, a.status,
           a.selfie_url, a.gps_lat, a.gps_lng, a.telat_menit, a.is_manual_button,
           (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date AS tgl
    FROM attendance a
    -- Rentang dalam WIB, sargable terhadap index ts_server
    WHERE a.ts_server >= (p_from::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND a.ts_server <  ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND (p_outlet IS NULL OR a.outlet_id = p_outlet)
      AND NOT (a.outlet_staff_id = ANY (COALESCE(p_exclude_staff, '{}')))
      AND NOT (a.outlet_id = ANY (COALESCE(p_exclude_outlet, '{}')))
  ),
  harian AS (
    SELECT
      r.outlet_staff_id, r.outlet_id, r.tgl,
      (array_agg(r.id ORDER BY r.ts_server))[1]                                           AS id,
      min(r.ts_server)                                                                     AS created_at,
      min(r.ts_server) FILTER (WHERE r.type = 'in')                                        AS clock_in,
      max(r.ts_server) FILTER (WHERE r.type = 'out')                                       AS clock_out,
      (array_agg(r.status ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]           AS status_in,
      (array_agg(r.telat_menit ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]      AS telat_menit,
      (array_agg(r.is_manual_button ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1] AS manual_in,
      (array_agg(r.selfie_url ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]       AS selfie_in,
      (array_agg(r.gps_lat ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]          AS lat,
      (array_agg(r.gps_lng ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]          AS lng,
      (array_agg(r.selfie_url ORDER BY r.ts_server DESC) FILTER (WHERE r.type = 'out'))[1] AS selfie_out
    FROM raw r
    GROUP BY r.outlet_staff_id, r.outlet_id, r.tgl
  ),
  lengkap AS (
    SELECT h.*,
      CASE
        WHEN h.status_in IN ('telat', 'terlambat', 'telat_toleransi') THEN 'terlambat'
        WHEN h.status_in IN ('alpha', 'alfa') THEN 'alfa'
        ELSE 'hadir'
      END AS status,
      NULLIF(concat_ws(', ',
        CASE WHEN h.manual_in THEN 'Absen Manual' END,
        CASE WHEN h.status_in = 'telat_toleransi' THEN 'Telat dalam toleransi' END
      ), '') AS notes,
      s.name AS staff_name, s.role AS staff_role, s.username AS staff_username,
      o.name AS outlet_name
    FROM harian h
    LEFT JOIN outlet_staff s ON s.id = h.outlet_staff_id
    LEFT JOIN outlets o      ON o.id = h.outlet_id
  ),
  dicari AS (
    SELECT l.* FROM lengkap l
    WHERE COALESCE(btrim(p_search), '') = ''
       OR l.staff_name ILIKE '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
       OR l.staff_username ILIKE '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  ),
  terfilter AS (
    SELECT d.* FROM dicari d
    WHERE p_status IS NULL OR p_status IN ('', 'all') OR d.status = p_status
  ),
  halaman AS (
    SELECT t.* FROM terfilter t
    ORDER BY t.tgl DESC, t.clock_in DESC NULLS LAST, t.staff_name, t.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 5000)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM terfilter),
    -- Ringkasan dihitung sebelum filter status (kartu KPI tetap informatif)
    'ringkasan', (
      SELECT jsonb_build_object(
        'hadir',     count(*) FILTER (WHERE status = 'hadir'),
        'terlambat', count(*) FILTER (WHERE status = 'terlambat'),
        'alfa',      count(*) FILTER (WHERE status = 'alfa')
      ) FROM dicari
    ),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'staff_id', p.outlet_staff_id,
        'outlet_id', p.outlet_id,
        'date', to_char(p.tgl, 'YYYY-MM-DD'),
        'clock_in', p.clock_in,
        'clock_out', p.clock_out,
        'status', p.status,
        'late_minutes', CASE WHEN p.status = 'terlambat' THEN COALESCE(p.telat_menit, 0) ELSE 0 END,
        'notes', p.notes,
        'selfie_in', p.selfie_in,
        'selfie_out', p.selfie_out,
        'lat', p.lat,
        'lng', p.lng,
        'created_at', p.created_at,
        'outlet_staff', CASE WHEN p.staff_name IS NULL THEN NULL ELSE
          jsonb_build_object('name', p.staff_name, 'role', p.staff_role, 'username', p.staff_username) END,
        'outlets', CASE WHEN p.outlet_name IS NULL THEN NULL ELSE jsonb_build_object('name', p.outlet_name) END
      ) ORDER BY p.tgl DESC, p.clock_in DESC NULLS LAST, p.staff_name, p.id)
      FROM halaman p
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.hr_absensi_harian(date, date, uuid, text, text, uuid[], uuid[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_absensi_harian(date, date, uuid, text, text, uuid[], uuid[], integer, integer) TO authenticated;

-- Rentang "Semua Outlet" memindai ts_server saja → belum ada index yang diawali ts_server.
CREATE INDEX IF NOT EXISTS idx_attendance_ts_server ON public.attendance (ts_server DESC);

-- Index kembar: btree bisa dipindai dua arah, jadi (x, ts_server) == (x, ts_server DESC).
-- Membuang duplikat mengurangi biaya tulis di tiap clock in/out.
DROP INDEX IF EXISTS public.idx_attendance_staff_date;   -- kembar idx_attendance_staff_ts
DROP INDEX IF EXISTS public.idx_attendance_outlet_date;  -- kembar idx_attendance_outlet_ts
