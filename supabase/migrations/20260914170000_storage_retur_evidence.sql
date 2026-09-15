-- Migration: Dedicated Supabase Storage Bucket for Retur Evidence
-- Tanggal: 2026-09-14

-- 1. Create bucket retur_evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'retur_evidence', 
  'retur_evidence', 
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/jpg'];

-- 2. Storage Policies for retur_evidence
DROP POLICY IF EXISTS "retur_evidence public read" ON storage.objects;
CREATE POLICY "retur_evidence public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'retur_evidence');

DROP POLICY IF EXISTS "retur_evidence insert access" ON storage.objects;
CREATE POLICY "retur_evidence insert access"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'retur_evidence');

DROP POLICY IF EXISTS "retur_evidence update access" ON storage.objects;
CREATE POLICY "retur_evidence update access"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'retur_evidence');

DROP POLICY IF EXISTS "retur_evidence delete access" ON storage.objects;
CREATE POLICY "retur_evidence delete access"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'retur_evidence');

-- 3. Jadikan foto_timbangan_url opsional/nullable (karena foto disatukan: bahan baku di atas timbangan)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'retur_stok_item' 
      AND column_name = 'foto_timbangan_url'
  ) THEN
    ALTER TABLE public.retur_stok_item ALTER COLUMN foto_timbangan_url DROP NOT NULL;
  END IF;
END $$;

-- 4. Realtime Publication untuk retur_stok dan retur_stok_item
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'retur_stok'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.retur_stok;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'retur_stok_item'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.retur_stok_item;
  END IF;
END $$;

ALTER TABLE public.retur_stok REPLICA IDENTITY FULL;
ALTER TABLE public.retur_stok_item REPLICA IDENTITY FULL;

