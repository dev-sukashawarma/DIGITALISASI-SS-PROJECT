-- Uji Task 4: penjaga grup di record_cash_deposit & finance_process_petty_cash(_custom).
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
BEGIN
  SELECT id INTO c_topup FROM petty_cash_topups WHERE status = 'forwarded_to_finance' LIMIT 1;
  IF c_topup IS NULL THEN RAISE EXCEPTION 'T4: tak ada fixture topup forwarded_to_finance'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);

  BEGIN PERFORM record_cash_deposit(c_office_cash, 10000, c_outlet); RAISE EXCEPTION 'T4a LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Kas Setoran Outlet%' THEN RAISE; END IF; END;
  PERFORM record_cash_deposit(c_setoran, 10000, c_outlet);  -- T4b: harus lolos

  BEGIN PERFORM finance_process_petty_cash(c_topup, 'approve', 'transfer', c_setoran); RAISE EXCEPTION 'T4c LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Kas Office%' THEN RAISE; END IF; END;
  BEGIN PERFORM finance_process_petty_cash_custom(c_topup, 'approve', 'transfer', c_setoran); RAISE EXCEPTION 'T4d LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Kas Office%' THEN RAISE; END IF; END;
  PERFORM finance_process_petty_cash_custom(c_topup, 'approve', 'transfer', c_office_bank);  -- T4e: lolos

  RAISE EXCEPTION 'KONTROL: T4 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
