-- 20260613000700_profiles_compat_view.sql
-- profiles menjadi VIEW kompat di atas outlet_staff (transisi; akan dihapus saat
-- pos-kasir dirombak penuh ke outlet_staff).
-- Lepas policy lama dulu (akan ikut hilang bersama tabel).
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE VIEW public.profiles
WITH (security_invoker = true) AS
SELECT
  os.id,
  os.role,
  os.outlet_id,
  os.name        AS username,
  os.created_at,
  os.updated_at,
  (os.status = 'active') AS is_active,
  NULL::text     AS inactive_reason
FROM public.outlet_staff os;
