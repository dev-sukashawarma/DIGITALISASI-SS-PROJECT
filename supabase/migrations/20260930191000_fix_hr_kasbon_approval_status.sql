-- Migration: 20260930191000_fix_hr_kasbon_approval_status.sql
-- Tujuan: Menyelaraskan status approval kasbon (status_hr vs status)
-- 1. Update data historis kasbon yang sudah lunas (paid_off) agar status_hr = 'approved'
-- 2. Update fungsi public.hr_perizinan_ringkasan agar menghitung kasbon pending dari status_hr
-- 3. Update fungsi public.hr_kasbon_daftar agar filter status menyesuaikan status_hr ('pending', 'rejected', 'active', 'paid_off')

-- 1. Normalisasi data historis: kasbon yang sudah berstatus paid_off otomatis status_hr diset approved
UPDATE public.cash_advances
SET status_hr = 'approved'
WHERE status = 'paid_off' AND (status_hr IS NULL OR status_hr = 'pending');

-- 2. Update hr_perizinan_ringkasan
CREATE OR REPLACE FUNCTION public.hr_perizinan_ringkasan(p_exclude_staff uuid[] DEFAULT '{}')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cuti', (
      SELECT jsonb_build_object(
        'pending',  count(*) FILTER (WHERE l.status = 'pending'),
        'approved', count(*) FILTER (WHERE l.status = 'approved'),
        'rejected', count(*) FILTER (WHERE l.status = 'rejected'),
        'total',    count(*)
      )
      FROM leave_requests l
      WHERE NOT (l.staff_id = ANY (COALESCE(p_exclude_staff, '{}')))
    ),
    'kasbon', (
      SELECT jsonb_build_object(
        'pending',       count(*) FILTER (WHERE COALESCE(k.status_hr, 'pending') = 'pending' AND k.status != 'paid_off'),
        'active',        count(*) FILTER (WHERE k.status_hr = 'approved' AND k.status = 'active'),
        'total',         count(*),
        'active_amount', COALESCE(sum(COALESCE(k.remaining, k.amount)) FILTER (WHERE k.status_hr = 'approved' AND k.status = 'active'), 0),
        'paid_amount',   COALESCE(sum(k.amount - COALESCE(k.remaining, k.amount)) FILTER (WHERE k.status_hr = 'approved' OR k.status = 'paid_off'), 0)
      )
      FROM cash_advances k
      WHERE NOT (k.staff_id = ANY (COALESCE(p_exclude_staff, '{}')))
    )
  );
$$;

-- 3. Update hr_kasbon_daftar
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
      AND (
        p_status IS NULL OR p_status IN ('', 'all')
        OR (p_status = 'pending' AND COALESCE(k.status_hr, 'pending') = 'pending' AND k.status != 'paid_off')
        OR (p_status = 'rejected' AND k.status_hr = 'rejected')
        OR (p_status = 'active' AND k.status_hr = 'approved' AND k.status = 'active')
        OR (p_status = 'paid_off' AND (k.status = 'paid_off' OR (k.status_hr = 'approved' AND k.status = 'paid_off')))
      )
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

REVOKE ALL ON FUNCTION public.hr_perizinan_ringkasan(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_perizinan_ringkasan(uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.hr_kasbon_daftar(text, uuid, text, uuid[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_kasbon_daftar(text, uuid, text, uuid[], integer, integer) TO authenticated;
