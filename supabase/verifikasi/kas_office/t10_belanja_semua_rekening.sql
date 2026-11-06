-- Uji 20261106120000: pengeluaran Buku Kas bisa dibayar dari 5 rekening pusat aktif;
-- rekening lama tetap ditolak. Berakhir ROLLBACK. Penanda keberhasilan: 'KONTROL: T10 ...'.
BEGIN;
DO $$
DECLARE
  c_fin  uuid := '7fa90a19-3951-426f-b088-30cc536cffad';
  c_lama uuid := '0c116d5f-f147-4eff-9bc2-ce9d549e2869';
  l record; s0 numeric; s1 numeric; n int := 0; v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  FOR l IN SELECT id, label FROM cash_location WHERE is_active AND grup IS NOT NULL LOOP
    SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = l.id), 0) INTO s0;
    INSERT INTO expenses (outlet_id, category, amount, description, expense_date, period_month, type, payment_source, cash_location_id, receipt_url)
    VALUES (NULL, 'pengeluaran_global', 1000, 'UJI T10', '2026-11-06', '2026-11-01', 'expense', 'petty_cash', l.id, 'b')
    RETURNING id INTO v_id;
    SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = l.id;
    IF s1 <> s0 - 1000 THEN RAISE EXCEPTION 'T10a: saldo % bergeser %', l.label, s1 - s0; END IF;
    n := n + 1;
  END LOOP;
  IF n <> 5 THEN RAISE EXCEPTION 'T10b: rekening pusat aktif % (harap 5)', n; END IF;
  BEGIN
    UPDATE expenses SET cash_location_id = c_lama WHERE id = v_id; RAISE EXCEPTION 'T10c LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%nonaktif%' THEN RAISE; END IF; END;
  RAISE EXCEPTION 'KONTROL: T10 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
