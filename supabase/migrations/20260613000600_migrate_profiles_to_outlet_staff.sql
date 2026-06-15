-- 20260613000600_migrate_profiles_to_outlet_staff.sql
-- Pindahkan identitas POS (profiles) ke outlet_staff (sumber kebenaran tunggal).
-- Keyed by id (profiles.id = outlet_staff.id = auth.users.id).
INSERT INTO public.outlet_staff (id, outlet_id, name, role, status)
SELECT
  p.id,
  COALESCE(p.outlet_id, (SELECT id FROM public.outlets ORDER BY created_at LIMIT 1)),
  COALESCE(p.username, '(tanpa nama)'),
  p.role,
  CASE WHEN p.is_active IS FALSE THEN 'inactive' ELSE 'active' END
FROM public.profiles p
ON CONFLICT (id) DO UPDATE
  SET role   = EXCLUDED.role,
      status = EXCLUDED.status;
