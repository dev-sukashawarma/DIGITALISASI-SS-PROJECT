-- Tambah FK constraint bernama eksplisit pada opname.created_by → outlet_staff(id)
-- agar PostgREST bisa resolve embedded resource outlet_staff!opname_created_by_fkey(name).
-- Pakai DO block untuk idempoten (skip jika FK sudah ada).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'opname'::regclass
      AND conname = 'opname_created_by_fkey'
  ) THEN
    ALTER TABLE opname
      ADD CONSTRAINT opname_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES outlet_staff(id) ON DELETE SET NULL;
  END IF;
END $$;
