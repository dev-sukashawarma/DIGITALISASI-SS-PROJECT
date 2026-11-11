-- Uji penjaga kategori RAB di expenses (migration 20261111150000, kasus (c) diubah oleh 20261111170000).
-- Selalu berakhir dengan RAISE EXCEPTION -> seluruh perubahan di-rollback.
-- Hasil yang diharapkan: pesan 'LULUS: ...'. Pesan lain = gagal.
DO $$
DECLARE
  v_outlet uuid;
  v_crew uuid;
  v_kas uuid;
  v_id uuid;
  v_oct uuid;
  v_gagal text := '';
  v_opex_sebelum numeric;
  v_opex_sesudah numeric;
BEGIN
  SELECT id INTO v_outlet FROM outlets WHERE type = 'internal' AND is_active ORDER BY name LIMIT 1;
  SELECT id INTO v_crew FROM outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  SELECT id INTO v_kas FROM cash_location WHERE grup = 'petty_cash' AND is_active LIMIT 1;
  SELECT coalesce(sum(amount), 0) INTO v_opex_sebelum FROM expenses WHERE type = 'expense';

  -- (a) kategori rab tapi type expense -> ditolak
  BEGIN
    INSERT INTO expenses (outlet_id, category, type, amount, description, expense_date, payment_source)
    VALUES (v_outlet, 'rab', 'expense', 1000, 'uji a', DATE '2026-11-11', 'transfer_pusat');
    v_gagal := v_gagal || ' a';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- (b) RAB tanpa outlet -> ditolak
  BEGIN
    INSERT INTO expenses (outlet_id, category, type, amount, description, expense_date, payment_source)
    VALUES (NULL, 'rab', 'rab', 1000, 'uji b', DATE '2026-11-11', 'transfer_pusat');
    v_gagal := v_gagal || ' b';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- (c) RAB dibayar rekening pusat -> boleh (sejak 20261111170000), rekening tetap terpotong
  INSERT INTO expenses (outlet_id, category, type, amount, description, expense_date, payment_source, cash_location_id)
  VALUES (v_outlet, 'rab', 'rab', 1000, 'uji c', DATE '2026-11-11', 'petty_cash', v_kas)
  RETURNING id INTO v_id;
  IF NOT EXISTS (SELECT 1 FROM cash_transaction WHERE source_type = 'expense_pusat' AND source_id = v_id AND status = 'paid') THEN
    v_gagal := v_gagal || ' c';
  END IF;

  -- (d) RAB sah -> masuk, OPEX type=expense tidak berubah
  INSERT INTO expenses (outlet_id, category, type, amount, description, expense_date, payment_source)
  VALUES (v_outlet, 'rab', 'rab', 5000000, 'uji d', DATE '2026-11-11', 'transfer_pusat')
  RETURNING id INTO v_id;
  SELECT coalesce(sum(amount), 0) INTO v_opex_sesudah FROM expenses WHERE type = 'expense';
  IF v_opex_sesudah <> v_opex_sebelum THEN v_gagal := v_gagal || ' d'; END IF;

  -- (e) pengeluaran Oktober (bulan closing) diubah jadi RAB -> ditolak
  INSERT INTO expenses (outlet_id, category, type, amount, description, expense_date, payment_source)
  VALUES (v_outlet, 'promo', 'expense', 1000, 'uji e', DATE '2026-10-20', 'transfer_pusat')
  RETURNING id INTO v_oct;
  BEGIN
    UPDATE expenses SET category = 'rab', type = 'rab' WHERE id = v_oct;
    v_gagal := v_gagal || ' e';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- (f) RAB November dipindah ke tanggal Oktober sambil keluar dari RAB -> ditolak
  BEGIN
    UPDATE expenses SET category = 'promo', type = 'expense', expense_date = DATE '2026-10-31' WHERE id = v_id;
    v_gagal := v_gagal || ' f';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- (g) RAB November -> pengeluaran biasa November -> boleh
  UPDATE expenses SET category = 'promo', type = 'expense' WHERE id = v_id;

  -- (h) crew lewat klien -> ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  BEGIN
    INSERT INTO expenses (outlet_id, category, type, amount, description, expense_date, payment_source)
    VALUES (v_outlet, 'rab', 'rab', 1000, 'uji h', DATE '2026-11-11', 'transfer_pusat');
    v_gagal := v_gagal || ' h';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims', '', true);

  IF v_gagal <> '' THEN
    RAISE EXCEPTION 'GAGAL kasus:%', v_gagal;
  END IF;
  RAISE EXCEPTION 'LULUS: semua 8 kasus (di-rollback)';
END $$;
