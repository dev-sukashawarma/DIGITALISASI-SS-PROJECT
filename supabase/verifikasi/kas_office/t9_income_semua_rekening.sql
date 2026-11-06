-- Uji: Income Lainnya bisa masuk ke 5 rekening pusat aktif; rekening lama ditolak. Berakhir ROLLBACK.
-- Penanda keberhasilan: pesan 'KONTROL: T9 ...'.
BEGIN;
DO $$
DECLARE
  c_fin  uuid := '7fa90a19-3951-426f-b088-30cc536cffad';
  c_lama uuid := '0c116d5f-f147-4eff-9bc2-ce9d549e2869';
  l record; s0 numeric; s1 numeric; n int := 0;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  FOR l IN SELECT id, label FROM cash_location WHERE is_active AND grup IS NOT NULL LOOP
    SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = l.id), 0) INTO s0;
    PERFORM record_income_lainnya(now(), 'kardus_bekas', NULL, 'Uji', NULL, 1000, l.id, 'b');
    SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = l.id;
    IF s1 <> s0 + 1000 THEN RAISE EXCEPTION 'T9a: saldo % bergeser %', l.label, s1 - s0; END IF;
    n := n + 1;
  END LOOP;
  IF n <> 5 THEN RAISE EXCEPTION 'T9b: rekening pusat aktif % (harap 5)', n; END IF;
  BEGIN PERFORM record_income_lainnya(now(), 'kardus_bekas', NULL, 'X', NULL, 1000, c_lama, 'b'); RAISE EXCEPTION 'T9c LOLOS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%rekening pusat yang aktif%' THEN RAISE; END IF; END;
  RAISE EXCEPTION 'KONTROL: T9 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
