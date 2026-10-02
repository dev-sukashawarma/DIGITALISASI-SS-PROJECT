-- 20261002131500_daily_pool_crew_bonus.sql
-- Restrukturisasi perhitungan bonus kru & leader: Berbasis Akumulasi Pool Harian Murni (Daily Pool Accumulation)
-- Setiap hari d di outlet o:
--   Pool Harian = Pcs terjual completed x Rp 100
--   Kru Hadir = Staf eligible (crew/leader) yang absen (clock-in / attendance_logs) di outlet o pada tanggal d
--   Bonus Harian per Kru = ROUND(Pool Harian / Kru Hadir)
-- Total bulanan seorang kru adalah penjumlahan bonus harian dari seluruh hari kerja yang ia jalani di cabang tsb.
-- Mendukung akun pengganti (akun_pengganti_id) dan kru backup (multi-outlet di hari yang sama).
-- Menambahkan RPC get_daily_outlet_bonus_detail dan get_crew_daily_bonus_detail untuk transparansi monitoring harian.

-- 1. Perbarui get_monthly_crew_bonus dengan akumulasi pool harian
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
    SELECT vo.id AS o_id, vo.name AS o_name
    FROM public.valid_operational_outlets vo
    WHERE (p_outlet_id IS NULL OR vo.id = p_outlet_id)
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
    -- Log clock-in fisik dari tabel attendance
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
    
    -- Log manual terverifikasi dari attendance_logs
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
    -- Fallback jika absensi outlet kosong di bulan tsb: hitung kru aktif terdaftar
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
  -- Kasus Normal: Outlet memiliki data absensi clock-in (> 0 hari hadir)
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

  -- Kasus Fallback: Outlet mencatat omset tapi data absensi belum/tidak tercatat (0 hari hadir)
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
    AND os.role IN ('crew', 'leader')
    AND os.status = 'active'
    AND os.is_bonus_eligible = true
    AND (os.sub_role IS NULL OR os.sub_role != 'crew_trainee')
    AND (os.onboarding_stage IS NULL OR os.onboarding_stage NOT IN ('training_7_days', 'ojt'))
    AND (os.account_category IS NULL OR os.account_category = 'employee')
    AND LOWER(os.name) NOT LIKE '%tes%'
    AND LOWER(os.name) NOT LIKE '%test%'
  LEFT JOIN MonthlyOutletSales mos ON mos.o_id = t.o_id
  LEFT JOIN FallbackCrewCounts fc ON fc.o_id = t.o_id
  LEFT JOIN OutletAttendanceSummary oas ON oas.o_id = t.o_id
  WHERE COALESCE(oas.total_attendance_days, 0) = 0
  
  ORDER BY outlet_name ASC, role DESC, crew_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_crew_bonus(INT, INT, UUID) TO anon, authenticated, service_role;


