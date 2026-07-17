-- 20260720000000_fix_ledger_stamp_saldo_pemakaian.sql
-- Fix ledger_stamp_saldo trigger to allow 'pemakaian' to result in negative balance, 
-- preventing "Stok tidak cukup" errors during POS order updates (penjualan otomatis)

CREATE OR REPLACE FUNCTION ledger_stamp_saldo() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_saldo NUMERIC;
DECLARE bahan_nama TEXT;
DECLARE bahan_satuan TEXT;
BEGIN
  -- Increment atomik: ON CONFLICT memegang row-lock stok_balance
  INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id, NEW.qty, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id)
  DO UPDATE SET saldo = stok_balance.saldo + NEW.qty, updated_at = NOW()
  RETURNING saldo INTO new_saldo;

  NEW.saldo_sesudah := new_saldo;
  NEW.saldo_sebelum := new_saldo - NEW.qty;

  -- Guard no-negative-balance
  -- Allow 'pemakaian' (sales from POS) to create negative balance
  IF NEW.saldo_sesudah < 0
    AND NEW.tipe NOT IN ('opname_selisih', 'rejected_kiriman', 'pemakaian')
  THEN
    SELECT nama, satuan INTO bahan_nama, bahan_satuan 
    FROM bahan_baku WHERE id = NEW.bahan_baku_id;
    
    RAISE EXCEPTION 'Stok "%" tidak cukup: saldo saat ini % %, pengurangan % %',
      bahan_nama, trim_scale(NEW.saldo_sebelum), bahan_satuan,
      trim_scale(ABS(NEW.qty)), bahan_satuan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
