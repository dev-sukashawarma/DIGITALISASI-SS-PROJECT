-- Migrasi Skema Database: Modul Inventory FIFO & Konversi Satuan
-- Jalankan script ini di menu "SQL Editor" pada dashboard Supabase Anda.

-- Aktifkan ekstensi uuid-ossp (biasanya sudah aktif di Supabase secara default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabel Master Satuan (inventory_units)
CREATE TABLE public.inventory_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Master Bahan Baku (inventory_items)
-- Catatan: Jika Anda sudah punya tabel bahan_baku, Anda bisa memodifikasinya 
-- dengan menambahkan kolom base_unit_id, atau menggunakan tabel baru ini.
CREATE TABLE public.inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    base_unit_id UUID NOT NULL REFERENCES public.inventory_units(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Konversi Satuan (inventory_conversions)
CREATE TABLE public.inventory_conversions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.inventory_units(id) ON DELETE RESTRICT,
    multiplier_to_base NUMERIC NOT NULL CHECK (multiplier_to_base > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_id, unit_id) -- Satu item tidak boleh punya konversi ganda untuk satuan yang sama
);

-- 4. Tabel Batch FIFO (inventory_batches)
CREATE TABLE public.inventory_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id TEXT NOT NULL, -- Diisi dengan ID Outlet / 'KITCHEN' / UUID
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    qty_initial NUMERIC NOT NULL CHECK (qty_initial > 0),
    qty_remaining NUMERIC NOT NULL CHECK (qty_remaining >= 0),
    price_per_base_unit NUMERIC NOT NULL CHECK (price_per_base_unit >= 0),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk mempercepat query FIFO (Mencari stok yang belum habis, diurutkan waktu)
CREATE INDEX idx_inventory_batches_fifo ON public.inventory_batches(item_id, location_id, qty_remaining, received_at);

-- 5. Tabel Internal Request (internal_requests)
CREATE TABLE public.internal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DISPATCHED', 'RECEIVED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabel Detail Item Internal Request (internal_request_items)
CREATE TABLE public.internal_request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.internal_requests(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    requested_unit_id UUID NOT NULL REFERENCES public.inventory_units(id) ON DELETE RESTRICT,
    requested_qty NUMERIC NOT NULL CHECK (requested_qty > 0),
    converted_base_qty NUMERIC NOT NULL CHECK (converted_base_qty > 0), -- Disimpan agar tidak perlu join konversi berulang kali saat query
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security) - Biarkan off sementara jika belum perlu dibatasi, 
-- namun best practice di Supabase adalah mengaktifkannya.
ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_request_items ENABLE ROW LEVEL SECURITY;

-- Buat policy sementara agar semua user yang terautentikasi bisa read & write (bisa disesuaikan nanti)
CREATE POLICY "Enable all for authenticated users" ON public.inventory_units FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.inventory_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.inventory_conversions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.inventory_batches FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.internal_requests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.internal_request_items FOR ALL USING (auth.role() = 'authenticated');
