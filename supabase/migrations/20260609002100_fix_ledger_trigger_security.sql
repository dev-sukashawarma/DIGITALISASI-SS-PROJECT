-- ledger_apply_balance runs as the calling user (no SECURITY DEFINER),
-- so authenticated users can't upsert stok_balance (no INSERT/UPDATE policy).
-- Re-declare as SECURITY DEFINER so the trigger always runs as the owner.
CREATE OR REPLACE FUNCTION ledger_apply_balance() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id, NEW.saldo_sesudah, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id)
  DO UPDATE SET saldo = NEW.saldo_sesudah, updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Same fix for ledger_stamp_saldo (BEFORE INSERT reads stok_balance).
CREATE OR REPLACE FUNCTION ledger_stamp_saldo() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cur NUMERIC;
BEGIN
  SELECT saldo INTO cur FROM stok_balance
    WHERE outlet_id = NEW.outlet_id AND bahan_baku_id = NEW.bahan_baku_id;
  cur := COALESCE(cur, 0);
  NEW.saldo_sebelum := cur;
  NEW.saldo_sesudah := cur + NEW.qty;
  RETURN NEW;
END;
$$;
