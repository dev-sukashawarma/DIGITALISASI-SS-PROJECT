-- 20260930120000_bonus_kru_nonaktif_tetap_dapat_bagian.sql
-- Bonus kru (pool pcs x Rp 100, dibagi prorata hari hadir per outlet) dulu
-- hanya menghitung akun berstatus active. Kru yang dinonaktifkan di tengah
-- bulan kehilangan seluruh bagiannya, DAN hari kerjanya hilang dari penyebut
-- sehingga bagian itu terbagi ke kru lain yang tidak berhak.
-- Contoh Sep 2026: Hendriawan (12 hari Pamulang, 9 hari Beji) = Rp 0, sementara
-- Aditya & Alfin (3 & 4 hari) menyerap seluruh pool Pamulang.
-- Perbaikan: saringan status dicabut HANYA di cabang berbasis absensi.
-- Cabang fallback (outlet tanpa absensi) tetap hanya kru aktif terdaftar.
-- Satu-satunya perubahan terhadap definisi live (20260926131500) adalah baris
-- os.status = active di CTE EligibleCrewAttendance.

CREATE OR REPLACE FUNCTION public.get_monthly_crew_bonus(p_month integer, p_year integer, p_outlet_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(crew_id uuid, crew_name text, role text, sub_role text, outlet_id uuid, outlet_name text, total_pcs_outlet bigint, attendance_days bigint, total_attendance_days bigint, active_crew_count bigint, bonus_rate numeric, total_bonus numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND (a.status IS NULL OR a.status IN ('tepat', 'telat', 'hadir', 'masuk'))
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
      ra.staff_id,
      os.name::TEXT AS staff_name,
      os.role::TEXT AS staff_role,
      COALESCE(os.sub_role, 'crew_regular')::TEXT AS staff_sub_role,
      COUNT(DISTINCT ra.att_date)::BIGINT AS days_worked
    FROM RawAttendance ra
    JOIN public.outlet_staff os ON os.id = ra.staff_id
    WHERE os.role IN ('crew', 'leader')
      -- Status akun SENGAJA tidak disaring: kru yang dinonaktifkan di tengah
      -- bulan tetap berhak atas hari yang sudah ia kerjakan. Menyaringnya
      -- membuat bagiannya jatuh ke kru lain yang tak berhak (kasus Hendriawan,
      -- Sep 2026). Absensi di bulan itu sudah jadi bukti ia bekerja.
      AND os.is_bonus_eligible = true
      AND (os.sub_role IS NULL OR os.sub_role != 'crew_trainee')
      AND (os.onboarding_stage IS NULL OR os.onboarding_stage NOT IN ('training_7_days', 'ojt'))
      AND (os.account_category IS NULL OR os.account_category = 'employee')
      AND LOWER(os.name) NOT LIKE '%tes%'
      AND LOWER(os.name) NOT LIKE '%test%'
      AND LOWER(os.name) NOT LIKE '%developer%'
      AND LOWER(os.name) NOT LIKE '%devai%'
    GROUP BY ra.o_id, ra.staff_id, os.name, os.role, os.sub_role
  ),
  OutletAttendanceSummary AS (
    SELECT 
      eca.o_id,
      SUM(eca.days_worked)::BIGINT AS total_attendance_days,
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
    eca.staff_id AS crew_id,
    eca.staff_name AS crew_name,
    eca.staff_role AS role,
    eca.staff_sub_role AS sub_role,
    t.o_id AS outlet_id,
    t.o_name AS outlet_name,
    COALESCE(s.total_pcs, 0)::BIGINT AS total_pcs_outlet,
    eca.days_worked AS attendance_days,
    oas.total_attendance_days AS total_attendance_days,
    oas.active_crew_cnt AS active_crew_count,
    100.0::NUMERIC AS bonus_rate,
    ROUND( (COALESCE(s.total_pcs, 0) * 100.0 * eca.days_worked) / oas.total_attendance_days, 0 )::NUMERIC AS total_bonus
  FROM TargetOutlets t
  JOIN OutletAttendanceSummary oas ON oas.o_id = t.o_id AND oas.total_attendance_days > 0
  JOIN EligibleCrewAttendance eca ON eca.o_id = t.o_id
  LEFT JOIN MonthlyOutletSales s ON s.o_id = t.o_id

  UNION ALL

  -- Kasus Fallback: Outlet mencatat omset tapi data absensi belum/tidak tercatat (0 hari hadir)
  SELECT 
    os.id AS crew_id,
    os.name::TEXT AS crew_name,
    os.role::TEXT AS role,
    COALESCE(os.sub_role, 'crew_regular')::TEXT AS sub_role,
    t.o_id AS outlet_id,
    t.o_name AS outlet_name,
    COALESCE(s.total_pcs, 0)::BIGINT AS total_pcs_outlet,
    0::BIGINT AS attendance_days,
    0::BIGINT AS total_attendance_days,
    COALESCE(fc.reg_crew_cnt, 0)::BIGINT AS active_crew_count,
    100.0::NUMERIC AS bonus_rate,
    CASE 
      WHEN COALESCE(fc.reg_crew_cnt, 0) > 0 THEN ROUND(((COALESCE(s.total_pcs, 0) * 100.0) / fc.reg_crew_cnt), 0)::NUMERIC 
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
  LEFT JOIN MonthlyOutletSales s ON s.o_id = t.o_id
  LEFT JOIN FallbackCrewCounts fc ON fc.o_id = t.o_id
  LEFT JOIN OutletAttendanceSummary oas ON oas.o_id = t.o_id
  WHERE COALESCE(oas.total_attendance_days, 0) = 0
  
  ORDER BY outlet_name ASC, role DESC, crew_name ASC;
END;
$function$;
