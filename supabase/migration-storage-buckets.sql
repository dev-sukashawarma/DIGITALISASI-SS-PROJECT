-- ============================================================
-- Fix missing storage buckets for Absensi Face API
-- Jalankan script ini di: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Create 'face-refs' bucket for Enrollment photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'face-refs', 'face-refs', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png']
) ON CONFLICT DO NOTHING;

-- Policies for 'face-refs'
DROP POLICY IF EXISTS "Public can view face-refs" ON storage.objects;
DROP POLICY IF EXISTS "All authenticated users can upload face-refs" ON storage.objects;

CREATE POLICY "Public can view face-refs" ON storage.objects FOR SELECT USING (bucket_id = 'face-refs');
CREATE POLICY "All authenticated users can upload face-refs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'face-refs' AND auth.role() = 'authenticated');
CREATE POLICY "All authenticated users can update face-refs" ON storage.objects FOR UPDATE USING (bucket_id = 'face-refs' AND auth.role() = 'authenticated');

-- 2. Create 'selfies' bucket for Attendance Audit photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'selfies', 'selfies', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png']
) ON CONFLICT DO NOTHING;

-- Policies for 'selfies'
DROP POLICY IF EXISTS "Public can view selfies" ON storage.objects;
DROP POLICY IF EXISTS "All authenticated users can upload selfies" ON storage.objects;

CREATE POLICY "Public can view selfies" ON storage.objects FOR SELECT USING (bucket_id = 'selfies');
CREATE POLICY "All authenticated users can upload selfies" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'selfies' AND auth.role() = 'authenticated');
CREATE POLICY "All authenticated users can update selfies" ON storage.objects FOR UPDATE USING (bucket_id = 'selfies' AND auth.role() = 'authenticated');
