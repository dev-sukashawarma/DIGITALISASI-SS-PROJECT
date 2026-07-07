-- Create global_settings table
CREATE TABLE IF NOT EXISTS global_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Configuration
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
DROP POLICY IF EXISTS "Allow authenticated users to read global_settings" ON global_settings;
CREATE POLICY "Allow authenticated users to read global_settings"
ON global_settings FOR SELECT
TO authenticated
USING (true);

-- Allow write access to authenticated users (leaders/admins can write, this could be restricted by role later)
DROP POLICY IF EXISTS "Allow authenticated users to update global_settings" ON global_settings;
CREATE POLICY "Allow authenticated users to update global_settings"
ON global_settings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Insert initial values if they don't exist
INSERT INTO global_settings (key, value)
VALUES 
    ('brand_name', '"Suka Shawarma"'),
    ('brand_logo', 'null')
ON CONFLICT (key) DO NOTHING;
