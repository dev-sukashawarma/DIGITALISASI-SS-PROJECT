-- Seed outlet_staff untuk test: Andi Empang (crew) di outlet EMPANG
INSERT INTO outlet_staff (
  id,
  outlet_id,
  name,
  role,
  status,
  created_at,
  updated_at
) VALUES (
  '9e8df551-406d-4da7-bfdb-22e53253253e'::uuid,
  '550e8400-e29b-41d4-a716-446655440002'::uuid,
  'Andi Empang',
  'crew',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  outlet_id = EXCLUDED.outlet_id,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  updated_at = NOW();
