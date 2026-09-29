-- TEMPLATE: RPC daftar terpaginasi (halaman + total + ringkasan dalam satu panggilan)
-- Ganti: <entitas>, <tabel>, kolom filter/urutan/ringkasan. Contoh nyata:
--   supabase/migrations/20260929150000_hr_status_kehadiran_lengkap.sql (hr_absensi_harian)
--   supabase/migrations/20260929132000_hr_cuti_kasbon_daftar.sql      (hr_cuti_daftar)

CREATE OR REPLACE FUNCTION public.<entitas>_daftar(
  p_from           date,
  p_to             date,
  p_outlet         uuid    DEFAULT NULL,
  p_status         text    DEFAULT NULL,   -- NULL / '' / 'all' = semua
  p_search         text    DEFAULT NULL,
  p_exclude_staff  uuid[]  DEFAULT '{}',   -- daftar id di BODY, bukan URL
  p_limit          integer DEFAULT 50,
  p_offset         integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER              -- RLS tabel tetap berlaku
SET search_path = public
AS $$
DECLARE
  v_status text    := NULLIF(NULLIF(p_status, ''), 'all');
  v_q      text    := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_staff  uuid[];
  v_ex     uuid[]  := COALESCE(p_exclude_staff, '{}');
  v_limit  integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 5000);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_ring   jsonb;
  v_total  bigint;
  v_rows   jsonb;
BEGIN
  -- Pencarian nama → daftar id dari tabel master kecil (escape wildcard)
  IF v_q IS NOT NULL THEN
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    SELECT COALESCE(array_agg(s.id), '{}') INTO v_staff
    FROM outlet_staff s WHERE s.name ILIKE v_q OR s.username ILIKE v_q;
  END IF;

  -- (1) total & ringkasan — agregat ringan (idealnya index-only scan)
  SELECT jsonb_build_object(
           'a', count(*) FILTER (WHERE t.status = 'a'),
           'b', count(*) FILTER (WHERE t.status = 'b')),
         count(*) FILTER (WHERE v_status IS NULL OR t.status = v_status)
  INTO v_ring, v_total
  FROM <tabel> t
  WHERE t.tgl BETWEEN p_from AND p_to
    AND (p_outlet IS NULL OR t.outlet_id = p_outlet)
    AND NOT (t.staff_id = ANY (v_ex))
    AND (v_staff IS NULL OR t.staff_id = ANY (v_staff));

  -- (2) satu halaman — LIMIT di subquery, join master SESUDAH limit
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'tanggal', to_char(p.tgl, 'YYYY-MM-DD'),
           'status', p.status,
           'staff', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('name', s.name, 'role', s.role) END
         ) ORDER BY p.tgl DESC, p.id), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT t.* FROM <tabel> t
    WHERE t.tgl BETWEEN p_from AND p_to
      AND (p_outlet IS NULL OR t.outlet_id = p_outlet)
      AND (v_status IS NULL OR t.status = v_status)
      AND NOT (t.staff_id = ANY (v_ex))
      AND (v_staff IS NULL OR t.staff_id = ANY (v_staff))
    ORDER BY t.tgl DESC, t.id           -- tiebreak unik
    LIMIT v_limit OFFSET v_offset
  ) p
  LEFT JOIN outlet_staff s ON s.id = p.staff_id;

  RETURN jsonb_build_object('total', v_total, 'ringkasan', v_ring, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.<entitas>_daftar(date, date, uuid, text, text, uuid[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.<entitas>_daftar(date, date, uuid, text, text, uuid[], integer, integer) TO authenticated;

-- Index pendamping: cocok dengan WHERE + ORDER BY, INCLUDE kolom ringkasan
CREATE INDEX IF NOT EXISTS idx_<tabel>_tgl ON public.<tabel> (tgl DESC, id) INCLUDE (status, outlet_id, staff_id);
