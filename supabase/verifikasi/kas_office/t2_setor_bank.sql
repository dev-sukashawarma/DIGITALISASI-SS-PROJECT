-- Uji Task 2: record_setor_bank. Berakhir ROLLBACK.
-- Penanda keberhasilan: pesan 'KONTROL: T2 ...' (sengaja dilempar di akhir).
BEGIN;
DO $$
DECLARE
  c_fin    uuid := '7fa90a19-3951-426f-b088-30cc536cffad';  -- admin_finance aktif
  c_leader uuid := 'eb278581-f4db-466d-a76a-6e730beb6eac';  -- leader aktif
  c_tunai  uuid := 'a64f9484-70e9-4bf7-b62d-2643835a1874';
  c_bank   uuid := 'b0955193-7630-4c0e-9a11-5e70a0000001';
  c_office uuid := 'b0000000-0ff1-4c0e-9a11-5e70a0000003';
  s0 numeric; b0 numeric; o0 numeric; s1 numeric; b1 numeric; o1 numeric; v uuid; n int;
BEGIN
  -- Fixture: pastikan saldo tunai cukup (dibatalkan ROLLBACK).
  INSERT INTO cash_balance (cash_location_id, saldo) VALUES (c_tunai, 5000000)
  ON CONFLICT (cash_location_id) DO UPDATE SET saldo = GREATEST(cash_balance.saldo, 5000000);
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_tunai),0) INTO s0;
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_bank),0) INTO b0;
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_office),0) INTO o0;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);

  -- (a) skenario normal
  v := record_setor_bank(1237500, 1200000, 'bukti.jpg', 'uji');
  SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = c_tunai;
  SELECT saldo INTO b1 FROM cash_balance WHERE cash_location_id = c_bank;
  SELECT saldo INTO o1 FROM cash_balance WHERE cash_location_id = c_office;
  IF s1 <> s0 - 1237500 OR b1 <> b0 + 1200000 OR o1 <> o0 + 37500 THEN
    RAISE EXCEPTION 'T2a: saldo salah tunai % bank % office %', s1 - s0, b1 - b0, o1 - o0;
  END IF;

  -- (g) tanpa receh → 2 baris saja
  v := record_setor_bank(100000, 100000, 'bukti.jpg');
  SELECT count(*) INTO n FROM cash_transaction WHERE source_id = v;
  IF n <> 2 THEN RAISE EXCEPTION 'T2g: tanpa receh menulis % baris', n; END IF;

  BEGIN PERFORM record_setor_bank(1237500, 1225000, 'b'); RAISE EXCEPTION 'T2b LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%kelipatan%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_setor_bank(999999999, 50000, 'b'); RAISE EXCEPTION 'T2c LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%melebihi saldo%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_setor_bank(50000, 100000, 'b'); RAISE EXCEPTION 'T2d LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%melebihi uang%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_setor_bank(100000, 100000, ' '); RAISE EXCEPTION 'T2e LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Bukti%' THEN RAISE; END IF; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_leader, 'role', 'authenticated')::text, true);
  BEGIN PERFORM record_setor_bank(100000, 100000, 'b'); RAISE EXCEPTION 'T2f LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Hanya admin finance%' THEN RAISE; END IF; END;

  RAISE EXCEPTION 'KONTROL: T2 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
