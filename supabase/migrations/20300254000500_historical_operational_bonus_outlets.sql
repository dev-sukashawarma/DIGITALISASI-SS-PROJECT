-- 20300254000500_historical_operational_bonus_outlets.sql
-- Memastikan outlet yang beroperasi pada periode berjalan/lampau (memiliki completed orders dalam rentang waktu),
-- seperti MITRA PALEDANG pada September 2026, tetap dihitung bonus krunya, bonus AM, dan bonus RM-nya,
-- meskipun status outlet saat ini telah nonaktif (is_active = false).

-- 1. get_monthly_crew_bonus: Dukung outlet yang beroperasi selama periode target
CREATE OR REPLACE FUNCTION public.get_monthly_crew_bonus(
  p_month INT,
  p_year INT,
  p_outlet_id UUID DEFAULT NULL
)
RETURNS TABLE (
  crew_id               UUID,
  crew_name             TEXT,
  role                  TEXT,
  sub_role              TEXT,
  outlet_id             UUID,
  outlet_name           TEXT,
  total_pcs_outlet      BIGINT,
  attendance_days       BIGINT,
  total_attendance_days BIGINT,
  active_crew_count     BIGINT,
  bonus_rate            NUMERIC,
  total_bonus           NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_ts TIMESTAMPTZ;
  v_end_ts   TIMESTAMPTZ;
BEGIN
  v_start_ts := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Asia/Jakarta');
  v_end_ts := v_start_ts + INTERVAL '1 month';

  RETURN QUERY
  WITH 
  TargetOutlets AS (
    SELECT o.id AS o_id, o.name AS o_name
    FROM public.outlets o
    WHERE (p_outlet_id IS NULL OR o.id = p_outlet_id)
      AND o.id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
      AND LOWER(o.name) NOT LIKE '%tes%'
      AND LOWER(o.name) NOT LIKE '%test%'
      AND LOWER(o.name) NOT LIKE '%trial%'
      AND LOWER(o.name) NOT LIKE '%demo%'
      AND LOWER(o.name) NOT LIKE '%backup%'
      AND (o.type IS NULL OR o.type != 'marketplace')
      AND (
        (o.is_active = true AND COALESCE(o.status, 'active') = 'active')
        OR EXISTS (
          SELECT 1 FROM public.orders ord
          WHERE ord.outlet_id = o.id
            AND ord.status = 'completed'
            AND ord.created_at >= v_start_ts
            AND ord.created_at < v_end_ts
        )
      )
  ),
  DailySales AS (
    SELECT 
      ord.outlet_id AS o_id,
      (ord.created_at AT TIME ZONE 'Asia/Jakarta')::DATE AS sale_date,
      COALESCE(SUM(oi.quantity), 0)::BIGINT AS daily_pcs
    FROM public.orders ord
    JOIN public.order_items oi ON oi.order_id = ord.id
    WHERE ord.status = 'completed'
      AND ord.created_at >= v_start_ts
      AND ord.created_at < v_end_ts
      AND (p_outlet_id IS NULL OR ord.outlet_id = p_outlet_id)
    GROUP BY ord.outlet_id, (ord.created_at AT TIME ZONE 'Asia/Jakarta')::DATE
  ),
  RawAttendance AS (
    SELECT 
      a.outlet_staff_id AS staff_id,
      a.outlet_id AS o_id,
      (a.ts_server AT TIME ZONE 'Asia/Jakarta')::DATE AS att_date
    FROM public.attendance a
    WHERE a.type IN ('in', 'masuk')
      AND a.ts_server >= v_start_ts
      AND a.ts_server < v_end_ts
      AND (a.status IS NULL OR a.status IN ('tepat', 'telat', 'hadir', 'masuk', 'telat_toleransi'))
      AND (p_outlet_id IS NULL OR a.outlet_id = p_outlet_id)
    
    UNION
    
    SELECT 
      al.staff_id,
      al.outlet_id AS o_id,
      al.date AS att_date
    FROM public.attendance_logs al
    WHERE al.status = 'hadir'
      AND al.date >= (v_start_ts AT TIME ZONE 'Asia/Jakarta')::DATE
      AND al.date < (v_end_ts AT TIME ZONE 'Asia/Jakarta')::DATE
      AND (p_outlet_id IS NULL OR al.outlet_id = p_outlet_id)
  ),
  EligibleCrewAttendance AS (
    SELECT 
      ra.o_id,
      ra.att_date,
      COALESCE(pg.id, os.id) AS staff_id,
      COALESCE(pg.name, os.name)::TEXT AS staff_name,
      COALESCE(pg.role, os.role)::TEXT AS staff_role,
      COALESCE(pg.sub_role, os.sub_role, 'crew_regular')::TEXT AS staff_sub_role
    FROM RawAttendance ra
    JOIN public.outlet_staff os ON os.id = ra.staff_id
    LEFT JOIN public.outlet_staff pg ON pg.id = os.akun_pengganti_id
    WHERE os.role IN ('crew', 'leader')
      AND os.is_bonus_eligible = true
      AND (os.sub_role IS NULL OR os.sub_role != 'crew_trainee')
      AND (os.onboarding_stage IS NULL OR os.onboarding_stage NOT IN ('training_7_days', 'ojt'))
      AND (os.account_category IS NULL OR os.account_category = 'employee')
      AND LOWER(os.name) NOT LIKE '%tes%'
      AND LOWER(os.name) NOT LIKE '%test%'
      AND LOWER(os.name) NOT LIKE '%developer%'
      AND LOWER(os.name) NOT LIKE '%devai%'
    GROUP BY ra.o_id, ra.att_date, 3, 4, 5, 6
  ),
  DailyCrewCount AS (
    SELECT 
      eca.o_id,
      eca.att_date,
      COUNT(DISTINCT eca.staff_id)::BIGINT AS crew_cnt_today
    FROM EligibleCrewAttendance eca
    GROUP BY eca.o_id, eca.att_date
  ),
  DailyEarnings AS (
    SELECT 
      eca.o_id,
      eca.att_date,
      eca.staff_id,
      eca.staff_name,
      eca.staff_role,
      eca.staff_sub_role,
      COALESCE(ds.daily_pcs, 0)::BIGINT AS daily_pcs,
      dcc.crew_cnt_today,
      CASE 
        WHEN dcc.crew_cnt_today > 0 THEN 
          ROUND((COALESCE(ds.daily_pcs, 0) * 100.0) / dcc.crew_cnt_today, 0)::NUMERIC
        ELSE 0::NUMERIC 
      END AS daily_bonus
    FROM EligibleCrewAttendance eca
    JOIN DailyCrewCount dcc ON dcc.o_id = eca.o_id AND dcc.att_date = eca.att_date
    LEFT JOIN DailySales ds ON ds.o_id = eca.o_id AND ds.sale_date = eca.att_date
  ),
  MonthlyAggPerCrew AS (
    SELECT 
      de.o_id,
      de.staff_id,
      de.staff_name,
      de.staff_role,
      de.staff_sub_role,
      COUNT(DISTINCT de.att_date)::BIGINT AS attendance_days,
      COALESCE(SUM(de.daily_bonus), 0)::NUMERIC AS total_bonus
    FROM DailyEarnings de
    GROUP BY de.o_id, de.staff_id, de.staff_name, de.staff_role, de.staff_sub_role
  ),
  MonthlyOutletSales AS (
    SELECT 
      ds.o_id,
      SUM(ds.daily_pcs)::BIGINT AS total_pcs
    FROM DailySales ds
    GROUP BY ds.o_id
  ),
  OutletAttendanceSummary AS (
    SELECT 
      eca.o_id,
      COUNT(DISTINCT (eca.att_date || '-' || eca.staff_id::text))::BIGINT AS total_attendance_days,
      COUNT(DISTINCT eca.staff_id)::BIGINT AS active_crew_cnt
    FROM EligibleCrewAttendance eca
    GROUP BY eca.o_id
  ),
  FallbackCrewCounts AS (
    SELECT 
      os.outlet_id AS o_id,
      COUNT(os.id)::BIGINT AS reg_crew_cnt
    FROM public.outlet_staff os
    WHERE os.role IN ('crew', 'leader')
      AND os.status = 'active'
      AND os.is_bonus_eligible = true
      AND (os.sub_role IS NULL OR os.sub_role != 'crew_trainee')
      AND (os.onboarding_stage IS NULL OR os.onboarding_stage NOT IN ('training_7_days', 'ojt'))
      AND (os.account_category IS NULL OR os.account_category = 'employee')
      AND LOWER(os.name) NOT LIKE '%tes%'
      AND LOWER(os.name) NOT LIKE '%test%'
      AND (p_outlet_id IS NULL OR os.outlet_id = p_outlet_id)
    GROUP BY os.outlet_id
  )
  SELECT 
    mapc.staff_id AS crew_id,
    mapc.staff_name AS crew_name,
    mapc.staff_role AS role,
    mapc.staff_sub_role AS sub_role,
    t.o_id AS outlet_id,
    t.o_name AS outlet_name,
    COALESCE(mos.total_pcs, 0)::BIGINT AS total_pcs_outlet,
    mapc.attendance_days AS attendance_days,
    oas.total_attendance_days AS total_attendance_days,
    oas.active_crew_cnt AS active_crew_count,
    100.0::NUMERIC AS bonus_rate,
    mapc.total_bonus AS total_bonus
  FROM TargetOutlets t
  JOIN OutletAttendanceSummary oas ON oas.o_id = t.o_id AND oas.total_attendance_days > 0
  JOIN MonthlyAggPerCrew mapc ON mapc.o_id = t.o_id
  LEFT JOIN MonthlyOutletSales mos ON mos.o_id = t.o_id

  UNION ALL

  SELECT 
    os.id AS crew_id,
    os.name::TEXT AS crew_name,
    os.role::TEXT AS role,
    COALESCE(os.sub_role, 'crew_regular')::TEXT AS sub_role,
    t.o_id AS outlet_id,
    t.o_name AS outlet_name,
    COALESCE(mos.total_pcs, 0)::BIGINT AS total_pcs_outlet,
    0::BIGINT AS attendance_days,
    0::BIGINT AS total_attendance_days,
    COALESCE(fc.reg_crew_cnt, 0)::BIGINT AS active_crew_count,
    100.0::NUMERIC AS bonus_rate,
    CASE 
      WHEN COALESCE(fc.reg_crew_cnt, 0) > 0 THEN ROUND(((COALESCE(mos.total_pcs, 0) * 100.0) / fc.reg_crew_cnt), 0)::NUMERIC 
      ELSE 0::NUMERIC 
    END AS total_bonus
  FROM TargetOutlets t
  JOIN public.outlet_staff os ON os.outlet_id = t.o_id
  JOIN FallbackCrewCounts fc ON fc.o_id = t.o_id
  LEFT JOIN OutletAttendanceSummary oas ON oas.o_id = t.o_id
  LEFT JOIN MonthlyOutletSales mos ON mos.o_id = t.o_id
  WHERE (oas.total_attendance_days IS NULL OR oas.total_attendance_days = 0)
    AND os.role IN ('crew', 'leader')
    AND os.status = 'active'
    AND os.is_bonus_eligible = true
    AND (os.sub_role IS NULL OR os.sub_role != 'crew_trainee')
    AND (os.onboarding_stage IS NULL OR os.onboarding_stage NOT IN ('training_7_days', 'ojt'))
    AND (os.account_category IS NULL OR os.account_category = 'employee')
    AND LOWER(os.name) NOT LIKE '%tes%'
    AND LOWER(os.name) NOT LIKE '%test%'
    AND (p_outlet_id IS NULL OR os.outlet_id = p_outlet_id)

  ORDER BY outlet_name ASC, role DESC, crew_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_crew_bonus(INT, INT, UUID) TO anon, authenticated, service_role;


-- 2. get_monthly_rm_bonus: Masukkan seluruh order cabang operasional nyata
CREATE OR REPLACE FUNCTION public.get_monthly_rm_bonus(
  p_month INT,
  p_year INT
)
RETURNS TABLE (
  staff_id              UUID,
  staff_name            TEXT,
  role                  TEXT,
  scope_description     TEXT,
  total_pcs_global      BIGINT,
  bonus_rate            NUMERIC,
  total_bonus           NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_ts   TIMESTAMPTZ;
  v_end_ts     TIMESTAMPTZ;
  v_global_pcs BIGINT := 0;
BEGIN
  v_start_ts := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Asia/Jakarta');
  v_end_ts := v_start_ts + INTERVAL '1 month';

  SELECT COALESCE(SUM(oi.quantity), 0)::BIGINT INTO v_global_pcs
  FROM public.orders ord
  JOIN public.outlets o ON o.id = ord.outlet_id
  JOIN public.order_items oi ON oi.order_id = ord.id
  WHERE ord.status = 'completed'
    AND ord.created_at >= v_start_ts
    AND ord.created_at < v_end_ts
    AND o.id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
    AND LOWER(o.name) NOT LIKE '%tes%'
    AND LOWER(o.name) NOT LIKE '%test%'
    AND LOWER(o.name) NOT LIKE '%trial%'
    AND LOWER(o.name) NOT LIKE '%demo%'
    AND LOWER(o.name) NOT LIKE '%backup%'
    AND (o.type IS NULL OR o.type != 'marketplace');

  RETURN QUERY
  SELECT 
    os.id AS staff_id,
    os.name::TEXT AS staff_name,
    os.role::TEXT AS role,
    'Semua Cabang Operasional'::TEXT AS scope_description,
    v_global_pcs AS total_pcs_global,
    50.0::NUMERIC AS bonus_rate,
    (v_global_pcs * 50.0)::NUMERIC AS total_bonus
  FROM public.outlet_staff os
  WHERE os.role = 'regional_manager'
    AND os.status = 'active'
    AND os.is_bonus_eligible = true
  ORDER BY os.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_rm_bonus(INT, INT) TO anon, authenticated, service_role;


-- 3. get_monthly_am_bonus: Masukkan seluruh order cabang operasional nyata binaan AM
CREATE OR REPLACE FUNCTION public.get_monthly_am_bonus(
  p_month INT,
  p_year INT
)
RETURNS TABLE (
  staff_id              UUID,
  staff_name            TEXT,
  role                  TEXT,
  managed_outlet_count  BIGINT,
  managed_outlet_names  TEXT[],
  total_pcs             BIGINT,
  bonus_rate            NUMERIC,
  total_bonus           NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_ts TIMESTAMPTZ;
  v_end_ts   TIMESTAMPTZ;
BEGIN
  v_start_ts := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Asia/Jakarta');
  v_end_ts := v_start_ts + INTERVAL '1 month';

  RETURN QUERY
  WITH 
  ActiveAM AS (
    SELECT os.id AS s_id, os.name AS s_name, os.role AS s_role
    FROM public.outlet_staff os
    WHERE os.role = 'area_manager'
      AND os.status = 'active'
      AND os.is_bonus_eligible = true
  ),
  AMOutlets AS (
    SELECT 
      so.staff_id AS s_id,
      so.outlet_id AS o_id,
      o.name AS o_name
    FROM public.staff_outlets so
    JOIN public.outlets o ON o.id = so.outlet_id
    WHERE o.id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
      AND LOWER(o.name) NOT LIKE '%tes%'
      AND LOWER(o.name) NOT LIKE '%test%'
      AND LOWER(o.name) NOT LIKE '%trial%'
      AND LOWER(o.name) NOT LIKE '%demo%'
      AND LOWER(o.name) NOT LIKE '%backup%'
      AND (o.type IS NULL OR o.type != 'marketplace')
      AND LOWER(o.name) NOT LIKE '%kantor pusat%'
      AND LOWER(o.name) NOT LIKE '%gudang%'
  ),
  MonthlyOutletSales AS (
    SELECT 
      ord.outlet_id AS o_id,
      COALESCE(SUM(oi.quantity), 0)::BIGINT AS total_pcs
    FROM public.orders ord
    JOIN public.outlets o ON o.id = ord.outlet_id
    JOIN public.order_items oi ON oi.order_id = ord.id
    WHERE ord.status = 'completed'
      AND ord.created_at >= v_start_ts
      AND ord.created_at < v_end_ts
      AND o.id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
      AND LOWER(o.name) NOT LIKE '%tes%'
      AND LOWER(o.name) NOT LIKE '%test%'
      AND LOWER(o.name) NOT LIKE '%backup%'
      AND (o.type IS NULL OR o.type != 'marketplace')
    GROUP BY ord.outlet_id
  ),
  AMSummary AS (
    SELECT 
      a.s_id,
      COUNT(DISTINCT amo.o_id)::BIGINT AS outlet_cnt,
      COALESCE(ARRAY_AGG(DISTINCT amo.o_name) FILTER (WHERE amo.o_name IS NOT NULL), ARRAY[]::TEXT[]) AS outlet_names,
      COALESCE(SUM(mos.total_pcs), 0)::BIGINT AS am_total_pcs
    FROM ActiveAM a
    LEFT JOIN AMOutlets amo ON amo.s_id = a.s_id
    LEFT JOIN MonthlyOutletSales mos ON mos.o_id = amo.o_id
    GROUP BY a.s_id
  )
  SELECT 
    a.s_id AS staff_id,
    a.s_name::TEXT AS staff_name,
    a.s_role::TEXT AS role,
    s.outlet_cnt AS managed_outlet_count,
    s.outlet_names AS managed_outlet_names,
    s.am_total_pcs AS total_pcs,
    50.0::NUMERIC AS bonus_rate,
    (s.am_total_pcs * 50.0)::NUMERIC AS total_bonus
  FROM ActiveAM a
  JOIN AMSummary s ON s.s_id = a.s_id
  ORDER BY a.s_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_am_bonus(INT, INT) TO anon, authenticated, service_role;
