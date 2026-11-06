-- Uji 20261105106000: tiga rekening (Utama, Bahan Baku, Petty Cash). Berakhir ROLLBACK.
-- Penanda keberhasilan: 'KONTROL: T6 ...'.
BEGIN;
DO $$
DECLARE
  c_fin     uuid := '7fa90a19-3951-426f-b088-30cc536cffad';
  c_outlet  uuid := '550e8400-e29b-41d4-a716-446655440002';
  c_utama   uuid := 'b0955193-7630-4c0e-9a11-5e70a0000001';
  c_bb_bank uuid := 'b0955353-1240-4c0e-9a11-5e70a0000004';
  c_bb_cash uuid := 'a64f9484-70e9-4bf7-b62d-2643835a1874';
  c_pc_bank uuid := 'b0955381-0040-4c0e-9a11-5e70a0000002';
  c_pc_cash uuid := 'b0000000-0ff1-4c0e-9a11-5e70a0000003';
  bb0 numeric; bk0 numeric; pc0 numeric; bb1 numeric; bk1 numeric; pc1 numeric; n int; c_topup uuid;
BEGIN
  -- (a) pemetaan grup & label
  SELECT count(*) INTO n FROM cash_location WHERE is_active AND (
       (id = c_utama   AND grup = 'utama'      AND kind = 'bank' AND label = 'Rekening Utama 0955193763')
    OR (id = c_bb_bank AND grup = 'bahan_baku' AND kind = 'bank' AND account_no = '0955353124')
    OR (id = c_bb_cash AND grup = 'bahan_baku' AND kind = 'cash' AND label = 'Rekening Bahan Baku Tunai')
    OR (id = c_pc_bank AND grup = 'petty_cash' AND kind = 'bank' AND label = 'Rekening Petty Cash 0955381004')
    OR (id = c_pc_cash AND grup = 'petty_cash' AND kind = 'cash' AND label = 'Rekening Petty Cash Tunai'));
  IF n <> 5 THEN RAISE EXCEPTION 'T6a: pemetaan rekening % dari 5', n; END IF;
  IF EXISTS (SELECT 1 FROM cash_location WHERE grup IN ('setoran_outlet','office')) THEN
    RAISE EXCEPTION 'T6a: grup lama masih ada';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);

  -- (b) setoran: transfer → Utama, tunai → Bahan Baku Tunai; lainnya ditolak
  PERFORM record_cash_deposit(c_utama, 10000, c_outlet);
  PERFORM record_cash_deposit(c_bb_cash, 10000, c_outlet);
  BEGIN PERFORM record_cash_deposit(c_bb_bank, 10000, c_outlet); RAISE EXCEPTION 'T6b: setoran ke Bahan Baku Bank LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Rekening Utama%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_cash_deposit(c_pc_cash, 10000, c_outlet); RAISE EXCEPTION 'T6b: setoran ke Petty Cash LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Rekening Utama%' THEN RAISE; END IF; END;

  -- (c) setor ke bank: Bahan Baku Tunai → Bahan Baku Bank, receh → Petty Cash Tunai
  INSERT INTO cash_balance (cash_location_id, saldo) VALUES (c_bb_cash, 5000000)
  ON CONFLICT (cash_location_id) DO UPDATE SET saldo = GREATEST(cash_balance.saldo, 5000000);
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_bb_cash),0) INTO bb0;
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_bb_bank),0) INTO bk0;
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_pc_cash),0) INTO pc0;
  PERFORM record_setor_bank(1237500, 1200000, 'bukti.jpg');
  SELECT saldo INTO bb1 FROM cash_balance WHERE cash_location_id = c_bb_cash;
  SELECT saldo INTO bk1 FROM cash_balance WHERE cash_location_id = c_bb_bank;
  SELECT saldo INTO pc1 FROM cash_balance WHERE cash_location_id = c_pc_cash;
  IF bb1 <> bb0 - 1237500 OR bk1 <> bk0 + 1200000 OR pc1 <> pc0 + 37500 THEN
    RAISE EXCEPTION 'T6c: setor bank salah tunai % bank % receh %', bb1 - bb0, bk1 - bk0, pc1 - pc0;
  END IF;

  -- (d) income lainnya: sejak 20261106110000 boleh ke rekening pusat mana pun (lihat t9)
  PERFORM record_income_lainnya(now(), 'kardus_bekas', NULL, 'X', NULL, 1000, c_bb_cash, 'b');

  -- (e) pencairan petty cash: dari Bahan Baku ditolak
  SELECT id INTO c_topup FROM petty_cash_topups WHERE status = 'forwarded_to_finance' LIMIT 1;
  IF c_topup IS NOT NULL THEN
    BEGIN PERFORM finance_process_petty_cash_custom(c_topup, 'approve', 'transfer', c_bb_bank); RAISE EXCEPTION 'T6e LOLOS';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Petty Cash%' THEN RAISE; END IF; END;
  END IF;

  RAISE EXCEPTION 'KONTROL: T6 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
