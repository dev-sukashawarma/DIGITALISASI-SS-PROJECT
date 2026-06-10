-- Surat Jalan: shipment master record
CREATE TABLE surat_jalan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','dikirim','diterima_sebagian','diterima_lengkap')),
  created_by UUID REFERENCES outlet_staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  signatures JSONB DEFAULT '[]'::jsonb,

  INDEX idx_surat_jalan_outlet ON outlet_id,
  INDEX idx_surat_jalan_status ON status,
  INDEX idx_surat_jalan_created ON created_at DESC
);

-- Surat Jalan items: line items with verification data
CREATE TABLE surat_jalan_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surat_jalan_id UUID NOT NULL REFERENCES surat_jalan(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id) ON DELETE RESTRICT,

  qty_dikirim NUMERIC NOT NULL CHECK (qty_dikirim > 0),
  qty_terima NUMERIC,

  kondisi TEXT CHECK (kondisi IN ('baik','rusak','hilang_qty')),
  selisih NUMERIC GENERATED ALWAYS AS (COALESCE(qty_terima,0) - qty_dikirim) STORED,
  flagged BOOLEAN NOT NULL DEFAULT false,

  foto_path TEXT,
  catatan TEXT,
  verified_by UUID REFERENCES outlet_staff(id),
  verified_at TIMESTAMPTZ,

  UNIQUE(surat_jalan_id, bahan_baku_id),
  INDEX idx_sj_item_sj ON surat_jalan_id,
  INDEX idx_sj_item_bahan ON bahan_baku_id
);
