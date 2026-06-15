-- Menjadikan user admin@gmail.com sebagai Admin Global
-- (Sejak unifikasi, identitas user disimpan di outlet_staff, bukan profiles)

INSERT INTO public.outlet_staff (id, name, username, role, outlet_id, status, is_active)
SELECT id, 'Admin Utama', 'admin_utama', 'admin', NULL, 'active', true
FROM auth.users
WHERE email = 'admin@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin', username = 'admin_utama', is_active = true;
