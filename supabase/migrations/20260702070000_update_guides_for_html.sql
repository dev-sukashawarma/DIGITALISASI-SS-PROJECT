-- Rename content_md to content_html
ALTER TABLE public.system_guides RENAME COLUMN content_md TO content_html;

-- Note: Since the existing data is simple markdown (just numbers and bolding/italics), 
-- we can do a simple replacement for the most common ones or leave them as plain text. 
-- In a real scenario we'd use a markdown-to-html script, but for this migration we'll 
-- do some basic string replacements to convert the seed data to HTML.
UPDATE public.system_guides
SET content_html = REPLACE(REPLACE(content_html, '**', '<strong>'), '**', '</strong>');

UPDATE public.system_guides
SET content_html = '<p>' || REPLACE(content_html, CHR(10), '</p><p>') || '</p>';

-- Create storage bucket for images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('guide-images', 'guide-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- Allow anyone to read
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'guide-images' );

-- Allow authenticated users (Admin/Owner) to insert/upload images
CREATE POLICY "Auth Insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'guide-images' );

-- Allow authenticated users to update/delete their own uploads (optional, but good practice)
CREATE POLICY "Auth Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'guide-images' AND auth.uid() = owner );

CREATE POLICY "Auth Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'guide-images' AND auth.uid() = owner );
