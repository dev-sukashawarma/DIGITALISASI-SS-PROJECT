-- 20260826153000_new_pcs_based_bonus_system.sql
-- Restrukturisasi sistem perhitungan bonus operasional berbasis jumlah porsi/pcs terjual (RM, AM, Crew)

-- 1. Tambahkan flag is_bonus_eligible pada outlet_staff (default true)
ALTER TABLE public.outlet_staff 
ADD COLUMN IF NOT EXISTS is_bonus_eligible BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_outlet_staff_bonus_eligible 
ON public.outlet_staff(outlet_id, role, status, is_bonus_eligible);

-- 2. Helper view filter outlet non-test & non-marketplace
CREATE OR REPLACE VIEW public.valid_operational_outlets AS
SELECT o.id, o.name, o.slug, o.type
FROM public.outlets o
WHERE o.id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
  AND LOWER(o.name) NOT LIKE '%tes%'
  AND LOWER(o.name) NOT LIKE '%test%'
  AND LOWER(o.name) NOT LIKE '%trial%'
  AND LOWER(o.name) NOT LIKE '%demo%'
  AND (o.type IS NULL OR o.type != 'marketplace');

GRANT SELECT ON public.valid_operational_outlets TO anon, authenticated, service_role;


-- 3. RPC: get_monthly_crew_bonus
-- Rumus: (Total Pcs Terjual di Outlet x Rp 100) / Jumlah Kru Aktif Eligible
CREATE OR REPLACE FUNCTION public.get_monthly_crew_bonus(
  p_month INT,
  p_year INT,
  p_outlet_id UUID DEFAULT NULL
)
RETURNS TABLE (
  crew_id            UUID,
  crew_name          TEXT,
  role               TEXT,
  outlet_id          UUID,
  outlet_name        TEXT,
  total_pcs_outlet   BIGINT,
  active_crew_count  BIGINT,
  bonus_rate         NUMERIC,
  total_bonus        NUMERIC
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
    SELECT vo.id AS o_id, vo.name AS o_name
    FROM public.valid_operational_outlets vo
    WHERE (p_outlet_id IS NULL OR vo.id = p_outlet_id)
  ),
  MonthlyOutletSales AS (
    SELECT 
      ord.outlet_id AS o_id,
      COALESCE(SUM(oi.quantity), 0)::BIGINT AS total_pcs
    FROM public.orders ord
    JOIN public.order_items oi ON oi.order_id = ord.id
    WHERE ord.status = 'completed'
      AND ord.created_at >= v_start_ts
      AND ord.created_at < v_end_ts
      AND (p_outlet_id IS NULL OR ord.outlet_id = p_outlet_id)
    GROUP BY ord.outlet_id
  ),
  CrewCounts AS (
    SELECT 
      os.outlet_id AS o_id,
      COUNT(os.id)::BIGINT AS crew_cnt
    FROM public.outlet_staff os
    WHERE os.role IN ('crew', 'leader')
      AND os.status = 'active'
      AND os.is_bonus_eligible = true
      AND (p_outlet_id IS NULL OR os.outlet_id = p_outlet_id)
    GROUP BY os.outlet_id
  )
  SELECT 
    os.id AS crew_id,
    os.name::TEXT AS crew_name,
    os.role::TEXT AS role,
    t.o_id AS outlet_id,
    t.o_name::TEXT AS outlet_name,
    COALESCE(s.total_pcs, 0)::BIGINT AS total_pcs_outlet,
    COALESCE(c.crew_cnt, 0)::BIGINT AS active_crew_count,
    100.0::NUMERIC AS bonus_rate,
    CASE 
      WHEN COALESCE(c.crew_cnt, 0) > 0 THEN ROUND(((COALESCE(s.total_pcs, 0) * 100.0) / c.crew_cnt), 0)::NUMERIC 
      ELSE 0::NUMERIC 
    END AS total_bonus
  FROM TargetOutlets t
  JOIN public.outlet_staff os ON os.outlet_id = t.o_id 
    AND os.role IN ('crew', 'leader') 
    AND os.status = 'active' 
    AND os.is_bonus_eligible = true
  LEFT JOIN MonthlyOutletSales s ON s.o_id = t.o_id
  LEFT JOIN CrewCounts c ON c.o_id = t.o_id
  ORDER BY t.o_name ASC, os.role DESC, os.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_crew_bonus(INT, INT, UUID) TO anon, authenticated, service_role;


