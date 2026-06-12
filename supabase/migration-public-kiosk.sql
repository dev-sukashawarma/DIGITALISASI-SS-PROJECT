-- ============================================================
-- STORAGE POLICIES: Allow public Kiosk (anon) to upload selfies
-- Jalankan script ini di: Supabase Dashboard > SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "Anon can upload selfies" ON storage.objects;
DROP POLICY IF EXISTS "Anon can update selfies" ON storage.objects;

CREATE POLICY "Anon can upload selfies" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'selfies' AND auth.role() = 'anon');

CREATE POLICY "Anon can update selfies" ON storage.objects 
FOR UPDATE USING (bucket_id = 'selfies' AND auth.role() = 'anon');
