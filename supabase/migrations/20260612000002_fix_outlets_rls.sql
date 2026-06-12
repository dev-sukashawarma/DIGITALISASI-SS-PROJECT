-- Fix: Add RLS policies for outlets table to allow POS admin CRUD
-- Run this in Supabase SQL Editor (Absensi project)

-- Pastikan RLS aktif
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada (untuk menghindari konflik)
DROP POLICY IF EXISTS "outlets_select_authenticated" ON public.outlets;
DROP POLICY IF EXISTS "outlets_all_admin" ON public.outlets;
DROP POLICY IF EXISTS "outlets_select_public" ON public.outlets;

-- 1. Semua user yang terautentikasi bisa membaca outlets
CREATE POLICY "outlets_select_authenticated" ON public.outlets
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Admin bisa melakukan semua operasi (INSERT, UPDATE, DELETE) pada outlets
CREATE POLICY "outlets_all_admin" ON public.outlets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
