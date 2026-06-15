-- 20260613000300_outlet_staff_role_expand.sql
-- Perluas daftar role outlet_staff jadi 7 role kanonik (SSO per role).
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;

ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN ('admin', 'owner', 'spv', 'kepala_outlet', 'kasir', 'crew', 'kiosk'));
