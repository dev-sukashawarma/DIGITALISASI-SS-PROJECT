-- Create global_settings table if not exists
CREATE TABLE IF NOT EXISTS global_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Configuration for global_settings
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read global_settings
CREATE POLICY "Public read access for global_settings" 
ON global_settings FOR SELECT 
TO authenticated, anon
USING (true);

-- Only admins can modify global_settings
CREATE POLICY "Admin write access for global_settings" 
ON global_settings FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM outlet_staff 
        WHERE outlet_staff.id = auth.uid() 
        AND outlet_staff.role = 'admin'
    )
);

-- Add amount_received and change_amount to orders table for walk-in cash payments
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS amount_received NUMERIC,
ADD COLUMN IF NOT EXISTS change_amount NUMERIC;
