-- 20260820110000_outlet_budget_config_history.sql
-- Tabel riwayat audit pengubahan limit plafon budget outlet.
-- Menyimpan jejak siapa yang mengubah, kapan, nominal lama vs baru, dan alasan/catatan.

CREATE TABLE IF NOT EXISTS public.outlet_budget_config_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id         UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  nominal_lama      NUMERIC,
  nominal_baru      NUMERIC NOT NULL,
  period_type_lama  TEXT,
  period_type_baru  TEXT NOT NULL,
  custom_days_lama  INT,
  custom_days_baru  INT,
  changed_by        UUID REFERENCES outlet_staff(id),
  changed_by_name   TEXT,
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  catatan           TEXT
);

ALTER TABLE public.outlet_budget_config_history ENABLE ROW LEVEL SECURITY;

-- Read: diizinkan untuk authenticated yang memiliki akses ke outlet_id
DROP POLICY IF EXISTS obch_select ON public.outlet_budget_config_history;
CREATE POLICY obch_select ON public.outlet_budget_config_history FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT accessible_outlet_ids()));

-- Write: via service-role / server action (SECURITY DEFINER)
DROP POLICY IF EXISTS obch_write ON public.outlet_budget_config_history;
CREATE POLICY obch_write ON public.outlet_budget_config_history FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role IN ('owner', 'admin', 'admin_finance') AND status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role IN ('owner', 'admin', 'admin_finance') AND status = 'active'));

-- Realtime: tambahkan ke publication
DO 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'outlet_budget_config_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.outlet_budget_config_history;
  END IF;
END ;
