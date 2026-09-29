-- Daftar Cuti & Kasbon (apps/HR /perizinan) dipaginasi di database.
--
-- Lewat RPC (POST body), bukan filter URL PostgREST: daftar akun yang disembunyikan
-- (sekarang ±65 id) dan filter outlet dikirim di body, jadi tidak ada risiko
-- URL kepanjangan (HTTP 414) saat jumlah akun tumbuh. Bentuk baris = bentuk embed
-- PostgREST lama, jadi komponen tabel tidak berubah.
-- SECURITY INVOKER: RLS leave_requests / cash_advances tetap berlaku.

CREATE OR REPLACE FUNCTION public.hr_cuti_daftar(
  p_status        text    DEFAULT NULL,   -- NULL/'all' = semua
  p_outlet        uuid    DEFAULT NULL,   -- outlet utama staf
  p_search        text    DEFAULT NULL,   -- nama / username / alasan
  p_leave_types   text[]  DEFAULT '{}',   -- tipe yang label-nya cocok dengan pencarian
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
  WITH kunci AS (
    SELECT NULLIF(btrim(COALESCE(p_search, '')), '') AS q_raw
  ),
  pola AS (
    SELECT CASE WHEN q_raw IS NULL THEN NULL
                ELSE '%' || replace(replace(replace(q_raw, '\', '\\'), '%', '\%'), '_', '\_') || '%' END AS q
    FROM kunci
  ),
  terfilter AS (
    SELECT l.*
    FROM leave_requests l
    LEFT JOIN outlet_staff s ON s.id = l.staff_id, pola
    WHERE NOT (l.staff_id = ANY (COALESCE(p_exclude_staff, '{}')))
      AND (p_status IS NULL OR p_status IN ('', 'all') OR l.status = p_status)
      AND (p_outlet IS NULL OR s.outlet_id = p_outlet)
      AND (pola.q IS NULL
           OR s.name ILIKE pola.q OR s.username ILIKE pola.q OR l.reason ILIKE pola.q
           OR l.leave_type = ANY (COALESCE(p_leave_types, '{}')))
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM terfilter),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'staff_id', p.staff_id, 'leave_type', p.leave_type,
        'start_date', p.start_date, 'end_date', p.end_date, 'days', p.days,
        'reason', p.reason, 'status', p.status, 'approved_by', p.approved_by,
        'approved_at', p.approved_at, 'rejection_note', p.rejection_note,
        'created_at', p.created_at, 'attachment_url', p.attachment_url,
        'outlet_staff', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
          'name', s.name, 'role', s.role, 'username', s.username,
          'account_category', s.account_category, 'leave_quota', s.leave_quota,
          'outlet_id', s.outlet_id,
          'outlets', CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('name', o.name) END) END
      ) ORDER BY p.created_at DESC, p.id DESC)
      FROM (
        SELECT t.* FROM terfilter t
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 1000)
        OFFSET GREATEST(COALESCE(p_offset, 0), 0)
      ) p
      LEFT JOIN outlet_staff s ON s.id = p.staff_id
      LEFT JOIN outlets o      ON o.id = s.outlet_id
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.hr_kasbon_daftar(
  p_status        text    DEFAULT NULL,
  p_outlet        uuid    DEFAULT NULL,
  p_search        text    DEFAULT NULL,
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
  WITH pola AS (
    SELECT CASE WHEN NULLIF(btrim(COALESCE(p_search, '')), '') IS NULL THEN NULL
                ELSE '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' END AS q
  ),
  terfilter AS (
    SELECT k.*
    FROM cash_advances k
    LEFT JOIN outlet_staff s ON s.id = k.staff_id, pola
    WHERE NOT (k.staff_id = ANY (COALESCE(p_exclude_staff, '{}')))
      AND (p_status IS NULL OR p_status IN ('', 'all') OR k.status = p_status)
      AND (p_outlet IS NULL OR s.outlet_id = p_outlet)
      AND (pola.q IS NULL OR s.name ILIKE pola.q OR s.username ILIKE pola.q OR k.reason ILIKE pola.q)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM terfilter),
    'rows', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(p) || jsonb_build_object(
          'outlet_staff', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
            'name', s.name, 'role', s.role, 'username', s.username,
            'account_category', s.account_category, 'outlet_id', s.outlet_id,
            'outlets', CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('name', o.name) END) END,
          'cash_advance_payments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', c.id, 'amount', c.amount, 'payment_date', c.payment_date,
              'note', c.note, 'created_at', c.created_at) ORDER BY c.created_at)
            FROM cash_advance_payments c WHERE c.cash_advance_id = p.id
          ), '[]'::jsonb))
        ORDER BY p.created_at DESC, p.id DESC)
      FROM (
        SELECT t.* FROM terfilter t
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 1000)
        OFFSET GREATEST(COALESCE(p_offset, 0), 0)
      ) p
      LEFT JOIN outlet_staff s ON s.id = p.staff_id
      LEFT JOIN outlets o      ON o.id = s.outlet_id
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.hr_cuti_daftar(text, uuid, text, text[], uuid[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_cuti_daftar(text, uuid, text, text[], uuid[], integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.hr_kasbon_daftar(text, uuid, text, uuid[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_kasbon_daftar(text, uuid, text, uuid[], integer, integer) TO authenticated;
