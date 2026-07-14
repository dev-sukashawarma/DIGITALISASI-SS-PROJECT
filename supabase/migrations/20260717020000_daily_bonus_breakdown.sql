-- 20260717020000_daily_bonus_breakdown.sql

CREATE OR REPLACE FUNCTION public.get_daily_bonus_breakdown(
  p_month INT,
  p_year INT,
  p_outlet_id UUID
)
RETURNS TABLE (
  order_date DATE,
  daily_sales NUMERIC,
  target_amount NUMERIC,
  bonus_amount NUMERIC,
  is_reached BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date DATE := make_date(p_year, p_month, 1);
  v_end_date DATE := LEAST(
    (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
    (now() AT TIME ZONE 'Asia/Jakarta')::DATE
  );
BEGIN
  -- 1. Check permissions
  IF NOT public.is_owner_or_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.outlet_staff os
      WHERE os.id = auth.uid() AND os.outlet_id = p_outlet_id AND os.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- 2. Return daily breakdown up to today (or end of month if it's a past month)
  -- If v_end_date is before v_start_date (e.g. querying a future month), it will return nothing.
  RETURN QUERY
  WITH days AS (
    SELECT d::DATE AS dt
    FROM generate_series(v_start_date, v_end_date, '1 day'::interval) d
  ),
  daily_sales_data AS (
    SELECT
      (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date AS dt,
      SUM(ord.total_amount) AS total_sales
    FROM public.orders ord
    WHERE ord.outlet_id = p_outlet_id
      AND ord.status = 'completed'
      AND ord.created_at AT TIME ZONE 'Asia/Jakarta' >= v_start_date
      AND ord.created_at AT TIME ZONE 'Asia/Jakarta' < v_start_date + INTERVAL '1 month'
    GROUP BY 1
  )
  SELECT 
    d.dt AS order_date,
    COALESCE(s.total_sales, 0)::NUMERIC AS daily_sales,
    COALESCE(public.resolve_daily_target(p_outlet_id, d.dt), 0)::NUMERIC AS target_amount,
    COALESCE(public.resolve_daily_bonus(p_outlet_id, d.dt), 0)::NUMERIC AS bonus_amount,
    (COALESCE(s.total_sales, 0) >= COALESCE(public.resolve_daily_target(p_outlet_id, d.dt), 0)) AS is_reached
  FROM days d
  LEFT JOIN daily_sales_data s ON d.dt = s.dt
  ORDER BY d.dt ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_bonus_breakdown(INT, INT, UUID) TO authenticated;
