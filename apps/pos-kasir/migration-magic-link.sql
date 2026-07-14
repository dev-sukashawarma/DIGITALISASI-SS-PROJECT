-- 1. Tambah kolom whatsapp di outlet_staff
ALTER TABLE outlet_staff ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- 2. Tambah status pembatalan di orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_status TEXT DEFAULT 'none' CHECK (cancellation_status IN ('none', 'pending_approval', 'approved', 'rejected'));

-- 3. Tabel untuk Magic Link
CREATE TABLE IF NOT EXISTS cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  requested_by UUID REFERENCES outlet_staff(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE cancellation_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cancellation_requests_public" ON cancellation_requests;
CREATE POLICY "cancellation_requests_public" ON cancellation_requests FOR ALL USING (true) WITH CHECK (true);
