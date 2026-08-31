-- Semua bukti foto inventaris harus berupa WebP.
ALTER TABLE public.inventaris_submission_items
  DROP CONSTRAINT IF EXISTS inventaris_submission_items_photo_webp;

ALTER TABLE public.inventaris_submission_items
  ADD CONSTRAINT inventaris_submission_items_photo_webp
  CHECK (photo_path ILIKE '%.webp');

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/webp']::text[]
WHERE id = 'inventaris-foto';
