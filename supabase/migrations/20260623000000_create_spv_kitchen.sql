-- Create SPV Pusat (Kitchen/Central Hub)
-- Session: User request to onboard spv.kitchen@test.com as SPV role

-- 1. Ensure 'kitchen' outlet exists (central hub)
INSERT INTO outlets (id, slug, name, lat, lng, address, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440099',
  'outlet-kitchen',
  'Suka Shawarma Kitchen - Pusat',
  -6.2000,
  106.8200,
  'Central Kitchen/Hub',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert SPV record linked to auth.users ID
INSERT INTO outlet_staff (id, outlet_id, name, role, status)
SELECT
  '03bfa0ac-52f8-4d1f-9ef4-fa8f8d3c62f5'::uuid,
  (SELECT id FROM outlets WHERE slug = 'outlet-kitchen'),
  'SPV Kitchen',
  'spv',
  'active'
ON CONFLICT (id) DO NOTHING;

-- Verification query (run after migration):
-- SELECT id, name, role, status FROM outlet_staff WHERE role = 'spv';
