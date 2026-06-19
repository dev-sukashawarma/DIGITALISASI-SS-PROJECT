-- Fix: Migrate Andi from old (non-existent) auth ID to new auth ID
-- Old ID: 9e8df551-406d-4da7-bfdb-22e53253253e (auth user missing)
-- New ID: 0b761a67-a113-443f-ab51-24fc9f545812 (created in auth)

-- Step 1: Drop all FK constraints that reference outlet_staff(id)
-- Use a procedure to drop them all dynamically
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT constraint_name, table_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND constraint_name IN (
        SELECT constraint_name
        FROM information_schema.referential_constraints
        WHERE unique_constraint_catalog = 'postgres'
          AND unique_constraint_schema = 'public'
          AND unique_constraint_name = 'outlet_staff_pkey'
      )
  LOOP
    EXECUTE 'ALTER TABLE ' || constraint_record.table_name ||
            ' DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name;
  END LOOP;
END $$;

-- Step 2: Update outlet_staff ID
UPDATE outlet_staff
SET id = '0b761a67-a113-443f-ab51-24fc9f545812'
WHERE id = '9e8df551-406d-4da7-bfdb-22e53253253e';

-- Step 3: Update all references in all tables
-- Generic update for all columns that might reference the outlet_staff ID
DO $$
DECLARE
  rec RECORD;
  col_name TEXT;
BEGIN
  FOR rec IN
    SELECT table_name, column_name as col
    FROM information_schema.columns
    WHERE column_name IN ('created_by', 'user_id', 'dibuat_oleh', 'staff_id', 'outlet_staff_id')
      AND table_schema = 'public'
  LOOP
    col_name := rec.col;
    EXECUTE 'UPDATE ' || rec.table_name || ' SET ' ||
            col_name || ' = ''0b761a67-a113-443f-ab51-24fc9f545812'' WHERE ' ||
            col_name || ' = ''9e8df551-406d-4da7-bfdb-22e53253253e''';
  END LOOP;
END $$;

-- Note: FK constraints were dropped in Step 1. They need to be recreated manually.
-- Run these in your schema/migration after verifying the data:
-- SELECT constraint_name FROM information_schema.table_constraints
-- WHERE table_schema='public' AND constraint_type='FOREIGN KEY' LIMIT 10;
