-- Membuat tabel global_settings
CREATE TABLE IF NOT EXISTS global_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Drop policies if exist
DROP POLICY IF EXISTS "global_settings_select_public" ON global_settings;
DROP POLICY IF EXISTS "global_settings_all_admin" ON global_settings;

-- Create policies
CREATE POLICY "global_settings_select_public" ON global_settings FOR SELECT USING (true);
CREATE POLICY "global_settings_all_admin" ON global_settings FOR ALL USING (get_user_role() = 'admin');

-- Seed default values
INSERT INTO global_settings (key, value)
VALUES 
  ('brand_name', 'SHAWARMA'),
  ('brand_logo', null)
ON CONFLICT (key) DO NOTHING;
