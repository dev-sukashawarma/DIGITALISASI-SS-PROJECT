-- Uji 20261106100000: top up saldo rekening pusat. Jalankan sesudah migration. Berakhir ROLLBACK.
-- Penanda keberhasilan: 'KONTROL: T8 ...'.
BEGIN;
DO $$
DECLARE
  c_fin  uuid := '7fa90a19-3951-426f-b088-30cc536cffad';
  c_crew uuid := '50151804-ff12-4ef3-bbac-f2129ff2e05c';
  c_pc   uuid := 'b0955381-0040-4c0e-9a11-5e70a0000002';
  c_old  uuid := '0c116d5f-f147-4eff-9bc2-ce9d549e2869';
  s0 numeric; s numeric; v uuid;
BEGIN
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_pc), 0) INTO s0;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  v := record_top_up_saldo(c_pc, 2000000, 'Owner', 'bukti.jpg', 'uji');
  SELECT saldo INTO s FROM cash_balance WHERE cash_location_id = c_pc;
  IF s <> s0 + 2000000 THEN RAISE EXCEPTION 'T8a saldo %', s - s0; END IF;
  IF (SELECT category FROM cash_transaction WHERE id = v) <> 'Top up dari Owner' THEN RAISE EXCEPTION 'T8a kategori'; END IF;
  BEGIN PERFORM record_top_up_saldo(c_pc, 1000, ' ', 'b'); RAISE EXCEPTION 'T8b LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%Sumber dana%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_top_up_saldo(c_pc, 1000, 'Owner', ''); RAISE EXCEPTION 'T8c LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%Bukti%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_top_up_saldo(c_old, 1000, 'Owner', 'b'); RAISE EXCEPTION 'T8d LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%rekening pusat%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_top_up_saldo(c_pc, 0, 'Owner', 'b'); RAISE EXCEPTION 'T8e LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%lebih dari 0%' THEN RAISE; END IF; END;
  PERFORM batal_top_up_saldo(v, 'salah input');
  SELECT saldo INTO s FROM cash_balance WHERE cash_location_id = c_pc;
  IF s <> s0 THEN RAISE EXCEPTION 'T8f saldo tak kembali %', s - s0; END IF;
  IF (SELECT note FROM cash_transaction WHERE id = v) NOT LIKE '%[Dibatalkan: salah input]%' THEN RAISE EXCEPTION 'T8f catatan'; END IF;
  BEGIN PERFORM batal_top_up_saldo(v, 'lagi'); RAISE EXCEPTION 'T8g LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%sudah dibatalkan%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_crew, 'role', 'authenticated')::text, true);
  BEGIN PERFORM record_top_up_saldo(c_pc, 1000, 'Owner', 'b'); RAISE EXCEPTION 'T8h crew LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE EXCEPTION 'KONTROL: T8 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
