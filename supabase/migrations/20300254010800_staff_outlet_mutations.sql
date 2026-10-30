-- Migration: 20300254010800_staff_outlet_mutations.sql
-- Tabel log dan riwayat mutasi / pemindahan cabang outlet karyawan

CREATE TABLE IF NOT EXISTS public.staff_outlet_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  origin_outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
  target_outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_mutations_staff_id ON public.staff_outlet_mutations(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_mutations_effective_date ON public.staff_outlet_mutations(effective_date);

ALTER TABLE public.staff_outlet_mutations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read staff_outlet_mutations"
  ON public.staff_outlet_mutations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admin write staff_outlet_mutations"
  ON public.staff_outlet_mutations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role IN ('admin', 'owner', 'admin_hr')
    )
  );

NOTIFY pgrst, 'reload schema';