-- 4. RPC: get_monthly_am_bonus
-- Rumus: Total Pcs Terjual di Cabang Binaan x Rp 50
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
      a.s_id,
      vo.id AS o_id,
      vo.name AS o_name
    FROM ActiveAM a
    JOIN public.staff_outlets so ON so.staff_id = a.s_id
    JOIN public.valid_operational_outlets vo ON vo.id = so.outlet_id
  ),
  MonthlyOutletSales AS (
    SELECT 
      ord.outlet_id AS o_id,
      COALESCE(SUM(oi.quantity), 0)::BIGINT AS total_pcs
    FROM public.orders ord
    JOIN public.order_items oi ON oi.order_id = ord.id
    WHERE ord.status = 'completed'
      AND ord.created_at >= v_start_ts
      AND ord.created_at < v_end_ts
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


-- 5. RPC: get_monthly_rm_bonus
-- Rumus: Total Pcs Terjual di SELURUH Cabang Operasional x Rp 50 (Flat per orang RM)
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
  JOIN public.valid_operational_outlets vo ON vo.id = ord.outlet_id
  JOIN public.order_items oi ON oi.order_id = ord.id
  WHERE ord.status = 'completed'
    AND ord.created_at >= v_start_ts
    AND ord.created_at < v_end_ts;

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


-- 6. RPC: get_monthly_bonus_summary
CREATE OR REPLACE FUNCTION public.get_monthly_bonus_summary(
  p_month INT,
  p_year INT
)
RETURNS TABLE (
  total_pcs_global    BIGINT,
  total_crew_bonus    NUMERIC,
  total_am_bonus      NUMERIC,
  total_rm_bonus      NUMERIC,
  grand_total_bonus   NUMERIC,
  active_crew_count   BIGINT,
  active_am_count     BIGINT,
  active_rm_count     BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_ts   TIMESTAMPTZ;
  v_end_ts     TIMESTAMPTZ;
  v_global_pcs BIGINT := 0;
  v_crew_bonus NUMERIC := 0;
  v_am_bonus   NUMERIC := 0;
  v_rm_bonus   NUMERIC := 0;
  v_crew_cnt   BIGINT := 0;
  v_am_cnt     BIGINT := 0;
  v_rm_cnt     BIGINT := 0;
BEGIN
  v_start_ts := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Asia/Jakarta');
  v_end_ts := v_start_ts + INTERVAL '1 month';

  -- Global Pcs
  SELECT COALESCE(SUM(oi.quantity), 0)::BIGINT INTO v_global_pcs
  FROM public.orders ord
  JOIN public.valid_operational_outlets vo ON vo.id = ord.outlet_id
  JOIN public.order_items oi ON oi.order_id = ord.id
  WHERE ord.status = 'completed'
    AND ord.created_at >= v_start_ts
    AND ord.created_at < v_end_ts;

  -- Crew Bonus & Crew Count
  SELECT 
    COALESCE(SUM(c.total_bonus), 0)::NUMERIC,
    COUNT(c.crew_id)::BIGINT
  INTO v_crew_bonus, v_crew_cnt
  FROM public.get_monthly_crew_bonus(p_month, p_year, NULL) c;

  -- AM Bonus & AM Count
  SELECT 
    COALESCE(SUM(a.total_bonus), 0)::NUMERIC,
    COUNT(a.staff_id)::BIGINT
  INTO v_am_bonus, v_am_cnt
  FROM public.get_monthly_am_bonus(p_month, p_year) a;

  -- RM Bonus & RM Count
  SELECT 
    COALESCE(SUM(r.total_bonus), 0)::NUMERIC,
    COUNT(r.staff_id)::BIGINT
  INTO v_rm_bonus, v_rm_cnt
  FROM public.get_monthly_rm_bonus(p_month, p_year) r;

  RETURN QUERY
  SELECT 
    v_global_pcs,
    v_crew_bonus,
    v_am_bonus,
    v_rm_bonus,
    (v_crew_bonus + v_am_bonus + v_rm_bonus)::NUMERIC,
    v_crew_cnt,
    v_am_cnt,
    v_rm_cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_bonus_summary(INT, INT) TO anon, authenticated, service_role;


-- 7. Update calculate_monthly_crew_bonus to maintain backwards compatibility
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
BEGIN
  RETURN QUERY
  SELECT 
    c.crew_name,
    c.role,
    c.outlet_name,
    0::INT AS days_target_reached,
    c.total_bonus AS total_bonus_received
  FROM public.get_monthly_crew_bonus(p_month, p_year, p_outlet_id) c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_monthly_crew_bonus(INT, INT, UUID) TO anon, authenticated, service_role;
