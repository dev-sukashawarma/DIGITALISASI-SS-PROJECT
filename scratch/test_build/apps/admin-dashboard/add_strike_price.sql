-- Jalankan script ini di SQL Editor Supabase
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS strike_price numeric;
