-- 20260717030000_update_monthly_crew_bonus_logic.sql

-- 1. Recreate calculate_monthly_crew_bonus to include per-item additional bonus
DROP FUNCTION IF EXISTS public.calculate_monthly_crew_bonus(INT, INT, UUID);

CREATE OR REPLACE FUNCTION public.calculate_monthly_crew_bonus(
  p_month INT,
  p_year INT,
  p_outlet_id UUID
)
RETURNS TABLE (
  crew_name            TEXT,
  role                 TEXT,
  outlet_name          TEXT,
  days_target_reached  INT,
  total_bonus_received NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name TEXT;
  v_crew_count INT;
  v_days_reached INT := 0;
  v_total_bonus NUMERIC := 0;
  v_bonus_per_crew NUMERIC := 0;
BEGIN
  -- 1. Check if caller is owner/admin (via public.is_owner_or_admin())
  -- If not, check if auth.uid() belongs to the given p_outlet_id in public.outlet_staff.
  -- Raise an exception if unauthorized.
  IF NOT public.is_owner_or_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.outlet_staff os
      WHERE os.id = auth.uid() AND os.outlet_id = p_outlet_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- 2. Fetch the outlet name
  SELECT o.name INTO v_outlet_name FROM public.outlets o WHERE o.id = p_outlet_id;
  IF v_outlet_name IS NULL THEN
    RAISE EXCEPTION 'Outlet not found';
  END IF;

  -- 3. Count active crew members (role = 'crew' and status = 'active') at that outlet
  SELECT COUNT(*)::INT INTO v_crew_count
  FROM public.outlet_staff os
  WHERE os.outlet_id = p_outlet_id
    AND os.role = 'crew'
    AND os.status = 'active';

  -- 4. Group completed orders by day (in Asia/Jakarta timezone) for the given month/year
  -- For each day, compare sales to target and accumulate bonus
  SELECT
    COALESCE(SUM(CASE WHEN daily_target_eval.daily_sales >= daily_target_eval.target_amount THEN 1 ELSE 0 END), 0)::INT,
    COALESCE(SUM(CASE WHEN daily_target_eval.daily_sales >= daily_target_eval.target_amount 
                 THEN daily_target_eval.bonus_amount + (daily_target_eval.additional_items * 5000) 
                 ELSE 0 END), 0)::NUMERIC
  INTO
    v_days_reached,
    v_total_bonus
  FROM (
      WITH DailyOrders AS (
        SELECT 
          id AS order_id,
          (created_at AT TIME ZONE 'Asia/Jakarta')::date AS order_date,
          total_amount,
          SUM(total_amount) OVER (PARTITION BY (created_at AT TIME ZONE 'Asia/Jakarta')::date ORDER BY created_at ASC) AS running_total
        FROM public.orders
        WHERE outlet_id = p_outlet_id
          AND status = 'completed'
          AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'Asia/Jakarta')) = p_month
          AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'Asia/Jakarta')) = p_year
      ),
      DailyTargets AS (
        SELECT DISTINCT
          order_date,
          public.resolve_daily_target(p_outlet_id, order_date) AS target_amount,
          public.resolve_daily_bonus(p_outlet_id, order_date) AS bonus_amount
        FROM DailyOrders
      ),
      BonusItems AS (
        SELECT 
          d.order_date,
          COALESCE(SUM(oi.quantity), 0) AS additional_items
        FROM DailyOrders d
        JOIN DailyTargets dt ON dt.order_date = d.order_date
        JOIN public.order_items oi ON oi.order_id = d.order_id
        WHERE d.running_total >= dt.target_amount
        GROUP BY d.order_date
      )
      SELECT
        d.order_date,
        SUM(d.total_amount) AS daily_sales,
        dt.target_amount,
        dt.bonus_amount,
        COALESCE(b.additional_items, 0) AS additional_items
      FROM DailyOrders d
      JOIN DailyTargets dt ON dt.order_date = d.order_date
      LEFT JOIN BonusItems b ON b.order_date = d.order_date
      GROUP BY d.order_date, dt.target_amount, dt.bonus_amount, b.additional_items
  ) daily_target_eval;

  -- 5. Divide total accumulated bonus by crew count to get the bonus per crew (handle division by zero if count is 0)
  IF v_crew_count > 0 THEN
    v_bonus_per_crew := v_total_bonus / v_crew_count;
  ELSE
    v_bonus_per_crew := 0;
  END IF;

  -- 6. Return summary rows for all active crew members at the outlet
  RETURN QUERY
  SELECT
    os.name::TEXT,
    os.role::TEXT,
    v_outlet_name::TEXT,
    v_days_reached,
    v_bonus_per_crew
  FROM public.outlet_staff os
  WHERE os.outlet_id = p_outlet_id
    AND os.role = 'crew'
    AND os.status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_monthly_crew_bonus(INT, INT, UUID) TO authenticated;


-- 2. Update get_daily_bonus_breakdown to also return additional_items
DROP FUNCTION IF EXISTS public.get_daily_bonus_breakdown(INT, INT, UUID);

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
  is_reached BOOLEAN,
  additional_items INT
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
  RETURN QUERY
  WITH days AS (
    SELECT d::DATE AS dt
    FROM generate_series(v_start_date, v_end_date, '1 day'::interval) d
  ),
  DailyOrders AS (
    SELECT 
      id AS order_id,
      (created_at AT TIME ZONE 'Asia/Jakarta')::date AS order_dt,
      total_amount,
      SUM(total_amount) OVER (PARTITION BY (created_at AT TIME ZONE 'Asia/Jakarta')::date ORDER BY created_at ASC) AS running_total
    FROM public.orders
    WHERE outlet_id = p_outlet_id
      AND status = 'completed'
      AND created_at AT TIME ZONE 'Asia/Jakarta' >= v_start_date
      AND created_at AT TIME ZONE 'Asia/Jakarta' < v_start_date + INTERVAL '1 month'
  ),
  DailySalesData AS (
    SELECT
      order_dt AS dt,
      SUM(total_amount) AS total_sales
    FROM DailyOrders
    GROUP BY 1
  ),
  DailyTargets AS (
    SELECT DISTINCT
      d.dt,
      COALESCE(public.resolve_daily_target(p_outlet_id, d.dt), 0)::NUMERIC AS target_amount,
      COALESCE(public.resolve_daily_bonus(p_outlet_id, d.dt), 0)::NUMERIC AS bonus_amount
    FROM days d
  ),
  BonusItems AS (
    SELECT 
      do.order_dt AS dt,
      COALESCE(SUM(oi.quantity), 0)::INT AS add_items
    FROM DailyOrders do
    JOIN DailyTargets dt ON dt.dt = do.order_dt
    JOIN public.order_items oi ON oi.order_id = do.order_id
    WHERE do.running_total >= dt.target_amount
    GROUP BY do.order_dt
  )
  SELECT 
    d.dt AS order_date,
    COALESCE(s.total_sales, 0)::NUMERIC AS daily_sales,
    dt.target_amount,
    dt.bonus_amount,
    (COALESCE(s.total_sales, 0) >= dt.target_amount) AS is_reached,
    COALESCE(b.add_items, 0) AS additional_items
  FROM days d
  JOIN DailyTargets dt ON dt.dt = d.dt
  LEFT JOIN DailySalesData s ON d.dt = s.dt
  LEFT JOIN BonusItems b ON d.dt = b.dt
  ORDER BY d.dt ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_bonus_breakdown(INT, INT, UUID) TO authenticated;
