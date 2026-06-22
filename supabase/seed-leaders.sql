-- Seed Script: 7 Leaders + Outlet Mapping
-- Session 2026-06-22
-- Run via: supabase db push atau paste di Supabase SQL Editor

-- Leader data (name, username, email, password)
-- Note: Password hashing handled by Supabase Auth via RPC

WITH leaders_data AS (
  SELECT
    'Chairul Rizky'::text as name,
    'chairulrizky'::text as username,
    'chairulrizky@test.com'::text as email,
    'test'::text as password,
    ARRAY['sukmajaya', 'beji', 'sawangan', 'ratujaya'] as outlets
  UNION ALL
  SELECT 'Tri Rizky', 'tririzky', 'tririzky@test.com', 'test',
    ARRAY['cibinong', 'ciseeng', 'cirendeu']
  UNION ALL
  SELECT 'Mulyadi', 'mulyadi', 'mulyadi@test.com', 'test',
    ARRAY['jagakarsa', 'kalisari', 'tebet', 'jatiwaringin', 'pekayon', 'jatiasih']
  UNION ALL
  SELECT 'Abu Bakar Bahsin', 'abubakarbahsin', 'abubakarbahsin@test.com', 'test',
    ARRAY['cimanggu']
  UNION ALL
  SELECT 'Abdurrahman', 'abdurrahman', 'abdurrahman@test.com', 'test',
    ARRAY['empang']
  UNION ALL
  SELECT 'Reza', 'reza', 'reza@test.com', 'test',
    ARRAY['dramaga']
  UNION ALL
  SELECT 'Abyansah', 'abyansah', 'abyansah@test.com', 'test',
    ARRAY['pajajaran', 'paledang', 'kitchen']
)
SELECT 'Seed data prepared. Run via edge function create-staff or manual insertion.';

-- ===== MANUAL APPROACH (if using Supabase Dashboard) =====
-- 1. Go to Authentication > Users
-- 2. Click "Add user" for each leader:
--    Email: {username}@test.com
--    Password: test
--    Auto confirm email: true
--
-- 3. After users created, note their UUID and insert into outlet_staff:

-- INSERT INTO outlet_staff (id, outlet_id, name, username, role, status)
-- SELECT
--   u.id,
--   (SELECT id FROM outlets WHERE name = LOWER('sukmajaya')), -- example
--   'Chairul Rizky',
--   'chairulrizky',
--   'leader',
--   'active'
-- FROM auth.users u
-- WHERE u.email = 'chairulrizky@test.com';

-- ===== AUTOMATED APPROACH (via Edge Function) =====
-- Uncomment below and deploy edge function `create-staff` that accepts role='leader'

-- SELECT create_staff_batch(
--   ARRAY[
--     ('Chairul Rizky', 'chairulrizky@test.com', 'test', 'leader'),
--     ('Tri Rizky', 'tririzky@test.com', 'test', 'leader'),
--     ...
--   ]
-- );

-- ===== STAFF_OUTLETS MAPPING (many-to-many leader ↔ outlet) =====
-- After outlet_staff records created, link leaders to outlets:

-- INSERT INTO staff_outlets (staff_id, outlet_id)
-- SELECT o1.id, o2.id FROM outlet_staff o1
-- JOIN outlets o2 ON o2.name = LOWER('sukmajaya')
-- WHERE o1.username = 'chairulrizky'
-- UNION ALL
-- SELECT o1.id, o2.id FROM outlet_staff o1
-- JOIN outlets o2 ON o2.name = LOWER('beji')
-- WHERE o1.username = 'chairulrizky'
-- ... (repeat for all leader-outlet pairs)

-- ===== VERIFICATION =====
-- After seeding, verify:
-- SELECT o1.name as leader, ARRAY_AGG(o2.name) as outlets
-- FROM outlet_staff o1
-- JOIN staff_outlets so ON so.staff_id = o1.id
-- JOIN outlets o2 ON o2.id = so.outlet_id
-- WHERE o1.role = 'leader'
-- GROUP BY o1.id, o1.name
-- ORDER BY o1.name;
