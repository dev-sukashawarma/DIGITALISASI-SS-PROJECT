-- Uji Task 3: record_income_lainnya & batal_income_lainnya. Berakhir ROLLBACK.
-- Penanda keberhasilan: pesan 'KONTROL: T3 ...'.
BEGIN;
DO $$
DECLARE
  c_fin    uuid := '7fa90a19-3951-426f-b088-30cc536cffad';
  c_crew   uuid := '50151804-ff12-4ef3-bbac-f2129ff2e05c';
  c_office uuid := 'b0000000-0ff1-4c0e-9a11-5e70a0000003';
  c_bank   uuid := 'b0955193-7630-4c0e-9a11-5e70a0000001';
  o0 numeric; o1 numeric; v uuid; r record;
BEGIN
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_office),0) INTO o0;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);

  v := record_income_lainnya(now(), 'kardus_bekas', NULL, 'Pengepul', NULL, 150000, c_office, 'bukti.jpg');
  SELECT saldo INTO o1 FROM cash_balance WHERE cash_location_id = c_office;
  IF o1 <> o0 + 150000 THEN RAISE EXCEPTION 'T3a: saldo office +%', o1 - o0; END IF;

  BEGIN PERFORM record_income_lainnya(now(), 'kardus_bekas', NULL, 'X', NULL, 1000, c_bank, 'b'); RAISE EXCEPTION 'T3b LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Rekening Petty Cash%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_income_lainnya(now(), 'lainnya', ' ', 'X', NULL, 1000, c_office, 'b'); RAISE EXCEPTION 'T3c LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Keterangan%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_income_lainnya(now(), 'kardus_bekas', NULL, 'X', NULL, 1000, c_office, ''); RAISE EXCEPTION 'T3d LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Bukti%' THEN RAISE; END IF; END;

  PERFORM batal_income_lainnya(v, 'salah input');
  SELECT saldo INTO o1 FROM cash_balance WHERE cash_location_id = c_office;
  IF o1 <> o0 THEN RAISE EXCEPTION 'T3e: saldo tak kembali, selisih %', o1 - o0; END IF;
  SELECT * INTO r FROM income_lainnya WHERE id = v;
  IF r.status <> 'batal' OR r.batal_by IS DISTINCT FROM c_fin OR r.batal_at IS NULL THEN
    RAISE EXCEPTION 'T3f: jejak batal tak lengkap';
  END IF;
  BEGIN PERFORM batal_income_lainnya(v, 'lagi'); RAISE EXCEPTION 'T3g LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%sudah dibatalkan%' THEN RAISE; END IF; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_crew, 'role', 'authenticated')::text, true);
  BEGIN PERFORM record_income_lainnya(now(), 'kardus_bekas', NULL, 'X', NULL, 1000, c_office, 'b'); RAISE EXCEPTION 'T3h LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%Hanya admin finance%' THEN RAISE; END IF; END;

  RAISE EXCEPTION 'KONTROL: T3 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
