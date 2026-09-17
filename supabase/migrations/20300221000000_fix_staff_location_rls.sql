-- 20300221000000_fix_staff_location_rls.sql
-- Mengizinkan aplikasi mobile staf (authenticated & background service/anon) menulis titik lokasi GPS
-- Mencegah banjir error 42501 (new row violates row-level security policy for table "staff_location_trails")

-- 1. Pastikan RLS aktif
ALTER TABLE IF EXISTS public.staff_location_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_live_locations ENABLE ROW LEVEL SECURITY;

-- 2. Policy untuk staff_location_trails (append-only trail points)
DROP POLICY IF EXISTS "staff_location_trails_insert_policy" ON public.staff_location_trails;
DROP POLICY IF EXISTS "staff_location_trails_select_policy" ON public.staff_location_trails;

CREATE POLICY "staff_location_trails_insert_policy"
ON public.staff_location_trails
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "staff_location_trails_select_policy"
ON public.staff_location_trails
FOR SELECT
TO authenticated, anon
USING (true);

-- 3. Policy untuk staff_live_locations (upsert merge-duplicates butuh INSERT dan UPDATE)
DROP POLICY IF EXISTS "staff_live_locations_insert_policy" ON public.staff_live_locations;
DROP POLICY IF EXISTS "staff_live_locations_update_policy" ON public.staff_live_locations;
DROP POLICY IF EXISTS "staff_live_locations_select_policy" ON public.staff_live_locations;

CREATE POLICY "staff_live_locations_insert_policy"
ON public.staff_live_locations
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "staff_live_locations_update_policy"
ON public.staff_live_locations
FOR UPDATE
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "staff_live_locations_select_policy"
ON public.staff_live_locations
FOR SELECT
TO authenticated, anon
USING (true);
