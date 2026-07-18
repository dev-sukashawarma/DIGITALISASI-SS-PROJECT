CREATE OR REPLACE FUNCTION public.get_daily_target_progress_range(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  date_value DATE,
  outlet_id UUID,
  outlet_name TEXT,
  target_amount NUMERIC,
  omzet_today NUMERIC
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH dates AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS d
  )
  SELECT
    d.d AS date_value,
    o.id AS outlet_id,
    o.name AS outlet_name,
    public.resolve_daily_target(o.id, d.d) AS target_amount,
    COALESCE((
      SELECT SUM(ord.total_amount)
      FROM public.orders ord
      WHERE ord.outlet_id = o.id
        AND ord.status IN ('completed', 'selesai', 'paid')
        AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = d.d
    ), 0) AS omzet_today
  FROM dates d
  CROSS JOIN public.outlets o
  WHERE o.id IN (SELECT public.accessible_outlet_ids())
  ORDER BY d.d DESC, o.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_target_progress_range TO authenticated;
