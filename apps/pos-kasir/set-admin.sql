-- Menjadikan user admin@gmail.com sebagai Admin Global

INSERT INTO public.profiles (id, role, username)
SELECT id, 'admin', 'admin_utama'
FROM auth.users
WHERE email = 'admin@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin', username = 'admin_utama';
