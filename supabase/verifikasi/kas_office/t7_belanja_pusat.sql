-- Uji 20261105130000: belanja pusat dari Rekening Petty Cash. Jalankan sesudah migration.
-- Berakhir ROLLBACK. Penanda keberhasilan: 'KONTROL: T7 ...'.
BEGIN;
DO $$
DECLARE
  c_fin   uuid := '7fa90a19-3951-426f-b088-30cc536cffad';   -- admin_finance aktif
  c_crew  uuid := '50151804-ff12-4ef3-bbac-f2129ff2e05c';   -- crew aktif
  c_pc    uuid := 'b0955381-0040-4c0e-9a11-5e70a0000002';   -- Rekening Petty Cash Bank
  c_pct   uuid := 'b0000000-0ff1-4c0e-9a11-5e70a0000003';   -- Rekening Petty Cash Tunai
  c_bb    uuid := 'b0955353-1240-4c0e-9a11-5e70a0000004';   -- Rekening Bahan Baku Bank
  c_old   uuid := '0c116d5f-f147-4eff-9bc2-ce9d549e2869';   -- rekening lama (nonaktif)
  s0 numeric; t0 numeric; s numeric; t numeric; v_id uuid; v_id2 uuid; n int;
BEGIN
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_pc),0) INTO s0;
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_pct),0) INTO t0;

  -- (a) service role (auth.uid() NULL): simpan -> saldo turun, 1 transaksi paid
  INSERT INTO expenses (outlet_id, category, amount, description, expense_date, period_month, type, payment_source, cash_location_id, receipt_url)
  VALUES (NULL, 'pengeluaran_global', 120000, 'UJI gas kitchen', '2026-11-05', '2026-11-01', 'expense', 'petty_cash', c_pc, 'bukti.jpg')
  RETURNING id INTO v_id;
  SELECT saldo INTO s FROM cash_balance WHERE cash_location_id = c_pc;
  IF s <> s0 - 120000 THEN RAISE EXCEPTION 'T7a: saldo %, harus %', s, s0 - 120000; END IF;
  SELECT count(*) INTO n FROM cash_transaction WHERE source_type='expense_pusat' AND source_id=v_id AND status='paid'
     AND occurred_at = '2026-11-05 12:00+07' AND proof_url = 'bukti.jpg';
  IF n <> 1 THEN RAISE EXCEPTION 'T7a: transaksi paid = %', n; END IF;

  -- (b) ubah nominal -> transaksi lama void, baru paid, saldo ikut
  UPDATE expenses SET amount = 150000 WHERE id = v_id;
  SELECT saldo INTO s FROM cash_balance WHERE cash_location_id = c_pc;
  IF s <> s0 - 150000 THEN RAISE EXCEPTION 'T7b: saldo %', s; END IF;
  SELECT count(*) INTO n FROM cash_transaction WHERE source_type='expense_pusat' AND source_id=v_id AND status<>'void';
  IF n <> 1 THEN RAISE EXCEPTION 'T7b: transaksi aktif = %', n; END IF;

  -- (c) pindah ke Petty Cash Tunai
  UPDATE expenses SET cash_location_id = c_pct WHERE id = v_id;
  SELECT saldo INTO s FROM cash_balance WHERE cash_location_id = c_pc;
  SELECT saldo INTO t FROM cash_balance WHERE cash_location_id = c_pct;
  IF s <> s0 OR t <> t0 - 150000 THEN RAISE EXCEPTION 'T7c: bank % tunai %', s - s0, t - t0; END IF;

  -- (d) ubah keterangan saja -> tetap 1 transaksi aktif, saldo tetap
  UPDATE expenses SET description = 'UJI gas kitchen 2' WHERE id = v_id;
  SELECT saldo INTO t FROM cash_balance WHERE cash_location_id = c_pct;
  SELECT count(*) INTO n FROM cash_transaction WHERE source_type='expense_pusat' AND source_id=v_id AND status<>'void';
  IF t <> t0 - 150000 OR n <> 1 THEN RAISE EXCEPTION 'T7d: tunai % aktif %', t - t0, n; END IF;

  -- (e) lepas rekening -> saldo kembali
  UPDATE expenses SET cash_location_id = NULL WHERE id = v_id;
  SELECT saldo INTO t FROM cash_balance WHERE cash_location_id = c_pct;
  IF t <> t0 THEN RAISE EXCEPTION 'T7e: tunai %', t - t0; END IF;

  -- (f) hapus -> transaksi di-void, saldo kembali
  UPDATE expenses SET cash_location_id = c_pc WHERE id = v_id;
  DELETE FROM expenses WHERE id = v_id;
  SELECT saldo INTO s FROM cash_balance WHERE cash_location_id = c_pc;
  SELECT count(*) INTO n FROM cash_transaction WHERE source_type='expense_pusat' AND source_id=v_id AND status<>'void';
  IF s <> s0 OR n <> 0 THEN RAISE EXCEPTION 'T7f: saldo % aktif %', s - s0, n; END IF;

  -- (g) pengeluaran tanpa rekening -> tidak ada transaksi kas (perilaku lama)
  INSERT INTO expenses (outlet_id, category, amount, description, expense_date, period_month, type, payment_source)
  VALUES (NULL, 'pengeluaran_global', 50000, 'UJI tanpa rekening', '2026-11-05', '2026-11-01', 'expense', 'transfer_pusat')
  RETURNING id INTO v_id2;
  SELECT count(*) INTO n FROM cash_transaction WHERE source_id = v_id2;
  IF n <> 0 THEN RAISE EXCEPTION 'T7g: muncul % transaksi', n; END IF;

  -- (h) penolakan
  BEGIN UPDATE expenses SET cash_location_id = c_bb WHERE id = v_id2; RAISE EXCEPTION 'T7h1 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%Rekening Petty Cash%' THEN RAISE; END IF; END;
  BEGIN UPDATE expenses SET cash_location_id = c_old WHERE id = v_id2; RAISE EXCEPTION 'T7h2 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%nonaktif%' THEN RAISE; END IF; END;
  BEGIN UPDATE expenses SET cash_location_id = c_pc, type = 'office_advance' WHERE id = v_id2; RAISE EXCEPTION 'T7h3 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%type expense%' THEN RAISE; END IF; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_crew, 'role', 'authenticated')::text, true);
  BEGIN UPDATE expenses SET cash_location_id = c_pc WHERE id = v_id2; RAISE EXCEPTION 'T7h4 crew LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- (i) admin_finance ber-login boleh
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  UPDATE expenses SET cash_location_id = c_pc WHERE id = v_id2;
  SELECT saldo INTO s FROM cash_balance WHERE cash_location_id = c_pc;
  IF s <> s0 - 50000 THEN RAISE EXCEPTION 'T7i: saldo %', s - s0; END IF;

  RAISE EXCEPTION 'KONTROL: T7 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
