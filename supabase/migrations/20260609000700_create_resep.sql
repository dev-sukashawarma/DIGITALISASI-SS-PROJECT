-- resep (BOM header) + resep_item (lines). Structure built in M2;
-- auto-deduction activates when POS sales feed is available (M4).
CREATE TABLE resep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_ref TEXT,                 -- links to POS menu id later (nullable now)
  nama TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global','outlet')),
  outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,  -- null when scope=global
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK ((scope = 'global' AND outlet_id IS NULL) OR (scope = 'outlet' AND outlet_id IS NOT NULL))
);

CREATE TABLE resep_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resep_id UUID NOT NULL REFERENCES resep(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id) ON DELETE RESTRICT,
  qty_per_porsi NUMERIC NOT NULL CHECK (qty_per_porsi > 0),
  satuan TEXT NOT NULL,
  UNIQUE(resep_id, bahan_baku_id)
);

CREATE INDEX idx_resep_item_resep ON resep_item(resep_id);
CREATE INDEX idx_resep_item_bahan ON resep_item(bahan_baku_id);
