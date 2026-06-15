-- Permintaan bahan baku: outlet menginisiasi, kitchen approve.
CREATE TABLE permintaan_bahan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  dibuat_oleh UUID NOT NULL REFERENCES outlet_staff(id),
  status TEXT NOT NULL DEFAULT 'menunggu'
    CHECK (status IN ('menunggu','disetujui','ditolak')),
  catatan_kitchen TEXT,
  surat_jalan_id UUID REFERENCES surat_jalan(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permintaan_outlet ON permintaan_bahan(outlet_id);
CREATE INDEX idx_permintaan_status ON permintaan_bahan(status);
CREATE INDEX idx_permintaan_created ON permintaan_bahan(created_at DESC);

CREATE TABLE permintaan_bahan_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permintaan_id UUID NOT NULL REFERENCES permintaan_bahan(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id) ON DELETE RESTRICT,
  qty_diminta NUMERIC NOT NULL CHECK (qty_diminta > 0),
  qty_disetujui NUMERIC CHECK (qty_disetujui IS NULL OR qty_disetujui >= 0),
  UNIQUE(permintaan_id, bahan_baku_id)
);

CREATE INDEX idx_permintaan_item_permintaan ON permintaan_bahan_item(permintaan_id);
