-- Add image_url to system_guides
ALTER TABLE public.system_guides ADD COLUMN IF NOT EXISTS image_url TEXT;
