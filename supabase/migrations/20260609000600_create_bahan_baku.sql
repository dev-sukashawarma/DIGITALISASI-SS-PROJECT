-- bahan_baku: centralized raw-material master (shared across all outlets).
-- Real list menyusul from owner; satuan/kategori CHECK values are provisional.
CREATE TABLE bahan_baku (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL UNIQUE,
  satuan TEXT NOT NULL CHECK (satuan IN ('kg','gram','liter','ml','pcs','box','pack','ikat','botol')),
  kategori TEXT NOT NULL CHECK (kategori IN ('protein','sayur','bumbu','saus','roti','kemasan','minuman','lainnya')),
  default_reorder_point NUMERIC NOT NULL DEFAULT 0 CHECK (default_reorder_point >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bahan_baku_kategori ON bahan_baku(kategori);
CREATE INDEX idx_bahan_baku_is_active ON bahan_baku(is_active);
