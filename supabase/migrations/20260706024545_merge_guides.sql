-- 1. Drop the UNIQUE constraint on system_code
ALTER TABLE public.system_guides DROP CONSTRAINT IF EXISTS system_guides_system_code_key;

-- 2. Add category and sort_order to system_guides
ALTER TABLE public.system_guides ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Umum';
ALTER TABLE public.system_guides ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.system_guides ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 3. Delete the dummy 'pos' guide we created in system_guides to avoid duplicates with the real data
DELETE FROM public.system_guides WHERE system_code = 'pos' AND title = 'Panduan Sistem POS (Kasir)';

-- 4. Migrate existing data from guides to system_guides
INSERT INTO public.system_guides (system_code, category, title, content_html, image_url, sort_order, created_at, updated_at)
SELECT 
    'pos', 
    category, 
    title, 
    -- Convert newlines to <br/> or wrap in <p> to make it look decent in HTML
    '<p>' || REPLACE(content, E'\n', '<br/>') || '</p>', 
    image_url, 
    sort_order, 
    created_at, 
    updated_at
FROM public.guides
ON CONFLICT DO NOTHING;

-- 5. We keep the guides table around just in case, but pos-kasir will stop using it.