-- 2. RPC Baru: get_daily_outlet_bonus_detail (Rincian Harian per Outlet untuk Laporan & Monitoring)
CREATE OR REPLACE FUNCTION public.get_daily_outlet_bonus_detail(
  p_month INT,
  p_year INT,
  p_outlet_id UUID
)
RETURNS TABLE (
  bonus_date       DATE,
  day_name         TEXT,
  outlet_id        UUID,
  outlet_name      TEXT,
  total_pcs        BIGINT,
  pool_amount      NUMERIC,
  crew_count       BIGINT,
  bonus_per_crew   NUMERIC,
  crew_list        JSONB,
  status           TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_ts TIMESTAMPTZ;
  v_end_ts   TIMESTAMPTZ;
  v_out_name TEXT;
BEGIN
  v_start_ts := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Asia/Jakarta');
  v_end_ts := v_start_ts + INTERVAL '1 month';

  SELECT name INTO v_out_name FROM public.outlets WHERE id = p_outlet_id;

  RETURN QUERY
  WITH 
  MonthDays AS (
    SELECT generate_series(
      (v_start_ts AT TIME ZONE 'Asia/Jakarta')::date,
      ((v_end_ts - INTERVAL '1 day') AT TIME ZONE 'Asia/Jakarta')::date,
      '1 day'::interval
    )::date AS b_date
  ),
  DailySales AS (
    SELECT 
      (ord.created_at AT TIME ZONE 'Asia/Jakarta')::DATE AS sale_date,
      COALESCE(SUM(oi.quantity), 0)::BIGINT AS daily_pcs
    FROM public.orders ord
    JOIN public.order_items oi ON oi.order_id = ord.id
    WHERE ord.status = 'completed'
      AND ord.created_at >= v_start_ts
      AND ord.created_at < v_end_ts
      AND ord.outlet_id = p_outlet_id
    GROUP BY (ord.created_at AT TIME ZONE 'Asia/Jakarta')::DATE
  ),
  RawAttendance AS (
    SELECT 
      a.outlet_staff_id AS staff_id,
      (a.ts_server AT TIME ZONE 'Asia/Jakarta')::DATE AS att_date
    FROM public.attendance a
    WHERE a.type IN ('in', 'masuk')
      AND a.ts_server >= v_start_ts
      AND a.ts_server < v_end_ts
      AND (a.status IS NULL OR a.status IN ('tepat', 'telat', 'hadir', 'masuk', 'telat_toleransi'))
      AND a.outlet_id = p_outlet_id
    
    UNION
    
    SELECT 
      al.staff_id,
      al.date AS att_date
    FROM public.attendance_logs al
    WHERE al.status = 'hadir'
      AND al.date >= (v_start_ts AT TIME ZONE 'Asia/Jakarta')::DATE
      AND al.date < (v_end_ts AT TIME ZONE 'Asia/Jakarta')::DATE
      AND al.outlet_id = p_outlet_id
  ),
  EligibleCrewAttendance AS (
    SELECT 
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
    GROUP BY ra.att_date, 2, 3, 4, 5
  ),
  DailyCrewAgg AS (
    SELECT 
      eca.att_date,
      COUNT(DISTINCT eca.staff_id)::BIGINT AS crew_cnt,
      jsonb_agg(
        jsonb_build_object(
          'crew_id', eca.staff_id,
          'crew_name', eca.staff_name,
          'role', eca.staff_role,
          'sub_role', eca.staff_sub_role
        ) ORDER BY eca.staff_role DESC, eca.staff_name ASC
      ) AS crew_list
    FROM EligibleCrewAttendance eca
    GROUP BY eca.att_date
  )
  SELECT 
    md.b_date AS bonus_date,
    CASE EXTRACT(ISODOW FROM md.b_date)
      WHEN 1 THEN 'Senin'
      WHEN 2 THEN 'Selasa'
      WHEN 3 THEN 'Rabu'
      WHEN 4 THEN 'Kamis'
      WHEN 5 THEN 'Jumat'
      WHEN 6 THEN 'Sabtu'
      WHEN 7 THEN 'Minggu'
    END::TEXT AS day_name,
    p_outlet_id AS outlet_id,
    COALESCE(v_out_name, 'Outlet')::TEXT AS outlet_name,
    COALESCE(ds.daily_pcs, 0)::BIGINT AS total_pcs,
    (COALESCE(ds.daily_pcs, 0) * 100.0)::NUMERIC AS pool_amount,
    COALESCE(dca.crew_cnt, 0)::BIGINT AS crew_count,
    CASE 
      WHEN COALESCE(dca.crew_cnt, 0) > 0 THEN 
        ROUND((COALESCE(ds.daily_pcs, 0) * 100.0) / dca.crew_cnt, 0)::NUMERIC
      ELSE 0::NUMERIC 
    END AS bonus_per_crew,
    COALESCE(dca.crew_list, '[]'::jsonb) AS crew_list,
    CASE 
      WHEN COALESCE(ds.daily_pcs, 0) > 0 AND COALESCE(dca.crew_cnt, 0) = 0 THEN 'unassigned_pool'
      WHEN COALESCE(ds.daily_pcs, 0) = 0 AND COALESCE(dca.crew_cnt, 0) = 0 THEN 'no_sales'
      ELSE 'normal'
    END::TEXT AS status
  FROM MonthDays md
  LEFT JOIN DailySales ds ON ds.sale_date = md.b_date
  LEFT JOIN DailyCrewAgg dca ON dca.att_date = md.b_date
  ORDER BY md.b_date ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_outlet_bonus_detail(INT, INT, UUID) TO anon, authenticated, service_role;


-- 3. RPC Baru: get_crew_daily_bonus_detail (Rincian Harian Personal Kru untuk Modal Drill-Down)
CREATE OR REPLACE FUNCTION public.get_crew_daily_bonus_detail(
  p_month INT,
  p_year INT,
  p_crew_id UUID
)
RETURNS TABLE (
  bonus_date        DATE,
  day_name          TEXT,
  outlet_id         UUID,
  outlet_name       TEXT,
  daily_pcs         BIGINT,
  pool_amount       NUMERIC,
  crew_count_today  BIGINT,
  bonus_earned      NUMERIC
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
    
    UNION
    
    SELECT 
      al.staff_id,
      al.outlet_id AS o_id,
      al.date AS att_date
    FROM public.attendance_logs al
    WHERE al.status = 'hadir'
      AND al.date >= (v_start_ts AT TIME ZONE 'Asia/Jakarta')::DATE
      AND al.date < (v_end_ts AT TIME ZONE 'Asia/Jakarta')::DATE
  ),
  EligibleCrewAttendance AS (
    SELECT 
      ra.o_id,
      ra.att_date,
      COALESCE(pg.id, os.id) AS staff_id
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
    GROUP BY ra.o_id, ra.att_date, 3
  ),
  DailyCrewCount AS (
    SELECT 
      eca.o_id,
      eca.att_date,
      COUNT(DISTINCT eca.staff_id)::BIGINT AS crew_cnt_today
    FROM EligibleCrewAttendance eca
    GROUP BY eca.o_id, eca.att_date
  )
  SELECT 
    eca.att_date AS bonus_date,
    CASE EXTRACT(ISODOW FROM eca.att_date)
      WHEN 1 THEN 'Senin'
      WHEN 2 THEN 'Selasa'
      WHEN 3 THEN 'Rabu'
      WHEN 4 THEN 'Kamis'
      WHEN 5 THEN 'Jumat'
      WHEN 6 THEN 'Sabtu'
      WHEN 7 THEN 'Minggu'
    END::TEXT AS day_name,
    eca.o_id AS outlet_id,
    COALESCE(o.name, 'Outlet')::TEXT AS outlet_name,
    COALESCE(ds.daily_pcs, 0)::BIGINT AS daily_pcs,
    (COALESCE(ds.daily_pcs, 0) * 100.0)::NUMERIC AS pool_amount,
    COALESCE(dcc.crew_cnt_today, 1)::BIGINT AS crew_count_today,
    CASE 
      WHEN COALESCE(dcc.crew_cnt_today, 0) > 0 THEN 
        ROUND((COALESCE(ds.daily_pcs, 0) * 100.0) / dcc.crew_cnt_today, 0)::NUMERIC
      ELSE 0::NUMERIC 
    END AS bonus_earned
  FROM EligibleCrewAttendance eca
  JOIN public.outlets o ON o.id = eca.o_id
  JOIN DailyCrewCount dcc ON dcc.o_id = eca.o_id AND dcc.att_date = eca.att_date
  LEFT JOIN DailySales ds ON ds.o_id = eca.o_id AND ds.sale_date = eca.att_date
  WHERE eca.staff_id = p_crew_id
  ORDER BY eca.att_date ASC, outlet_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_crew_daily_bonus_detail(INT, INT, UUID) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
