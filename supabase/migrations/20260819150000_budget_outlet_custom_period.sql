-- 20260819150000_budget_outlet_custom_period.sql
-- Menambah dukungan periode "custom" (X hari) pada outlet_budget_config.
-- Perubahan:
--   1. Tambah kolom custom_days INT di outlet_budget_config
--   2. Perbarui CHECK constraint period_type agar termasuk 'custom'
--   3. Perbarui RPC get_outlet_budget_status untuk menangani period_type = 'custom'

-- 1. Tambah kolom custom_days (nullable, hanya dipakai saat period_type = 'custom')
ALTER TABLE public.outlet_budget_config
  ADD COLUMN IF NOT EXISTS custom_days INT CHECK (custom_days IS NULL OR custom_days >= 1);

-- 2. Perbarui CHECK constraint period_type
ALTER TABLE public.outlet_budget_config
  DROP CONSTRAINT IF EXISTS outlet_budget_config_period_type_check;

ALTER TABLE public.outlet_budget_config
  ADD CONSTRAINT outlet_budget_config_period_type_check
    CHECK (period_type IN ('harian', 'mingguan', 'bulanan', 'custom'));

-- 3. Perbarui RPC get_outlet_budget_status untuk mendukung period_type = 'custom'
DROP FUNCTION IF EXISTS get_outlet_budget_status(UUID);

CREATE OR REPLACE FUNCTION get_outlet_budget_status(p_outlet_id UUID)
RETURNS TABLE (
  nominal      NUMERIC,
  period_type  TEXT,
  period_start DATE,
  period_end   DATE,
  terpakai     NUMERIC,
  sisa         NUMERIC,
  has_config   BOOLEAN,
  custom_days  INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg          outlet_budget_config;
  v_today        DATE := (NOW() AT TIME ZONE 'Asia/Jakarta')::date;
  v_start        DATE;
  v_end          DATE;
  v_days_since   INT;
  v_period_index INT;
  v_terpakai     NUMERIC;
  v_cdays        INT;
BEGIN
  SELECT * INTO v_cfg FROM outlet_budget_config WHERE outlet_budget_config.outlet_id = p_outlet_id;

  IF v_cfg.outlet_id IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, NULL::TEXT, NULL::DATE, NULL::DATE, 0::NUMERIC, 0::NUMERIC, false, NULL::INT;
    RETURN;
  END IF;

  IF v_cfg.period_type = 'harian' THEN
    v_start := v_today;
    v_end   := v_today;
  ELSIF v_cfg.period_type = 'mingguan' THEN
    v_days_since   := v_today - v_cfg.effective_from;
    v_period_index := FLOOR(v_days_since / 7.0);
    v_start := v_cfg.effective_from + (v_period_index * 7);
    v_end   := v_start + 6;
  ELSIF v_cfg.period_type = 'custom' THEN
    v_cdays        := GREATEST(COALESCE(v_cfg.custom_days, 1), 1);
    v_days_since   := v_today - v_cfg.effective_from;
    v_period_index := FLOOR(v_days_since::NUMERIC / v_cdays::NUMERIC);
    v_start := v_cfg.effective_from + (v_period_index * v_cdays);
    v_end   := v_start + v_cdays - 1;
  ELSE -- bulanan
    v_start := DATE_TRUNC('month', v_today)::date;
    v_end   := (DATE_TRUNC('month', v_today) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  END IF;

  SELECT COALESCE(SUM(pbi.qty_disetujui * COALESCE(pbi.harga_snapshot, 0)), 0)
  INTO v_terpakai
  FROM permintaan_bahan pb
  JOIN permintaan_bahan_item pbi ON pbi.permintaan_id = pb.id
  WHERE pb.outlet_id = p_outlet_id
    AND pb.status = 'disetujui'
    AND (pb.updated_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_start AND v_end;

  RETURN QUERY SELECT
    v_cfg.nominal,
    v_cfg.period_type,
    v_start,
    v_end,
    v_terpakai,
    (v_cfg.nominal - v_terpakai),
    true,
    v_cfg.custom_days;
END;
$$;

-- Pastikan hak akses tetap terbatas ke service_role saja
REVOKE EXECUTE ON FUNCTION get_outlet_budget_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION get_outlet_budget_status(uuid) TO service_role;
