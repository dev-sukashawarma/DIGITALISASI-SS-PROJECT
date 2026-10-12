-- Migration: 20300254001100_add_approval_nominal_and_note_to_cash_advances.sql
-- Tujuan: Menambahkan kolom amount_requested dan approval_note pada cash_advances untuk mendukung
-- approval dengan penyesuaian nominal dan pencatatan alasan jika nominal disetujui berbeda.

ALTER TABLE public.cash_advances
  ADD COLUMN IF NOT EXISTS amount_requested numeric,
  ADD COLUMN IF NOT EXISTS approval_note text;

-- Backfill amount_requested dengan amount untuk data yang sudah ada
UPDATE public.cash_advances
SET amount_requested = amount
WHERE amount_requested IS NULL;

-- Trigger agar setiap insert pengajuan baru otomatis menginisialisasi amount_requested jika belum diisi
CREATE OR REPLACE FUNCTION public.trg_set_cash_advance_amount_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount_requested IS NULL THEN
    NEW.amount_requested := NEW.amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_cash_advance_amount_requested ON public.cash_advances;
CREATE TRIGGER trg_set_cash_advance_amount_requested
BEFORE INSERT ON public.cash_advances
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_cash_advance_amount_requested();

-- Update fungsi hr_kasbon_daftar agar pola pencarian mencakup k.approval_note
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
      AND (
        pola.q IS NULL
        OR s.name ILIKE pola.q
        OR s.username ILIKE pola.q
        OR k.reason ILIKE pola.q
        OR k.approval_note ILIKE pola.q
      )
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

REVOKE ALL ON FUNCTION public.hr_kasbon_daftar(text, uuid, text, uuid[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_kasbon_daftar(text, uuid, text, uuid[], integer, integer) TO authenticated;
