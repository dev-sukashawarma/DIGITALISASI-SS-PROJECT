-- Halaman SP & Disiplin (apps/HR /discipline): ringkasan + satu halaman daftar
-- dalam satu panggilan. Sebelumnya seluruh riwayat SP ditarik ke browser.
--
-- "Aktif" = status 'active' dan masa berlaku (expires_at, fallback expiry_date)
-- belum lewat per tanggal WIB — sama dengan isRecordActive() di disciplineUtils.ts.
-- SECURITY INVOKER: RLS discipline_records tetap berlaku.

CREATE OR REPLACE FUNCTION public.hr_sp_daftar(
  p_filter        text    DEFAULT 'all',   -- all | active | resolved
  p_exclude_staff uuid[]  DEFAULT '{}',
  p_limit         integer DEFAULT 50,
  p_offset        integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH basis AS (
    SELECT d.*,
           COALESCE(
             d.status = 'active'
             AND (COALESCE(d.expires_at, d.expiry_date) IS NULL
                  OR COALESCE(d.expires_at, d.expiry_date) >= (now() AT TIME ZONE 'Asia/Jakarta')::date),
             false) AS aktif
    FROM discipline_records d
    WHERE NOT (d.staff_id = ANY (COALESCE(p_exclude_staff, '{}')))
  ),
  terfilter AS (
    SELECT b.* FROM basis b
    WHERE COALESCE(p_filter, 'all') = 'all'
       OR (p_filter = 'active' AND b.aktif)
       OR (p_filter = 'resolved' AND NOT b.aktif)
  )
  SELECT jsonb_build_object(
    'ringkasan', (
      SELECT jsonb_build_object(
        'active', count(*) FILTER (WHERE aktif),
        'sp1',    count(*) FILTER (WHERE aktif AND warning_level = 'SP1'),
        'sp2',    count(*) FILTER (WHERE aktif AND warning_level = 'SP2'),
        'sp3',    count(*) FILTER (WHERE aktif AND warning_level IN ('SP3', 'Skorsing')),
        'total',  count(*)
      ) FROM basis
    ),
    'total', (SELECT count(*) FROM terfilter),
    'rows', COALESCE((
      SELECT jsonb_agg(
        (to_jsonb(p) - 'aktif') || jsonb_build_object('outlet_staff',
          CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
            'name', s.name, 'role', s.role, 'username', s.username,
            'account_category', s.account_category, 'outlet_id', s.outlet_id,
            'outlets', CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('name', o.name) END
          ) END)
        ORDER BY p.created_at DESC, p.id)
      FROM (
        SELECT t.* FROM terfilter t
        ORDER BY t.created_at DESC, t.id
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 1000)
        OFFSET GREATEST(COALESCE(p_offset, 0), 0)
      ) p
      LEFT JOIN outlet_staff s ON s.id = p.staff_id
      LEFT JOIN outlets o      ON o.id = s.outlet_id
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.hr_sp_daftar(text, uuid[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_sp_daftar(text, uuid[], integer, integer) TO authenticated;
