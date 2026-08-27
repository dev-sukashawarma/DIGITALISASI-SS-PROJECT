-- ============================================================
-- MITRA DASHBOARD V2 MIGRATION: BIODATA & REKENING & PKS
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tambahkan kolom biodata lengkap ke tabel mitra_profiles jika belum ada
ALTER TABLE IF EXISTS mitra_profiles 
  ADD COLUMN IF NOT EXISTS nik text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS alamat_domisili text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS no_pks text,
  ADD COLUMN IF NOT EXISTS tanggal_pks date,
  ADD COLUMN IF NOT EXISTS tanggal_berakhir_pks date,
  ADD COLUMN IF NOT EXISTS profit_sharing_pct numeric(5,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif', 'dalam_perpanjangan'));

-- 2. Pastikan RLS Policy tetap aman dan up-to-date
ALTER TABLE mitra_profiles ENABLE ROW LEVEL SECURITY;

-- Mitra hanya boleh membaca data profil miliknya sendiri
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'mitra_profiles' AND policyname = 'mitra_profiles_select_own'
  ) THEN
    CREATE POLICY "mitra_profiles_select_own" ON mitra_profiles
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- Admin & Owner dapat melihat dan mengelola semua profil mitra
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'mitra_profiles' AND policyname = 'mitra_profiles_admin_all'
  ) THEN
    CREATE POLICY "mitra_profiles_admin_all" ON mitra_profiles
      FOR ALL USING (
        EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.id = auth.uid() AND outlet_staff.role IN ('admin','owner'))
      );
  END IF;
END $$;
