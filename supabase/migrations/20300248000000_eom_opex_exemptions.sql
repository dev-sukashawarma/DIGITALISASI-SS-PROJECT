-- =============================================================================
-- EOM OPEX Exemptions: Penandaan Kategori Beban Nihil / Tidak Ada Bulan Ini
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.eom_opex_exemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year >= 2025),
  unit_id TEXT NOT NULL,
  category TEXT NOT NULL,
  quick_reason TEXT,
  notes TEXT,
  marked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (month, year, unit_id, category)
);

ALTER TABLE public.eom_opex_exemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eom_opex_exemptions_read" ON public.eom_opex_exemptions;
CREATE POLICY "eom_opex_exemptions_read" ON public.eom_opex_exemptions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "eom_opex_exemptions_write" ON public.eom_opex_exemptions;
CREATE POLICY "eom_opex_exemptions_write" ON public.eom_opex_exemptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
