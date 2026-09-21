-- 20260921170000_add_crew_subrole_and_onboarding.sql
-- 1. Tambah kolom sub_role untuk role crew (crew_regular, crew_backup)
-- 2. Tambah kolom siklus onboarding (onboarding_stage, training_start_date)
-- 3. Buat tabel evaluasi kelayakan crew onboarding oleh Area Manager (crew_onboarding_evaluations)
-- 4. Update home-base outlet untuk regional_manager dan area_manager ke Kantor Pusat

-- 1. Sub-role untuk crew
ALTER TABLE public.outlet_staff
  ADD COLUMN IF NOT EXISTS sub_role TEXT DEFAULT 'crew_regular';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outlet_staff_sub_role_check'
  ) THEN
    ALTER TABLE public.outlet_staff
      ADD CONSTRAINT outlet_staff_sub_role_check
      CHECK (sub_role IS NULL OR sub_role IN ('crew_regular', 'crew_backup'));
  END IF;
END $$;

-- 2. Onboarding stage & training start date
ALTER TABLE public.outlet_staff
  ADD COLUMN IF NOT EXISTS onboarding_stage TEXT DEFAULT 'regular';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outlet_staff_onboarding_stage_check'
  ) THEN
    ALTER TABLE public.outlet_staff
      ADD CONSTRAINT outlet_staff_onboarding_stage_check
      CHECK (onboarding_stage IS NULL OR onboarding_stage IN ('training_7_days', 'ojt', 'graduated', 'regular', 'failed'));
  END IF;
END $$;

ALTER TABLE public.outlet_staff
  ADD COLUMN IF NOT EXISTS training_start_date DATE;

-- 3. Tabel evaluasi kelayakan oleh Area Manager
CREATE TABLE IF NOT EXISTS public.crew_onboarding_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  evaluator_id UUID REFERENCES public.outlet_staff(id),
  outlet_id UUID REFERENCES public.outlets(id),
  evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  day_count_at_eval INT NOT NULL DEFAULT 15,
  decision TEXT NOT NULL CHECK (decision IN ('pass_pkwt', 'extend_ojt', 'failed')),
  scores JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'verified_hr')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_onboarding_eval_staff ON public.crew_onboarding_evaluations(staff_id);
CREATE INDEX IF NOT EXISTS idx_crew_onboarding_eval_evaluator ON public.crew_onboarding_evaluations(evaluator_id);

ALTER TABLE public.crew_onboarding_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crew_onboarding_eval_read" ON public.crew_onboarding_evaluations;
CREATE POLICY "crew_onboarding_eval_read"
  ON public.crew_onboarding_evaluations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "crew_onboarding_eval_write" ON public.crew_onboarding_evaluations;
CREATE POLICY "crew_onboarding_eval_write"
  ON public.crew_onboarding_evaluations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Update home base outlet untuk Regional Manager & Area Manager ke Kantor Pusat
UPDATE public.outlet_staff
SET outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
WHERE role IN ('regional_manager', 'area_manager')
  AND (outlet_id IS NULL OR outlet_id != 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);
