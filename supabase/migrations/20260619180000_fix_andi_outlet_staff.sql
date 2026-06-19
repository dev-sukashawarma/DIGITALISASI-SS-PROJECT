-- Fix: Delete old outlet_staff record (auth user doesn't exist),
-- then insert new one with correct auth user ID

-- Delete old record (orphaned, auth user is gone)
DELETE FROM outlet_staff
WHERE id = '9e8df551-406d-4da7-bfdb-22e532535253';

-- Insert new record with correct auth user ID
INSERT INTO outlet_staff (
  id,
  outlet_id,
  name,
  role,
  status,
  username,
  is_active
)
VALUES (
  '0b761a67-a113-443f-ab51-24fc9f545812',
  '550e8400-e29b-41d4-a716-446655440002',
  'Andi Empang',
  'crew',
  'active',
  'andi_empang',
  true
)
ON CONFLICT (id) DO NOTHING;
