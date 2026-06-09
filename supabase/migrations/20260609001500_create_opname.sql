CREATE TABLE opname (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')::date,
  tipe TEXT NOT NULL DEFAULT 'harian' CHECK (tipe IN ('harian','mingguan','ad_hoc')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized')),
  created_by UUID REFERENCES outlet_staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE UNIQUE INDEX uniq_opname_harian_per_day
  ON opname(outlet_id, tanggal) WHERE tipe = 'harian';

CREATE INDEX idx_opname_outlet_tanggal ON opname(outlet_id, tanggal DESC);
CREATE INDEX idx_opname_status ON opname(status);

CREATE TABLE opname_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id UUID NOT NULL REFERENCES opname(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id) ON DELETE RESTRICT,
  qty_fisik NUMERIC,
  qty_system NUMERIC NOT NULL DEFAULT 0,
  selisih NUMERIC GENERATED ALWAYS AS (COALESCE(qty_fisik,0) - qty_system) STORED,
  flagged BOOLEAN NOT NULL DEFAULT false,
  catatan TEXT,
  UNIQUE(opname_id, bahan_baku_id)
);

CREATE INDEX idx_opname_item_opname ON opname_item(opname_id);
