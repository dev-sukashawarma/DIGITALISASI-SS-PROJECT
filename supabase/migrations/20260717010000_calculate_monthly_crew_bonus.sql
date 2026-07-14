-- 20260717010000_calculate_monthly_crew_bonus.sql
-- Migration script to calculate monthly crew bonus RPC

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
    COALESCE(SUM(CASE WHEN daily_target_eval.daily_sales >= daily_target_eval.target_amount THEN daily_target_eval.bonus_amount ELSE 0 END), 0)::NUMERIC
  INTO
    v_days_reached,
    v_total_bonus
  FROM (
    SELECT
      daily_sums.order_date,
      daily_sums.daily_sales,
      public.resolve_daily_target(p_outlet_id, daily_sums.order_date) AS target_amount,
      public.resolve_daily_bonus(p_outlet_id, daily_sums.order_date) AS bonus_amount
    FROM (
      SELECT
        (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date AS order_date,
        SUM(ord.total_amount) AS daily_sales
      FROM public.orders ord
      WHERE ord.outlet_id = p_outlet_id
        AND ord.status = 'completed'
        AND EXTRACT(MONTH FROM (ord.created_at AT TIME ZONE 'Asia/Jakarta')) = p_month
        AND EXTRACT(YEAR FROM (ord.created_at AT TIME ZONE 'Asia/Jakarta')) = p_year
      GROUP BY (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date
    ) daily_sums
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

-- Grant execute permission on this function to authenticated
GRANT EXECUTE ON FUNCTION public.calculate_monthly_crew_bonus(INT, INT, UUID) TO authenticated;
