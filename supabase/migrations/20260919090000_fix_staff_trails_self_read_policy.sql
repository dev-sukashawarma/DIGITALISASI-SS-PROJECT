-- Migration: 20260919090000_fix_staff_trails_self_read_policy.sql
-- Description: Allow authenticated staff (including crew) to read their own trails.
-- This resolves error 42501 caused by RETURNING * and ON CONFLICT evaluation in PostgREST upsert
-- without violating UU PDP (staf hanya bisa membaca titik rekam miliknya sendiri).

DROP POLICY IF EXISTS "staff_trails_self_read" ON public.staff_location_trails;

CREATE POLICY "staff_trails_self_read"
ON public.staff_location_trails
FOR SELECT
TO authenticated
USING (outlet_staff_id = auth.uid());
