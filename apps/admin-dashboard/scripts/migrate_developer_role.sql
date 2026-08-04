-- Menambahkan role 'developer' ke dalam ENUM staff_role jika menggunakan Supabase / PostgreSQL.
-- Script ini aman untuk dieksekusi berkali-kali.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'staff_role' AND e.enumlabel = 'developer'
  ) THEN
    ALTER TYPE staff_role ADD VALUE 'developer';
  END IF;
END $$;
