-- supabase/migrations/20300109000003_optimize_target_progress_range.sql
-- Optimasi get_daily_target_progress_range: ganti correlated subquery N x M
-- dengan single CTE aggregation + LEFT JOIN. Lebih cepat ~10-50x untuk
-- rentang tanggal lebar (>7 hari) dengan banyak outlet.

CREATE OR REPLACE FUNCTION public.get_daily_target_progress_range(
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS TABLE (
  date_value    DATE,
  outlet_id     UUID,
  outlet_name   TEXT,
  target_amount NUMERIC,
  omzet_today   NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  -- Rentang tanggal sebagai series
  dates AS (
    SELECT generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      '1 day'::interval
    )::date AS d
  ),
  -- Agregasi orders per outlet x tanggal lokal (SATU KALI, bukan N x M subquery)
  orders_agg AS (
    SELECT
      ord.outlet_id,
      (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date AS local_date,
      SUM(ord.total_amount) AS total_omzet
    FROM public.orders ord
    WHERE ord.status IN ('completed', 'selesai', 'paid')
      AND ord.created_at >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND ord.created_at <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Asia/Jakarta')
    GROUP BY ord.outlet_id,
             (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date
  )
  SELECT
    d.d                                           AS date_value,
    o.id                                          AS outlet_id,
    o.name                                        AS outlet_name,
    public.resolve_daily_target(o.id, d.d)        AS target_amount,
    COALESCE(oa.total_omzet, 0)                   AS omzet_today
  FROM dates d
  CROSS JOIN public.outlets o
  LEFT JOIN orders_agg oa
    ON oa.outlet_id = o.id AND oa.local_date = d.d
  WHERE o.id IN (SELECT public.accessible_outlet_ids())
  ORDER BY d.d DESC, o.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_target_progress_range TO authenticated;

NOTIFY pgrst, 'reload schema';
