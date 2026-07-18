-- 1. Create sales_channels table
CREATE TABLE IF NOT EXISTS public.sales_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Enable read access for authenticated users" 
ON public.sales_channels FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to modify
CREATE POLICY "Enable all access for authenticated users" 
ON public.sales_channels FOR ALL TO authenticated USING (true);

-- 2. Insert default channels
INSERT INTO public.sales_channels (name) VALUES 
('GoFood'),
('GrabFood'),
('ShopeeFood');

-- 3. Add channel_prices column to menu_items
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS channel_prices JSONB DEFAULT '{}'::jsonb;
