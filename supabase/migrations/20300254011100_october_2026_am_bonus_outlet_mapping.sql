-- Migration: 20300254011100_october_2026_am_bonus_outlet_mapping.sql
-- Description: Mengunci pemetaan Outlet Binaan Area Manager (AM) khusus untuk periode Oktober 2026:
-- 1. Abu Bakar   : Empang, Paledang, Cicurug, Dramaga, Cimanggu (5 outlet)
-- 2. Tri Rizky   : Cileungsi, Cibubur, Sukmajaya (3 outlet)
-- 3. Muhtar      : Pajajaran, Cibinong, Ciseeng, Babakan Madang / Mitra Sentul (4 outlet)
-- 4. Chairul     : Pamulang, Beji, Sawangan DTC, Cireundeu, Ciledug (5 outlet)
-- 5. Mulyadi     : Jagakarsa, Kalisari, Pekayon, Jatiwaringin, Pondok Aren (5 outlet)

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
    -- Branch 1: Periode berjalan (selain Oktober 2026) membaca dari staff_outlets
    SELECT 
      so.staff_id AS s_id,
      so.outlet_id AS o_id,
      o.name AS o_name
    FROM public.staff_outlets so
    JOIN public.outlets o ON o.id = so.outlet_id
    WHERE NOT (p_month = 10 AND p_year = 2026)
      AND o.id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
      AND LOWER(o.name) NOT LIKE '%tes%'
      AND LOWER(o.name) NOT LIKE '%test%'
      AND LOWER(o.name) NOT LIKE '%trial%'
      AND LOWER(o.name) NOT LIKE '%demo%'
      AND LOWER(o.name) NOT LIKE '%backup%'
      AND (o.type IS NULL OR o.type != 'marketplace')
      AND LOWER(o.name) NOT LIKE '%kantor pusat%'
      AND LOWER(o.name) NOT LIKE '%gudang%'

    UNION ALL

    -- Branch 2: Pemetaan resmi Outlet Binaan AM Oktober 2026
    SELECT 
      oct_map.staff_id AS s_id,
      o.id AS o_id,
      o.name AS o_name
    FROM (
      -- AM : Abu Bakar (Empang, Paledang, Cicurug, Dramaga, Cimanggu)
      SELECT '2d4ae4e5-5f56-410b-928d-3e49f99d72d9'::UUID AS staff_id, unnest(ARRAY[
        '550e8400-e29b-41d4-a716-446655440002'::UUID, -- SUKA SHAWARMA EMPANG
        '550e8400-e29b-41d4-a716-446655440003'::UUID, -- MITRA PALEDANG
        'd9a2ef93-c298-4501-a471-1c5e2b3dff08'::UUID, -- MITRA CICURUG
        '550e8400-e29b-41d4-a716-446655440013'::UUID, -- SUKA SHAWARMA DRAMAGA
        '550e8400-e29b-41d4-a716-446655440004'::UUID  -- SUKA SHAWARMA CIMANGGU
      ]) AS outlet_id
      UNION ALL
      -- AM : Tri Rizky (Cileungsi, Cibubur, Sukmajaya)
      SELECT 'caf351f1-ea40-4fff-99ce-a4af71c59d47'::UUID AS staff_id, unnest(ARRAY[
        '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::UUID, -- MITRA CILEUNGSI
        '3f38c41d-11e3-49ce-a189-d7303e45f9ad'::UUID, -- MITRA CIBUBUR
        '550e8400-e29b-41d4-a716-446655440005'::UUID  -- SUKA SHAWARMA DEPOK SUKMAJAYA
      ]) AS outlet_id
      UNION ALL
      -- AM : Muhtar Arifin (Pajajaran, Cibinong, Ciseeng, Babakan Madang / Mitra Sentul)
      SELECT '78cd9a59-ac3f-4e25-8766-75dcfdcc373f'::UUID AS staff_id, unnest(ARRAY[
        '550e8400-e29b-41d4-a716-446655440009'::UUID, -- SUKA SHAWARMA PAJAJARAN
        '550e8400-e29b-41d4-a716-446655440014'::UUID, -- MITRA CIBINONG
        '550e8400-e29b-41d4-a716-446655440017'::UUID, -- MITRA CISEENG
        '43b7bbd1-1fd4-44b5-87ca-b07a271151af'::UUID  -- MITRA SENTUL (Babakan Madang)
      ]) AS outlet_id
      UNION ALL
      -- AM : Chairul Rizky (Pamulang, Beji, Sawangan DTC, Cireundeu, Ciledug)
      SELECT '065c463a-fcd3-4f14-b04e-7c104207eb6c'::UUID AS staff_id, unnest(ARRAY[
        'bba67dba-2dca-4e98-bdb2-6a9e265e288c'::UUID, -- MITRA PAMULANG
        '550e8400-e29b-41d4-a716-446655440007'::UUID, -- SUKA SHAWARMA BEJI
        '5a4df577-5237-476e-b54c-9eb642a5a516'::UUID, -- MITRA SAWANGAN DTC
        '550e8400-e29b-41d4-a716-446655440011'::UUID, -- SUKA SHAWARMA CIRENDEU
        '3d8cc715-3f2d-43c6-a7b0-1841d60de8f7'::UUID  -- MITRA CILEUDUG
      ]) AS outlet_id
      UNION ALL
      -- AM : Mulyadi (Jagakarsa, Kalisari, Pekayon, Jatiwaringin, Pondok Aren)
      SELECT 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f'::UUID AS staff_id, unnest(ARRAY[
        '550e8400-e29b-41d4-a716-446655440006'::UUID, -- SUKA SHAWARMA JAGAKARSA
        '550e8400-e29b-41d4-a716-446655440019'::UUID, -- MITRA KALISARI
        '550e8400-e29b-41d4-a716-446655440018'::UUID, -- MITRA PEKAYON
        '550e8400-e29b-41d4-a716-446655440010'::UUID, -- SUKA SHAWARMA JATIWARINGIN
        '48b980da-5a42-4a9b-a952-86ab5db6666a'::UUID  -- MITRA PONDOK AREN
      ]) AS outlet_id
    ) oct_map
    JOIN public.outlets o ON o.id = oct_map.outlet_id
    WHERE p_month = 10 AND p_year = 2026
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
NOTIFY pgrst, 'reload schema';
