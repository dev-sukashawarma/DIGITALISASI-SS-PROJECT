-- Migration: 20260728000300_optimize_ledger_trigger_case4.sql
-- Description: Optimization for Case 4 (Atomic High-Performance Ledger Balance Stamping)
-- Safe to apply: Re-asserts atomic UPSERT with zero-alloc exception paths.

CREATE OR REPLACE FUNCTION public.ledger_stamp_saldo() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_saldo NUMERIC;
DECLARE bahan_nama TEXT;
DECLARE bahan_satuan TEXT;
BEGIN
  -- Atomic ON CONFLICT UPSERT holding PK row-lock on stok_balance
  INSERT INTO public.stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id, NEW.qty, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id)
  DO UPDATE SET saldo = stok_balance.saldo + NEW.qty, updated_at = NOW()
  RETURNING saldo INTO new_saldo;

  NEW.saldo_sesudah := new_saldo;
  NEW.saldo_sebelum := new_saldo - NEW.qty;

  -- Fast path check: Exception lookup only triggers on negative balance violation
  IF NEW.saldo_sesudah < 0
    AND NEW.tipe NOT IN ('opname_selisih', 'rejected_kiriman', 'pemakaian')
  THEN
    SELECT nama, satuan INTO bahan_nama, bahan_satuan 
    FROM public.bahan_baku WHERE id = NEW.bahan_baku_id;
    
    RAISE EXCEPTION 'Stok "%" tidak cukup: saldo saat ini % %, pengurangan % %',
      bahan_nama, trim_scale(NEW.saldo_sebelum), bahan_satuan,
      trim_scale(ABS(NEW.qty)), bahan_satuan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
