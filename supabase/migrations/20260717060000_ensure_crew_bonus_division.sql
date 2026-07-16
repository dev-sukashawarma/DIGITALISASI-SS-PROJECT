-- 20260717060000_ensure_crew_bonus_division.sql
-- Ensure that calculate_monthly_crew_bonus correctly divides by the crew count for the outlet

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
  -- 1. Authorization Check
  IF NOT public.is_owner_or_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.outlet_staff os
      WHERE os.id = auth.uid() AND os.outlet_id = p_outlet_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- 2. Fetch outlet name
  SELECT o.name INTO v_outlet_name FROM public.outlets o WHERE o.id = p_outlet_id;
  IF v_outlet_name IS NULL THEN
    RAISE EXCEPTION 'Outlet not found';
  END IF;

  -- 3. Count active crew members (strictly role = 'crew')
  SELECT COUNT(*)::INT INTO v_crew_count
  FROM public.outlet_staff os
  WHERE os.outlet_id = p_outlet_id
    AND os.role = 'crew'
    AND os.status = 'active';

  -- 4. Calculate total accumulated bonus for the entire outlet
  SELECT
    days_reached,
    total_bonus
  INTO
    v_days_reached,
    v_total_bonus
  FROM (
      WITH 
      DailyOrders AS (
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
          public.resolve_per_item_bonus(p_outlet_id, order_date) AS per_item_bonus
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
      ),
      daily_target_eval AS (
        SELECT
          d.order_date,
          SUM(d.total_amount) AS daily_sales,
          dt.target_amount,
          dt.per_item_bonus,
          COALESCE(b.additional_items, 0) AS additional_items
        FROM DailyOrders d
        JOIN DailyTargets dt ON dt.order_date = d.order_date
        LEFT JOIN BonusItems b ON b.order_date = d.order_date
        GROUP BY d.order_date, dt.target_amount, dt.per_item_bonus, b.additional_items
      )
      SELECT
        COALESCE(SUM(CASE WHEN daily_sales >= target_amount THEN 1 ELSE 0 END), 0)::INT as days_reached,
        COALESCE(SUM(CASE WHEN daily_sales >= target_amount 
                     THEN (additional_items * per_item_bonus) 
                     ELSE 0 END), 0)::NUMERIC as total_bonus
      FROM daily_target_eval
  ) daily_target_eval;

  -- 5. Divide by the exact number of active crew members
  IF v_crew_count > 0 THEN
    v_bonus_per_crew := v_total_bonus / v_crew_count;
  ELSE
    v_bonus_per_crew := 0;
  END IF;

  -- 6. Return ONLY the active crew members
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
