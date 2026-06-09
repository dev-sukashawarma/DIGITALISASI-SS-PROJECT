-- outlets table: 19 Sukashawarma outlets (sync from Ecosystem)
CREATE TABLE outlets (
  id UUID PRIMARY KEY NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  type TEXT DEFAULT 'outlet',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_outlets_slug ON outlets(slug);
CREATE INDEX idx_outlets_is_active ON outlets(is_active);
