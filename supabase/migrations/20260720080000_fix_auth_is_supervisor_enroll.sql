-- Fix auth_is_supervisor() agar mencakup semua role yang berhak melakukan
-- operasi manajemen (enroll wajah, update staff, dll).
-- Sebelumnya hanya: spv, leader, kitchen → admin/admin_hr/owner diblokir RLS.

CREATE OR REPLACE FUNCTION public.auth_is_supervisor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('spv', 'leader', 'kitchen', 'admin', 'admin_hr', 'owner')
      AND status = 'active'
  );
$$;
