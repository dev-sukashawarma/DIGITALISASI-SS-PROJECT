-- 20260613000400_staff_outlets.sql
-- Pemetaan many-to-many staff <-> outlet, dipakai untuk kepala_outlet multi-outlet.
CREATE TABLE IF NOT EXISTS public.staff_outlets (
  staff_id  uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (staff_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_outlets_staff  ON public.staff_outlets(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_outlets_outlet ON public.staff_outlets(outlet_id);

ALTER TABLE public.staff_outlets ENABLE ROW LEVEL SECURITY;

-- Staff boleh membaca baris pemetaannya sendiri.
DROP POLICY IF EXISTS staff_outlets_select_self ON public.staff_outlets;
CREATE POLICY staff_outlets_select_self ON public.staff_outlets
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid());
