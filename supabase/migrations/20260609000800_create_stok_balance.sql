-- Materialized current balance per outlet+bahan. Maintained by ledger triggers
-- (Task 3) and a nightly recompute job (Task: nightly, optional).
CREATE TABLE stok_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id) ON DELETE CASCADE,
  saldo NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(outlet_id, bahan_baku_id)
);

CREATE INDEX idx_stok_balance_outlet ON stok_balance(outlet_id);
