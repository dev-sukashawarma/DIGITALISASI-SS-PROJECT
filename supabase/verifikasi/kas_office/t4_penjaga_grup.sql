-- Uji Task 4 (+ 20261105107000; jalankan sesudah 106000 & 107000 diterapkan): penjaga grup di record_cash_deposit & finance_process_petty_cash(_custom).
-- Berakhir ROLLBACK. Penanda keberhasilan: 'KONTROL: T4 ...'.
-- Fixture topup: baris forwarded_to_finance yang ada (dikembalikan oleh ROLLBACK).
BEGIN;
DO $$
DECLARE
  c_fin    uuid := '7fa90a19-3951-426f-b088-30cc536cffad';
  c_outlet uuid := '550e8400-e29b-41d4-a716-446655440002';
  c_office_cash uuid := 'b0000000-0ff1-4c0e-9a11-5e70a0000003';
  c_office_bank uuid := 'b0955381-0040-4c0e-9a11-5e70a0000002';
  c_setoran     uuid := 'b0955193-7630-4c0e-9a11-5e70a0000001';
  c_topup uuid;
  v_amount numeric;
  v_saldo numeric;
BEGIN
  SELECT id, amount INTO c_topup, v_amount FROM petty_cash_topups
  WHERE status = 'forwarded_to_finance' LIMIT 1;
  IF c_topup IS NULL THEN RAISE EXCEPTION 'T4: tak ada fixture topup forwarded_to_finance'; END IF;

  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  BEGIN PERFORM finance_process_petty_cash(c_topup, 'reject'); RAISE EXCEPTION 'T4: bukan finance lolos';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Hanya Finance%' THEN RAISE; END IF; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);

  BEGIN PERFORM record_cash_deposit(c_office_cash, 10000, c_outlet); RAISE EXCEPTION 'T4a LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Rekening Utama%' THEN RAISE; END IF; END;
  PERFORM record_cash_deposit(c_setoran, 10000, c_outlet);  -- T4b: harus lolos

  BEGIN PERFORM finance_process_petty_cash(c_topup, 'approve', 'transfer', c_setoran); RAISE EXCEPTION 'T4c LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Petty Cash%' THEN RAISE; END IF; END;
  BEGIN PERFORM finance_process_petty_cash_custom(c_topup, 'approve', 'transfer', c_setoran); RAISE EXCEPTION 'T4d LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Petty Cash%' THEN RAISE; END IF; END;
  BEGIN PERFORM finance_process_petty_cash(c_topup, 'approve'); RAISE EXCEPTION 'T4: sumber kosong lolos';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Petty Cash%' THEN RAISE; END IF; END;
  BEGIN PERFORM finance_process_petty_cash_custom(c_topup, 'approve', 'transfer', c_office_cash); RAISE EXCEPTION 'T4: jenis kas salah lolos';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Petty Cash%' THEN RAISE; END IF; END;

  INSERT INTO cash_balance (cash_location_id, saldo) VALUES (c_office_bank, 0)
  ON CONFLICT (cash_location_id) DO UPDATE SET saldo = 0;
  BEGIN PERFORM finance_process_petty_cash_custom(c_topup, 'approve', 'transfer', c_office_bank); RAISE EXCEPTION 'T4: saldo kurang lolos';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Saldo Rekening Petty Cash tidak mencukupi%' THEN RAISE; END IF; END;

  UPDATE cash_balance SET saldo = v_amount WHERE cash_location_id = c_office_bank;
  PERFORM finance_process_petty_cash_custom(c_topup, 'approve', 'transfer', c_office_bank);
  SELECT saldo INTO v_saldo FROM cash_balance WHERE cash_location_id = c_office_bank;
  IF v_saldo IS DISTINCT FROM 0 OR NOT EXISTS (
    SELECT 1 FROM cash_transaction WHERE source_type = 'petty_cash_topup' AND source_id = c_topup
      AND cash_location_id = c_office_bank AND direction = 'out' AND status = 'paid' AND amount = v_amount
  ) THEN RAISE EXCEPTION 'T4: pencairan tidak mengurangi saldo Office'; END IF;
  BEGIN PERFORM finance_process_petty_cash_custom(c_topup, 'approve', 'transfer', c_office_bank); RAISE EXCEPTION 'T4: pencairan ulang lolos';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%tidak siap diproses%' THEN RAISE; END IF; END;

  RAISE EXCEPTION 'KONTROL: T4 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
