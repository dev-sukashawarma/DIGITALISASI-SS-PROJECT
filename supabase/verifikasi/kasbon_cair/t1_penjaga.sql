-- Uji 20261113140000: status menunggu_cair + trigger penjaga kasbon.
-- Jalankan sesudah migration. Berakhir ROLLBACK. Penanda: 'KONTROL: T1 ...'.
BEGIN;
DO $$
DECLARE
  c_hr   uuid := (SELECT id FROM outlet_staff WHERE role = 'admin_hr' AND status = 'active' ORDER BY id LIMIT 1);
  c_crew uuid := (SELECT id FROM outlet_staff WHERE role = 'crew' AND status = 'active' ORDER BY id LIMIT 1);
  v uuid; v2 uuid; r record;
BEGIN
  IF c_hr IS NULL OR c_crew IS NULL THEN RAISE EXCEPTION 'T1 fixture kosong'; END IF;

  -- T1a: crew mengajukan (default) -> pending + active
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_crew, 'role', 'authenticated')::text, true);
  INSERT INTO cash_advances (staff_id, amount, remaining, reason) VALUES (c_crew, 500000, 500000, 'uji t1') RETURNING id INTO v;
  SELECT * INTO r FROM cash_advances WHERE id = v;
  IF r.status IS DISTINCT FROM 'active' OR r.status_hr IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'T1a % %', r.status, r.status_hr; END IF;

  -- T1b: HR setuju dengan status active -> dipaksa menunggu_cair
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_hr, 'role', 'authenticated')::text, true);
  UPDATE cash_advances SET status_hr = 'approved', status = 'active', amount = 600000, remaining = 600000 WHERE id = v;
  SELECT * INTO r FROM cash_advances WHERE id = v;
  IF r.status IS DISTINCT FROM 'menunggu_cair' THEN RAISE EXCEPTION 'T1b status %', r.status; END IF;
  IF r.approved_by IS DISTINCT FROM c_hr THEN RAISE EXCEPTION 'T1b approved_by %', r.approved_by; END IF;
  IF r.amount IS DISTINCT FROM 600000 OR r.remaining IS DISTINCT FROM 600000 THEN RAISE EXCEPTION 'T1b nominal % %', r.amount, r.remaining; END IF;

  -- T1c: HR tidak bisa menulis active
  BEGIN UPDATE cash_advances SET status = 'active' WHERE id = v; RAISE EXCEPTION 'T1c LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- T1d: cicilan sebelum cair ditolak
  BEGIN INSERT INTO cash_advance_payments (cash_advance_id, amount, payment_date) VALUES (v, 1000, current_date); RAISE EXCEPTION 'T1d LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- T1e: insert approved+paid_off dari sesi user ditolak; dari service (uid NULL) boleh
  BEGIN
    INSERT INTO cash_advances (staff_id, amount, remaining, reason, status, status_hr) VALUES (c_crew, 1000, 0, 'uji', 'paid_off', 'approved');
    RAISE EXCEPTION 'T1e LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO cash_advances (staff_id, amount, remaining, reason, status, status_hr) VALUES (c_crew, 1000, 0, 'uji impor', 'paid_off', 'approved') RETURNING id INTO v2;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_hr, 'role', 'authenticated')::text, true);

  -- T1f: HR boleh ubah amount saat menunggu_cair; remaining ikut
  UPDATE cash_advances SET amount = 750000 WHERE id = v;
  SELECT * INTO r FROM cash_advances WHERE id = v;
  IF r.amount IS DISTINCT FROM 750000 OR r.remaining IS DISTINCT FROM 750000 THEN RAISE EXCEPTION 'T1f % %', r.amount, r.remaining; END IF;

  -- T1g: dengan flag -> active; sesudahnya amount & tolak dikunci
  PERFORM set_config('app.kasbon_cair', 'on', true);
  UPDATE cash_advances SET status = 'active' WHERE id = v;
  PERFORM set_config('app.kasbon_cair', 'off', true);
  IF (SELECT status FROM cash_advances WHERE id = v) IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'T1g cair'; END IF;
  BEGIN UPDATE cash_advances SET amount = 1 WHERE id = v; RAISE EXCEPTION 'T1g amount LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE cash_advances SET status_hr = 'rejected' WHERE id = v; RAISE EXCEPTION 'T1g tolak LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE cash_advances SET remaining = 800000 WHERE id = v; RAISE EXCEPTION 'T1g remaining naik LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- cicilan setelah cair boleh
  INSERT INTO cash_advance_payments (cash_advance_id, amount, payment_date) VALUES (v, 1000, current_date);

  RAISE EXCEPTION 'KONTROL: T1 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
