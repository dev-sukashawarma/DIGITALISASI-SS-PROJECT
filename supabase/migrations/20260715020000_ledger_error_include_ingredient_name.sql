-- Update ledger trigger to include ingredient name in error message

CREATE OR REPLACE FUNCTION trg_ledger_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_saldo NUMERIC;
BEGIN
  -- Increment atomik: ON CONFLICT memegang row-lock stok_balance sehingga order
  -- konkuren untuk (outlet, bahan) yang sama terserialisasi -- tak ada lost update.
  INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id, NEW.qty, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id)
  DO UPDATE SET saldo = stok_balance.saldo + NEW.qty, updated_at = NOW()
  RETURNING saldo INTO new_saldo;

  NEW.saldo_sesudah := new_saldo;
  NEW.saldo_sebelum := new_saldo - NEW.qty;

  -- Guard no-negative-balance
  IF NEW.saldo_sesudah < 0
    AND NEW.tipe NOT IN ('opname_selisih', 'rejected_kiriman')
  THEN
    RAISE EXCEPTION 'Stok "%" tidak cukup: saldo saat ini % %, pengurangan % %',
      (SELECT nama FROM bahan_baku WHERE id = NEW.bahan_baku_id),
      NEW.saldo_sebelum, (SELECT satuan FROM bahan_baku WHERE id = NEW.bahan_baku_id),
      ABS(NEW.qty), (SELECT satuan FROM bahan_baku WHERE id = NEW.bahan_baku_id)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
