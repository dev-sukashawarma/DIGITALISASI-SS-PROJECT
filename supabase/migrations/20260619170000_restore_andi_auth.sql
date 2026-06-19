-- Restore Andi Empang outlet_staff reference
-- Auth entry already created via Supabase dashboard
-- This migration updates outlet_staff to reference the restored user ID

UPDATE outlet_staff
SET id = '0b761a67-a113-443f-ab51-24fc9f545812'
WHERE id = '9e8df551-406d-4da7-bfdb-22e532535253';
