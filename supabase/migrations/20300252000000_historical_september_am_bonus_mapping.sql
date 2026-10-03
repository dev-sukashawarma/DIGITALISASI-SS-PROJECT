-- Migration: 20300252000000_historical_september_am_bonus_mapping.sql
-- Description: Menjaga akurasi historis pemetaan outlet Area Manager untuk bulan September 2026.
-- Pada 1 Oktober 2026 terjadi pergeseran binaan outlet:
-- Sukmajaya dialihkan ke Tri Rizky dan Jagakarsa dialihkan ke Mulyadi.
-- Untuk periode September 2026:
-- Chairul Rizky membina 6 outlet: Sukmajaya, Jagakarsa, Mitra Pamulang, Mitra Sawangan DTC, Cireundeu, Beji.

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
    -- Normal branch untuk bulan di luar September 2026 (mengikuti staff_outlets berjalan)
    SELECT 
      a.s_id,
      vo.id AS o_id,
      vo.name AS o_name
    FROM ActiveAM a
    JOIN public.staff_outlets so ON so.staff_id = a.s_id
    JOIN public.valid_operational_outlets vo ON vo.id = so.outlet_id
    WHERE NOT (p_month = 9 AND p_year = 2026)

    UNION ALL

    -- Historis September 2026:
    -- Chairul Rizky memegang: Sukmajaya, Jagakarsa, Mitra Pamulang, Mitra Sawangan DTC, Cireundeu, Beji
    SELECT 
      a.s_id,
      vo.id AS o_id,
      vo.name AS o_name
    FROM ActiveAM a
    JOIN (
      -- Chairul Rizky Sept 2026
      SELECT '065c463a-fcd3-4f14-b04e-7c104207eb6c'::UUID AS staff_id, unnest(ARRAY[
        '550e8400-e29b-41d4-a716-446655440005'::UUID, -- SUKMAJAYA
        '550e8400-e29b-41d4-a716-446655440006'::UUID, -- JAGAKARSA
        'bba67dba-2dca-4e98-bdb2-6a9e265e288c'::UUID, -- MITRA PAMULANG
        '5a4df577-5237-476e-b54c-9eb642a5a516'::UUID, -- MITRA SAWANGAN DTC
        '550e8400-e29b-41d4-a716-446655440011'::UUID, -- CIRENDEU
        '550e8400-e29b-41d4-a716-446655440007'::UUID  -- BEJI
      ]) AS outlet_id
      UNION ALL
      -- Tri Rizky Sept 2026 (tanpa Sukmajaya karena dipegang Chairul)
      SELECT so.staff_id, so.outlet_id
      FROM public.staff_outlets so
      WHERE so.staff_id = 'caf351f1-ea40-4fff-99ce-a4af71c59d47'
        AND so.outlet_id != '550e8400-e29b-41d4-a716-446655440005'
      UNION ALL
      -- Mulyadi Sept 2026 (tanpa Jagakarsa karena dipegang Chairul)
      SELECT so.staff_id, so.outlet_id
      FROM public.staff_outlets so
      WHERE so.staff_id = 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f'
        AND so.outlet_id != '550e8400-e29b-41d4-a716-446655440006'
      UNION ALL
      -- AM lainnya Sept 2026 (Abu Bakar & Muhtar Arifin sesuai staff_outlets)
      SELECT so.staff_id, so.outlet_id
      FROM public.staff_outlets so
      WHERE so.staff_id NOT IN (
        '065c463a-fcd3-4f14-b04e-7c104207eb6c',
        'caf351f1-ea40-4fff-99ce-a4af71c59d47',
        'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f'
      )
    ) so ON so.staff_id = a.s_id
    JOIN public.valid_operational_outlets vo ON vo.id = so.outlet_id
    WHERE p_month = 9 AND p_year = 2026
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
