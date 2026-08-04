CREATE TABLE IF NOT EXISTS public.bahan_baku_sku (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bahan_baku_id UUID REFERENCES public.bahan_baku(id) ON DELETE CASCADE,
    nama_kemasan TEXT NOT NULL,
    qty_isi NUMERIC NOT NULL DEFAULT 1,
    harga_beli NUMERIC DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    tingkatan_satuan TEXT,
    satuan_tengah TEXT,
    faktor_tengah NUMERIC,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bahan_baku_sku ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.bahan_baku_sku;
DROP POLICY IF EXISTS "Enable write access for admins" ON public.bahan_baku_sku;
DROP POLICY IF EXISTS bbs_read ON public.bahan_baku_sku;
DROP POLICY IF EXISTS bbs_write ON public.bahan_baku_sku;

-- Allow all authenticated users to read
CREATE POLICY "Enable read access for all authenticated users" ON public.bahan_baku_sku 
FOR SELECT TO authenticated USING (true);

-- Only allow admins to write (insert, update, delete)
CREATE POLICY "Enable write access for admins" ON public.bahan_baku_sku 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'));
