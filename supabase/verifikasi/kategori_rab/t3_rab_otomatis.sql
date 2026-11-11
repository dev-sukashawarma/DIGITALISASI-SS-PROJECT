-- Uji aturan RAB otomatis Mitra Karawaci (migration 20261111170000).
-- Selalu di-rollback lewat RAISE. Hasil yang diharapkan: 'LULUS: ...'.
DO $$
DECLARE
  v_kwc constant uuid := 'a85330a1-c150-4389-9a94-c23b66aaed7c';
  v_lain uuid; v_crew uuid; v_admin uuid; v_kas uuid; v_id uuid; v_tipe text; v_kat text;
  v_gagal text := ''; v_sum1 jsonb; v_sum2 jsonb; v_n int;
BEGIN
  SELECT id INTO v_lain FROM outlets WHERE type = 'mitra' AND is_active AND id <> v_kwc ORDER BY name LIMIT 1;
  SELECT id INTO v_crew FROM outlet_staff WHERE outlet_id = v_kwc AND status = 'active' AND role = 'crew' LIMIT 1;
  IF v_crew IS NULL THEN
    SELECT id INTO v_crew FROM outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  END IF;
  SELECT id INTO v_admin FROM outlet_staff WHERE role = 'admin' AND status = 'active' LIMIT 1;
  SELECT id INTO v_kas FROM cash_location WHERE grup = 'petty_cash' AND is_active LIMIT 1;

  -- (a) baris lama Karawaci: tak ada lagi pengeluaran biasa di luar pengecualian
  SELECT count(*) INTO v_n FROM (
    SELECT category FROM expenses WHERE outlet_id = v_kwc AND type = 'expense' AND expense_date <= '2026-11-30'
    UNION ALL
    SELECT category FROM petty_cash_expenses WHERE outlet_id = v_kwc AND type = 'expense' AND deleted_at IS NULL AND expense_date <= '2026-11-30'
  ) x WHERE lower(category) NOT IN ('gas','pln','pdam','internet','wifi','utilitas','utilities','sewa','sewa_outlet','endorsement');
  IF v_n <> 0 THEN v_gagal := v_gagal || ' a(' || v_n || ')'; END IF;

  -- (b) kas kecil baru Karawaci (approved) -> RAB, dan laba tidak berubah
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_sum1 := get_owner_dashboard_summary(timestamptz '2026-11-01 00:00+07', now(), v_kwc, NULL, NULL);
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO petty_cash_expenses (outlet_id, category, type, amount, description, expense_date, status)
  VALUES (v_kwc, 'pengeluaran_outlet', 'expense', 500000, 'uji b', DATE '2026-11-11', 'approved')
  RETURNING type INTO v_tipe;
  IF v_tipe <> 'rab' THEN v_gagal := v_gagal || ' b-tipe'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_sum2 := get_owner_dashboard_summary(timestamptz '2026-11-01 00:00+07', now(), v_kwc, NULL, NULL);
  PERFORM set_config('request.jwt.claims', '', true);
  IF v_sum1 IS DISTINCT FROM v_sum2 THEN v_gagal := v_gagal || ' b-laba'; END IF;

  -- (c) kas kecil gas Karawaci -> tetap OPEX
  INSERT INTO petty_cash_expenses (outlet_id, category, type, amount, description, expense_date, status)
  VALUES (v_kwc, 'gas', 'expense', 1000, 'uji c', DATE '2026-11-11', 'approved') RETURNING type INTO v_tipe;
  IF v_tipe <> 'expense' THEN v_gagal := v_gagal || ' c'; END IF;

  -- (d) crew mencatat kas kecil Karawaci lewat klien -> boleh, jadi RAB
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  BEGIN
    INSERT INTO petty_cash_expenses (outlet_id, category, type, amount, description, expense_date)
    VALUES (v_kwc, 'transport', 'expense', 1000, 'uji d', DATE '2026-11-11') RETURNING type INTO v_tipe;
    IF v_tipe <> 'rab' THEN v_gagal := v_gagal || ' d-tipe'; END IF;
  EXCEPTION WHEN OTHERS THEN v_gagal := v_gagal || ' d(' || SQLERRM || ')';
  END;
  PERFORM set_config('request.jwt.claims', '', true);

  -- (e) Buku Kas dibayar rekening pusat -> RAB, rekening TETAP terpotong
  INSERT INTO expenses (outlet_id, category, type, amount, description, expense_date, payment_source, cash_location_id)
  VALUES (v_kwc, 'transport', 'expense', 250000, 'uji e', DATE '2026-11-11', 'petty_cash', v_kas)
  RETURNING id, type INTO v_id, v_tipe;
  IF v_tipe <> 'rab' THEN v_gagal := v_gagal || ' e-tipe'; END IF;
  IF NOT EXISTS (SELECT 1 FROM cash_transaction WHERE source_type = 'expense_pusat' AND source_id = v_id AND status = 'paid' AND amount = 250000) THEN
    v_gagal := v_gagal || ' e-rekening';
  END IF;

  -- (f) sinkron ulang (mis. Marcom) menulis type 'expense' -> tetap RAB, rekening tetap
  UPDATE expenses SET type = 'expense', category = 'transport', description = 'uji f' WHERE id = v_id
  RETURNING type, category INTO v_tipe, v_kat;
  IF v_tipe <> 'rab' OR v_kat <> 'rab' THEN v_gagal := v_gagal || ' f'; END IF;
  SELECT count(*) INTO v_n FROM cash_transaction WHERE source_type = 'expense_pusat' AND source_id = v_id AND status = 'paid';
  IF v_n <> 1 THEN v_gagal := v_gagal || ' f-rekening(' || v_n || ')'; END IF;

  -- (g) Karawaci tanggal 1 Des -> di luar periode, tetap OPEX
  INSERT INTO expenses (outlet_id, category, type, amount, description, expense_date, payment_source)
  VALUES (v_kwc, 'transport', 'expense', 1000, 'uji g', DATE '2026-12-01', 'transfer_pusat') RETURNING type INTO v_tipe;
  IF v_tipe <> 'expense' THEN v_gagal := v_gagal || ' g'; END IF;

  -- (h) outlet lain -> tidak terpengaruh
  INSERT INTO petty_cash_expenses (outlet_id, category, type, amount, description, expense_date)
  VALUES (v_lain, 'transport', 'expense', 1000, 'uji h', DATE '2026-11-11') RETURNING type INTO v_tipe;
  IF v_tipe <> 'expense' THEN v_gagal := v_gagal || ' h'; END IF;

  IF v_gagal <> '' THEN RAISE EXCEPTION 'GAGAL kasus:%', v_gagal; END IF;
  RAISE EXCEPTION 'LULUS: RAB otomatis Karawaci, 8 kasus (di-rollback)';
END $$;
