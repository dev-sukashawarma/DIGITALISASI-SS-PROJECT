-- Migration: 20300254011500_am_outlet_assignments_and_rotation.sql
-- Description:
-- 1. Membuat tabel `am_outlet_assignments` untuk menyimpan riwayat penugasan outlet binaan
--    Area Manager berdasarkan rentang tanggal efektif (effective_from s/d effective_to).
-- 2. Membuat tabel `am_outlet_rotations` sebagai log audit perpindahan binaan AM.
-- 3. Mengisi data historis (seed):
--    - Periode s/d 30 September 2026 (Formasi September 2026)
--    - Periode 1 Oktober 2026 s/d 31 Oktober 2026 (Formasi Oktober 2026)
--    - Periode mulai 1 November 2026 s/d sekarang (mengikuti staff_outlets aktif saat ini)
-- 4. Memperbarui RPC `get_monthly_am_bonus(p_month, p_year)` agar menghitung bonus penjualan AM
--    secara presisi per tanggal transaksi (prorata hari / potong tengah bulan bila ada rotasi).

-- 1. Tabel Penugasan Periode Outlet Binaan AM
CREATE TABLE IF NOT EXISTS public.am_outlet_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE, -- NULL berarti masih aktif sampai sekarang
  reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_am_assignment_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_am_outlet_assignments_staff ON public.am_outlet_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_am_outlet_assignments_outlet ON public.am_outlet_assignments(outlet_id);
CREATE INDEX IF NOT EXISTS idx_am_outlet_assignments_dates ON public.am_outlet_assignments(effective_from, effective_to);

-- Hanya boleh ada 1 AM aktif (effective_to IS NULL) untuk 1 outlet pada saat yang sama
CREATE UNIQUE INDEX IF NOT EXISTS uq_am_outlet_active_assignment
  ON public.am_outlet_assignments(outlet_id)
  WHERE effective_to IS NULL;

ALTER TABLE public.am_outlet_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read am_outlet_assignments" ON public.am_outlet_assignments;
CREATE POLICY "Allow authenticated read am_outlet_assignments"
  ON public.am_outlet_assignments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin write am_outlet_assignments" ON public.am_outlet_assignments;
CREATE POLICY "Allow admin write am_outlet_assignments"
  ON public.am_outlet_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role IN ('admin', 'owner', 'admin_hr', 'developer')
    )
  );

-- 2. Tabel Log Riwayat Pergeseran / Rotasi Binaan AM
CREATE TABLE IF NOT EXISTS public.am_outlet_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  from_staff_id UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  to_staff_id UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  notes TEXT,
  actor_id UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_am_outlet_rotations_outlet ON public.am_outlet_rotations(outlet_id);
CREATE INDEX IF NOT EXISTS idx_am_outlet_rotations_from_staff ON public.am_outlet_rotations(from_staff_id);
CREATE INDEX IF NOT EXISTS idx_am_outlet_rotations_to_staff ON public.am_outlet_rotations(to_staff_id);
CREATE INDEX IF NOT EXISTS idx_am_outlet_rotations_effective_date ON public.am_outlet_rotations(effective_date DESC);

ALTER TABLE public.am_outlet_rotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read am_outlet_rotations" ON public.am_outlet_rotations;
CREATE POLICY "Allow authenticated read am_outlet_rotations"
  ON public.am_outlet_rotations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin write am_outlet_rotations" ON public.am_outlet_rotations;
CREATE POLICY "Allow admin write am_outlet_rotations"
  ON public.am_outlet_rotations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role IN ('admin', 'owner', 'admin_hr', 'developer')
    )
  );

