-- Migrasi Skema Database: Modul Master Bahan Baku (Gambar & 3 Tingkat Satuan)
-- Jalankan script ini di menu "SQL Editor" pada dashboard Supabase Anda.

-- 1. Tambahkan kolom image_url, satuan_tengah, dan faktor_tengah
ALTER TABLE public.bahan_baku
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS satuan_tengah TEXT,
ADD COLUMN IF NOT EXISTS faktor_tengah NUMERIC;

-- 2. Buat storage bucket untuk 'bahan-baku' jika belum ada
-- (Biasanya Supabase Storage Bucket harus dibuat via Dashboard -> Storage -> New Bucket)
-- Atau bisa via script berikut (hati-hati, eksekusi ini membutuhkan hak akses superuser jika via script, lebih baik buat via UI).
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bahan-baku', 'bahan-baku', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Policy untuk Storage (Izinkan semua membaca dan auth user untuk upload/edit)
-- Pastikan Anda menjalankan ini untuk bucket bahan-baku
DROP POLICY IF EXISTS "Public Access bahan-baku" ON storage.objects;
CREATE POLICY "Public Access bahan-baku" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'bahan-baku');

DROP POLICY IF EXISTS "Auth upload bahan-baku" ON storage.objects;
CREATE POLICY "Auth upload bahan-baku" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'bahan-baku' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth update bahan-baku" ON storage.objects;
CREATE POLICY "Auth update bahan-baku" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'bahan-baku' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth delete bahan-baku" ON storage.objects;
CREATE POLICY "Auth delete bahan-baku" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'bahan-baku' AND auth.role() = 'authenticated');
