-- Uji kas kecil RAB (migration 20261111160000). Selalu di-rollback lewat RAISE.
-- Hasil yang diharapkan: 'LULUS: ...'.
-- Baris uji ber-status 'approved': fungsi laba hanya menghitung kas kecil approved.
DO $$
DECLARE
  v_mitra uuid; v_crew uuid; v_admin uuid; v_oct uuid; v_gagal text := '';
  v_sum_sebelum jsonb; v_sum_sesudah jsonb;
  v_roi_sebelum numeric; v_roi_sesudah numeric;
BEGIN
  SELECT id INTO v_mitra FROM outlets WHERE type = 'mitra' AND is_active ORDER BY name LIMIT 1;
  SELECT id INTO v_crew FROM outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  SELECT id INTO v_admin FROM outlet_staff WHERE role = 'admin' AND status = 'active' LIMIT 1;

  -- Angka laba sebelum, dilihat sebagai admin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_sum_sebelum := get_owner_dashboard_summary(timestamptz '2026-11-01 00:00+07', now(), v_mitra, NULL, NULL);
  SELECT opex INTO v_roi_sebelum FROM get_mitra_roi(ARRAY[v_mitra], timestamptz '2026-08-01 00:00+07', now());
  PERFORM set_config('request.jwt.claims', '', true);

  -- (a) kategori rab tapi type expense -> ditolak
  BEGIN
    INSERT INTO petty_cash_expenses (outlet_id, category, type, amount, description, expense_date, status)
    VALUES (v_mitra, 'rab', 'expense', 1000, 'uji a', DATE '2026-11-11', 'approved');
    v_gagal := v_gagal || ' a';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (b) kas kecil RAB sah (service role) -> masuk, laba TIDAK berubah
  INSERT INTO petty_cash_expenses (outlet_id, category, type, amount, description, expense_date, status)
  VALUES (v_mitra, 'rab', 'rab', 7000000, 'uji b', DATE '2026-11-11', 'approved');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_sum_sesudah := get_owner_dashboard_summary(timestamptz '2026-11-01 00:00+07', now(), v_mitra, NULL, NULL);
  SELECT opex INTO v_roi_sesudah FROM get_mitra_roi(ARRAY[v_mitra], timestamptz '2026-08-01 00:00+07', now());
  PERFORM set_config('request.jwt.claims', '', true);
  IF v_sum_sesudah IS DISTINCT FROM v_sum_sebelum THEN v_gagal := v_gagal || ' b-ringkasan'; END IF;
  IF v_roi_sesudah IS DISTINCT FROM v_roi_sebelum THEN v_gagal := v_gagal || ' b-roi'; END IF;

  -- (c) kontrol: kas kecil biasa Rp 7 juta HARUS mengubah ringkasan (uji bisa gagal)
  INSERT INTO petty_cash_expenses (outlet_id, category, type, amount, description, expense_date, status)
  VALUES (v_mitra, 'lainnya', 'expense', 7000000, 'uji c', DATE '2026-11-11', 'approved');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  IF get_owner_dashboard_summary(timestamptz '2026-11-01 00:00+07', now(), v_mitra, NULL, NULL) = v_sum_sebelum THEN
    v_gagal := v_gagal || ' c-kontrol';
  END IF;
  PERFORM set_config('request.jwt.claims', '', true);

  -- (d) kas kecil Oktober (closing) ditandai RAB -> ditolak
  INSERT INTO petty_cash_expenses (outlet_id, category, type, amount, description, expense_date, status)
  VALUES (v_mitra, 'lainnya', 'expense', 1000, 'uji d', DATE '2026-10-15', 'approved') RETURNING id INTO v_oct;
  BEGIN
    UPDATE petty_cash_expenses SET category = 'rab', type = 'rab' WHERE id = v_oct;
    v_gagal := v_gagal || ' d';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (e) crew mencatat kas kecil RAB lewat klien -> ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  BEGIN
    INSERT INTO petty_cash_expenses (outlet_id, category, type, amount, description, expense_date, status)
    VALUES (v_mitra, 'rab', 'rab', 1000, 'uji e', DATE '2026-11-11', 'approved');
    v_gagal := v_gagal || ' e';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claims', '', true);

  IF v_gagal <> '' THEN RAISE EXCEPTION 'GAGAL kasus:%', v_gagal; END IF;
  RAISE EXCEPTION 'LULUS: kas kecil RAB, 5 kasus (di-rollback)';
END $$;
