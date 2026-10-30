-- Migration: 20300254010900_staff_activity_logs.sql
-- Tabel riwayat aktivitas, pendaftaran, mutasi, dan perubahan karyawan

CREATE TABLE IF NOT EXISTS public.staff_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'CREATED', 'MUTATED_OUTLET', 'UPDATED_PROFILE', 'DEACTIVATED', 'ACTIVATED', 'RESET_PASSWORD'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  actor_id UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  actor_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_activity_logs_staff_id ON public.staff_activity_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_activity_logs_action_type ON public.staff_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_staff_activity_logs_created_at ON public.staff_activity_logs(created_at DESC);

ALTER TABLE public.staff_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read staff_activity_logs"
  ON public.staff_activity_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admin write staff_activity_logs"
  ON public.staff_activity_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role IN ('admin', 'owner', 'admin_hr', 'developer')
    )
  );

-- Backfill riwayat pembuatan karyawan yang sudah ada di sistem
INSERT INTO public.staff_activity_logs (staff_id, action_type, title, description, metadata, created_at)
SELECT 
  s.id,
  'CREATED',
  'Pendaftaran Karyawan Baru',
  CONCAT('Karyawan didaftarkan sebagai ', UPPER(REPLACE(s.role, '_', ' ')), COALESCE(CONCAT(' di cabang ', o.name), ' (Kantor Pusat)')),
  jsonb_build_object(
    'role', s.role,
    'sub_role', s.sub_role,
    'outlet_id', s.outlet_id,
    'outlet_name', o.name,
    'join_date', s.join_date,
    'onboarding_stage', s.onboarding_stage
  ),
  COALESCE(s.created_at, NOW())
FROM public.outlet_staff s
LEFT JOIN public.outlets o ON s.outlet_id = o.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.staff_activity_logs l 
  WHERE l.staff_id = s.id AND l.action_type = 'CREATED'
);

NOTIFY pgrst, 'reload schema';
