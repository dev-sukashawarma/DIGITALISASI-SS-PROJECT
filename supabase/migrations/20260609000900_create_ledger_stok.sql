-- Signed stock-movement ledger. qty>0 inflow, qty<0 outflow.
CREATE TABLE ledger_stok (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id) ON DELETE RESTRICT,
  tipe TEXT NOT NULL CHECK (tipe IN (
    'terima_kiriman','pemakaian','waste','adjustment',
    'opname_selisih','transfer_keluar','transfer_masuk'
  )),
  qty NUMERIC NOT NULL,
  catatan TEXT,
  ref_shipment_id UUID,
  ref_opname_id UUID,
  ref_transfer_id UUID,
  created_by UUID REFERENCES outlet_staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  saldo_sebelum NUMERIC NOT NULL DEFAULT 0,
  saldo_sesudah NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX idx_ledger_outlet_created ON ledger_stok(outlet_id, created_at DESC);
CREATE INDEX idx_ledger_bahan ON ledger_stok(bahan_baku_id);
CREATE INDEX idx_ledger_tipe ON ledger_stok(tipe);

-- BEFORE INSERT: stamp saldo_sebelum/sesudah from current balance.
CREATE OR REPLACE FUNCTION ledger_stamp_saldo() RETURNS trigger AS $$
DECLARE cur NUMERIC;
BEGIN
  SELECT saldo INTO cur FROM stok_balance
    WHERE outlet_id = NEW.outlet_id AND bahan_baku_id = NEW.bahan_baku_id;
  cur := COALESCE(cur, 0);
  NEW.saldo_sebelum := cur;
  NEW.saldo_sesudah := cur + NEW.qty;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_stamp_saldo
  BEFORE INSERT ON ledger_stok
  FOR EACH ROW EXECUTE FUNCTION ledger_stamp_saldo();

-- AFTER INSERT: upsert materialized balance.
CREATE OR REPLACE FUNCTION ledger_apply_balance() RETURNS trigger AS $$
BEGIN
  INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id, NEW.saldo_sesudah, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id)
  DO UPDATE SET saldo = NEW.saldo_sesudah, updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_apply_balance
  AFTER INSERT ON ledger_stok
  FOR EACH ROW EXECUTE FUNCTION ledger_apply_balance();