-- 3. Seed Data Historis (Idempotent: hanya diisi jika tabel masih kosong)
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.am_outlet_assignments;
  IF v_count = 0 THEN
    -- =========================================================================
    -- A. PERIODE SEPTEMBER 2026 (2026-01-01 s/d 2026-09-30)
    -- =========================================================================
    -- 1. Abu Bakar (Empang, Paledang, Cicurug, Dramaga, Cimanggu)
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
    SELECT '2d4ae4e5-5f56-410b-928d-3e49f99d72d9'::UUID, unnest(ARRAY[
      '550e8400-e29b-41d4-a716-446655440002'::UUID, -- EMPANG
      '550e8400-e29b-41d4-a716-446655440003'::UUID, -- PALEDANG
      'd9a2ef93-c298-4501-a471-1c5e2b3dff08'::UUID, -- CICURUG
      '550e8400-e29b-41d4-a716-446655440013'::UUID, -- DRAMAGA
      '550e8400-e29b-41d4-a716-446655440004'::UUID  -- CIMANGGU
    ]), DATE '2026-01-01', DATE '2026-09-30', 'Formasi Historis September 2026';

    -- 2. Tri Rizky (Cileungsi, Cibubur)
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
    SELECT 'caf351f1-ea40-4fff-99ce-a4af71c59d47'::UUID, unnest(ARRAY[
      '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::UUID, -- CILEUNGSI
      '3f38c41d-11e3-49ce-a189-d7303e45f9ad'::UUID  -- CIBUBUR
    ]), DATE '2026-01-01', DATE '2026-09-30', 'Formasi Historis September 2026';

    -- 3. Muhtar Arifin (Pajajaran, Cibinong, Ciseeng, Mitra Sentul)
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
    SELECT '78cd9a59-ac3f-4e25-8766-75dcfdcc373f'::UUID, unnest(ARRAY[
      '550e8400-e29b-41d4-a716-446655440009'::UUID, -- PAJAJARAN
      '550e8400-e29b-41d4-a716-446655440014'::UUID, -- CIBINONG
      '550e8400-e29b-41d4-a716-446655440017'::UUID, -- CISEENG
      '43b7bbd1-1fd4-44b5-87ca-b07a271151af'::UUID  -- MITRA SENTUL
    ]), DATE '2026-01-01', DATE '2026-09-30', 'Formasi Historis September 2026';

    -- 4. Chairul Rizky (Sukmajaya, Jagakarsa, Pamulang, Sawangan DTC, Cireundeu, Beji)
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
    SELECT '065c463a-fcd3-4f14-b04e-7c104207eb6c'::UUID, unnest(ARRAY[
      '550e8400-e29b-41d4-a716-446655440005'::UUID, -- SUKMAJAYA
      '550e8400-e29b-41d4-a716-446655440006'::UUID, -- JAGAKARSA
      'bba67dba-2dca-4e98-bdb2-6a9e265e288c'::UUID, -- PAMULANG
      '5a4df577-5237-476e-b54c-9eb642a5a516'::UUID, -- SAWANGAN DTC
      '550e8400-e29b-41d4-a716-446655440011'::UUID, -- CIRENDEU
      '550e8400-e29b-41d4-a716-446655440007'::UUID  -- BEJI
    ]), DATE '2026-01-01', DATE '2026-09-30', 'Formasi Historis September 2026';

    -- 5. Mulyadi (Kalisari, Pekayon, Jatiwaringin, Pondok Aren)
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
    SELECT 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f'::UUID, unnest(ARRAY[
      '550e8400-e29b-41d4-a716-446655440019'::UUID, -- KALISARI
      '550e8400-e29b-41d4-a716-446655440018'::UUID, -- PEKAYON
      '550e8400-e29b-41d4-a716-446655440010'::UUID, -- JATIWARINGIN
      '48b980da-5a42-4a9b-a952-86ab5db6666a'::UUID  -- PONDOK AREN
    ]), DATE '2026-01-01', DATE '2026-09-30', 'Formasi Historis September 2026';

    -- =========================================================================
    -- B. PERIODE OKTOBER 2026 (2026-10-01 s/d 2026-10-31)
    -- =========================================================================
    -- 1. Abu Bakar (Empang, Paledang, Cicurug, Dramaga, Cimanggu)
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
    SELECT '2d4ae4e5-5f56-410b-928d-3e49f99d72d9'::UUID, unnest(ARRAY[
      '550e8400-e29b-41d4-a716-446655440002'::UUID,
      '550e8400-e29b-41d4-a716-446655440003'::UUID,
      'd9a2ef93-c298-4501-a471-1c5e2b3dff08'::UUID,
      '550e8400-e29b-41d4-a716-446655440013'::UUID,
      '550e8400-e29b-41d4-a716-446655440004'::UUID
    ]), DATE '2026-10-01', DATE '2026-10-31', 'Formasi Oktober 2026';

    -- 2. Tri Rizky (Cileungsi, Cibubur, Sukmajaya)
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
    SELECT 'caf351f1-ea40-4fff-99ce-a4af71c59d47'::UUID, unnest(ARRAY[
      '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::UUID,
      '3f38c41d-11e3-49ce-a189-d7303e45f9ad'::UUID,
      '550e8400-e29b-41d4-a716-446655440005'::UUID
    ]), DATE '2026-10-01', DATE '2026-10-31', 'Formasi Oktober 2026';

    -- 3. Muhtar Arifin (Pajajaran, Cibinong, Ciseeng, Mitra Sentul)
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
    SELECT '78cd9a59-ac3f-4e25-8766-75dcfdcc373f'::UUID, unnest(ARRAY[
      '550e8400-e29b-41d4-a716-446655440009'::UUID,
      '550e8400-e29b-41d4-a716-446655440014'::UUID,
      '550e8400-e29b-41d4-a716-446655440017'::UUID,
      '43b7bbd1-1fd4-44b5-87ca-b07a271151af'::UUID
    ]), DATE '2026-10-01', DATE '2026-10-31', 'Formasi Oktober 2026';

    -- 4. Chairul Rizky (Pamulang, Beji, Sawangan DTC, Cireundeu, Ciledug)
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
    SELECT '065c463a-fcd3-4f14-b04e-7c104207eb6c'::UUID, unnest(ARRAY[
      'bba67dba-2dca-4e98-bdb2-6a9e265e288c'::UUID,
      '550e8400-e29b-41d4-a716-446655440007'::UUID,
      '5a4df577-5237-476e-b54c-9eb642a5a516'::UUID,
      '550e8400-e29b-41d4-a716-446655440011'::UUID,
      '3d8cc715-3f2d-43c6-a7b0-1841d60de8f7'::UUID
    ]), DATE '2026-10-01', DATE '2026-10-31', 'Formasi Oktober 2026';

    -- 5. Mulyadi (Jagakarsa, Kalisari, Pekayon, Jatiwaringin, Pondok Aren)
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
    SELECT 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f'::UUID, unnest(ARRAY[
      '550e8400-e29b-41d4-a716-446655440006'::UUID,
      '550e8400-e29b-41d4-a716-446655440019'::UUID,
      '550e8400-e29b-41d4-a716-446655440018'::UUID,
      '550e8400-e29b-41d4-a716-446655440010'::UUID,
      '48b980da-5a42-4a9b-a952-86ab5db6666a'::UUID
    ]), DATE '2026-10-01', DATE '2026-10-31', 'Formasi Oktober 2026';

    -- =========================================================================
    -- C. PERIODE MULAI 1 NOVEMBER 2026 (Berdasarkan staff_outlets aktif saat ini)
    -- =========================================================================
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, effective_to, reason)
    SELECT DISTINCT ON (so.outlet_id)
      so.staff_id,
      so.outlet_id,
      DATE '2026-11-01',
      NULL,
      'Formasi Aktif November 2026'
    FROM public.staff_outlets so
    JOIN public.outlet_staff os ON os.id = so.staff_id
    JOIN public.outlets o ON o.id = so.outlet_id
    WHERE os.role = 'area_manager'
      AND os.status = 'active'
      AND o.id != 'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID
      AND o.id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::UUID
      AND LOWER(o.name) NOT LIKE '%kantor pusat%'
      AND LOWER(o.name) NOT LIKE '%gudang%'
      AND LOWER(o.name) NOT LIKE '%backup%'
      AND LOWER(o.name) NOT LIKE '%tes%'
      AND (o.type IS NULL OR o.type != 'marketplace')
    ORDER BY so.outlet_id, so.staff_id;

    -- Catat juga riwayat pergeseran yang sudah terjadi pada 1 Oktober & 1 November ke am_outlet_rotations
    INSERT INTO public.am_outlet_rotations (outlet_id, from_staff_id, to_staff_id, effective_date, reason, notes, actor_name)
    VALUES
      ('550e8400-e29b-41d4-a716-446655440005'::UUID, '065c463a-fcd3-4f14-b04e-7c104207eb6c'::UUID, 'caf351f1-ea40-4fff-99ce-a4af71c59d47'::UUID, DATE '2026-10-01', 'Rotasi Formasi Oktober 2026', 'Sukmajaya beralih dari Chairul Rizky ke Tri Rizky', 'HR Admin'),
      ('550e8400-e29b-41d4-a716-446655440006'::UUID, '065c463a-fcd3-4f14-b04e-7c104207eb6c'::UUID, 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f'::UUID, DATE '2026-10-01', 'Rotasi Formasi Oktober 2026', 'Jagakarsa beralih dari Chairul Rizky ke Mulyadi', 'HR Admin'),
      ('550e8400-e29b-41d4-a716-446655440018'::UUID, 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f'::UUID, 'caf351f1-ea40-4fff-99ce-a4af71c59d47'::UUID, DATE '2026-11-01', 'Rotasi Formasi November 2026', 'Mitra Pekayon beralih dari Mulyadi ke Tri Rizky', 'Indra Irawan'),
      ('550e8400-e29b-41d4-a716-446655440010'::UUID, 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f'::UUID, 'caf351f1-ea40-4fff-99ce-a4af71c59d47'::UUID, DATE '2026-11-01', 'Rotasi Formasi November 2026', 'Jatiwaringin beralih dari Mulyadi ke Tri Rizky', 'Indra Irawan'),
      ('3d8cc715-3f2d-43c6-a7b0-1841d60de8f7'::UUID, '065c463a-fcd3-4f14-b04e-7c104207eb6c'::UUID, 'eb2ad99d-0cc9-4853-84a1-8e3c914eff6f'::UUID, DATE '2026-11-01', 'Rotasi Formasi November 2026', 'Mitra Ciledug beralih dari Chairul Rizky ke Mulyadi', 'Indra Irawan');
  END IF;
END $$;

-- 4. Fungsi RPC get_monthly_am_bonus Berbasis Rentang Tanggal Efektif (Prorata Hari / Split Tanggal)
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
  v_start_ts   TIMESTAMPTZ;
  v_end_ts     TIMESTAMPTZ;
  v_start_date DATE;
  v_end_date   DATE;
BEGIN
  v_start_ts   := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Asia/Jakarta');
  v_end_ts     := v_start_ts + INTERVAL '1 month';
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date   := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  RETURN QUERY
  WITH
  ActiveAM AS (
    SELECT os.id AS s_id, os.name AS s_name, os.role AS s_role
    FROM public.outlet_staff os
    WHERE os.role = 'area_manager'
      AND os.status = 'active'
      AND os.is_bonus_eligible = true
  ),
  -- Daftar penugasan AM yang aktif beririsan dengan bulan p_month/p_year
  PeriodAssignments AS (
    SELECT
      aoa.staff_id AS s_id,
      aoa.outlet_id AS o_id,
      o.name AS o_name,
      GREATEST(aoa.effective_from, v_start_date) AS active_from,
      LEAST(COALESCE(aoa.effective_to, v_end_date), v_end_date) AS active_to
    FROM public.am_outlet_assignments aoa
    JOIN public.outlets o ON o.id = aoa.outlet_id
    WHERE aoa.effective_from <= v_end_date
      AND (aoa.effective_to IS NULL OR aoa.effective_to >= v_start_date)
      AND o.id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::UUID
      AND o.id != 'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID
      AND LOWER(o.name) NOT LIKE '%tes%'
      AND LOWER(o.name) NOT LIKE '%test%'
      AND LOWER(o.name) NOT LIKE '%trial%'
      AND LOWER(o.name) NOT LIKE '%demo%'
      AND LOWER(o.name) NOT LIKE '%backup%'
      AND (o.type IS NULL OR o.type != 'marketplace')
      AND LOWER(o.name) NOT LIKE '%kantor pusat%'
      AND LOWER(o.name) NOT LIKE '%gudang%'
  ),
  -- Rekap penjualan harian per outlet dalam zona waktu Asia/Jakarta
  DailyOutletSales AS (
    SELECT
      ord.outlet_id AS o_id,
      (ord.created_at AT TIME ZONE 'Asia/Jakarta')::DATE AS sale_date,
      COALESCE(SUM(oi.quantity), 0)::BIGINT AS daily_pcs
    FROM public.orders ord
    JOIN public.outlets o ON o.id = ord.outlet_id
    JOIN public.order_items oi ON oi.order_id = ord.id
    WHERE ord.status = 'completed'
      AND ord.created_at >= v_start_ts
      AND ord.created_at < v_end_ts
      AND o.id != 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::UUID
      AND LOWER(o.name) NOT LIKE '%tes%'
      AND LOWER(o.name) NOT LIKE '%test%'
      AND LOWER(o.name) NOT LIKE '%backup%'
      AND (o.type IS NULL OR o.type != 'marketplace')
    GROUP BY ord.outlet_id, (ord.created_at AT TIME ZONE 'Asia/Jakarta')::DATE
  ),
  -- Hitung pcs per assignment sesuai tanggal efektif pegang outlet
  AssignmentSales AS (
    SELECT
      pa.s_id,
      pa.o_id,
      CASE
        WHEN pa.active_from > v_start_date OR pa.active_to < v_end_date THEN
          pa.o_name || ' (' || EXTRACT(DAY FROM pa.active_from)::INT || '-' || EXTRACT(DAY FROM pa.active_to)::INT || ' ' ||
          CASE p_month
            WHEN 1 THEN 'Jan' WHEN 2 THEN 'Feb' WHEN 3 THEN 'Mar' WHEN 4 THEN 'Apr'
            WHEN 5 THEN 'Mei' WHEN 6 THEN 'Jun' WHEN 7 THEN 'Jul' WHEN 8 THEN 'Agu'
            WHEN 9 THEN 'Sep' WHEN 10 THEN 'Okt' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Des'
          END || ')'
        ELSE pa.o_name
      END AS o_label,
      COALESCE(SUM(dos.daily_pcs), 0)::BIGINT AS assigned_pcs
    FROM PeriodAssignments pa
    LEFT JOIN DailyOutletSales dos
      ON dos.o_id = pa.o_id
     AND dos.sale_date >= pa.active_from
     AND dos.sale_date <= pa.active_to
    GROUP BY pa.s_id, pa.o_id, pa.o_name, pa.active_from, pa.active_to
  ),
  AMSummary AS (
    SELECT
      a.s_id,
      COUNT(DISTINCT asales.o_id)::BIGINT AS outlet_cnt,
      COALESCE(ARRAY_AGG(asales.o_label ORDER BY asales.o_label) FILTER (WHERE asales.o_label IS NOT NULL), ARRAY[]::TEXT[]) AS outlet_names,
      COALESCE(SUM(asales.assigned_pcs), 0)::BIGINT AS am_total_pcs
    FROM ActiveAM a
    LEFT JOIN AssignmentSales asales ON asales.s_id = a.s_id
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
