-- Uji 20261113141000: RPC cairkan/tolak/batal kasbon + riwayat Hub.
-- Jalankan sesudah migration 20261113140000 & 20261113141000. Berakhir ROLLBACK.
-- Penanda: 'KONTROL: T2 ...'.
BEGIN;
DO $$
DECLARE
  c_hr   uuid := (SELECT id FROM outlet_staff WHERE role = 'admin_hr' AND status = 'active' ORDER BY id LIMIT 1);
  c_fin  uuid := (SELECT id FROM outlet_staff WHERE role = 'admin_finance' AND status = 'active' ORDER BY id LIMIT 1);
  c_crew uuid := (SELECT id FROM outlet_staff WHERE role = 'crew' AND status = 'active' ORDER BY id LIMIT 1);
  c_adm  uuid := (SELECT id FROM outlet_staff WHERE role = 'admin' AND status = 'active' ORDER BY id LIMIT 1);
  c_bank uuid := (SELECT id FROM cash_location WHERE grup = 'petty_cash' AND scope = 'pusat' AND kind = 'bank' AND is_active LIMIT 1);
  c_tun  uuid := (SELECT id FROM cash_location WHERE grup = 'petty_cash' AND scope = 'pusat' AND kind = 'cash' AND is_active LIMIT 1);
  c_bb   uuid := (SELECT id FROM cash_location WHERE grup = 'bahan_baku' AND is_active LIMIT 1);
  s0 numeric; s numeric; v uuid; v2 uuid; v3 uuid; tx uuid; n int; r record;
BEGIN
  IF c_hr IS NULL OR c_fin IS NULL OR c_crew IS NULL OR c_adm IS NULL OR c_bank IS NULL OR c_tun IS NULL OR c_bb IS NULL THEN
    RAISE EXCEPTION 'T2 fixture kosong';
  END IF;

  -- Saldo bank & tunai dipastikan cukup lewat top up (dibatalkan ROLLBACK).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  PERFORM record_top_up_saldo(c_bank, 5000000, 'Uji T2', 'b.jpg', 'uji');
  PERFORM record_top_up_saldo(c_tun, 5000000, 'Uji T2', 'b.jpg', 'uji');
  SELECT saldo INTO s0 FROM cash_balance WHERE cash_location_id = c_bank;

  -- Kasbon menunggu_cair, disetujui admin_hr.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_hr, 'role', 'authenticated')::text, true);
  INSERT INTO cash_advances (staff_id, amount, remaining, reason, status_hr) VALUES (c_crew, 500000, 500000, 'uji t2', 'approved') RETURNING id INTO v;
  IF (SELECT status FROM cash_advances WHERE id = v) IS DISTINCT FROM 'menunggu_cair' THEN RAISE EXCEPTION 'T2 fixture status'; END IF;

  -- T2a: crew tidak boleh mencairkan
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_crew, 'role', 'authenticated')::text, true);
  BEGIN PERFORM finance_cairkan_kasbon(v, c_bank, 'b.jpg'); RAISE EXCEPTION 'T2a LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- T2j: daftar menunggu (finance boleh, crew tidak)
  BEGIN PERFORM * FROM finance_kasbon_menunggu(); RAISE EXCEPTION 'T2j crew LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  SELECT * INTO r FROM finance_kasbon_menunggu() WHERE id = v;
  IF r.id IS NULL OR r.staff_nama IS NULL OR r.penyetuju_nama IS NULL THEN RAISE EXCEPTION 'T2j daftar %', r; END IF;

  -- T2b: saldo kurang
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_hr, 'role', 'authenticated')::text, true);
  INSERT INTO cash_advances (staff_id, amount, remaining, reason, status_hr) VALUES (c_crew, s0 + 1, s0 + 1, 'uji besar', 'approved') RETURNING id INTO v2;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM cash_transaction WHERE source_type = 'kasbon';
  BEGIN PERFORM finance_cairkan_kasbon(v2, c_bank, 'b.jpg'); RAISE EXCEPTION 'T2b LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%tidak mencukupi%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM cash_transaction WHERE source_type = 'kasbon') IS DISTINCT FROM n THEN RAISE EXCEPTION 'T2b transaksi lahir'; END IF;

  -- T2f: bukti kosong & rekening salah
  BEGIN PERFORM finance_cairkan_kasbon(v, c_bank, ' '); RAISE EXCEPTION 'T2f bukti LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%Bukti%' THEN RAISE; END IF; END;
  BEGIN PERFORM finance_cairkan_kasbon(v, c_bb, 'b.jpg'); RAISE EXCEPTION 'T2f rekening LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%Rekening Petty Cash%' THEN RAISE; END IF; END;

  -- T2c: HR mengubah nominal sebelum cair; yang tercatat nominal terkini
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_hr, 'role', 'authenticated')::text, true);
  UPDATE cash_advances SET amount = 750000 WHERE id = v;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  tx := finance_cairkan_kasbon(v, c_bank, 'kasbon/v-1-b.jpg');
  IF (SELECT amount FROM cash_transaction WHERE id = tx) IS DISTINCT FROM 750000 THEN RAISE EXCEPTION 'T2c nominal tx'; END IF;
  SELECT saldo INTO s FROM cash_balance WHERE cash_location_id = c_bank;
  IF s IS DISTINCT FROM s0 - 750000 THEN RAISE EXCEPTION 'T2c saldo %', s0 - s; END IF;
  SELECT * INTO r FROM cash_advances WHERE id = v;
  IF r.status IS DISTINCT FROM 'active' OR r.remaining IS DISTINCT FROM 750000 OR r.metode_cair IS DISTINCT FROM 'transfer'
     OR r.dicairkan_oleh IS DISTINCT FROM c_fin OR r.cash_transaction_id IS DISTINCT FROM tx OR r.bukti_cair IS DISTINCT FROM 'kasbon/v-1-b.jpg'
     OR r.approved_by IS DISTINCT FROM c_hr THEN
    RAISE EXCEPTION 'T2c kasbon %', r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM approval_log WHERE jenis = 'kasbon' AND keputusan = 'setuju' AND sumber_id = v
                 AND pelaku = c_fin AND pelaku_nama IS NOT NULL AND nominal = 750000) THEN
    RAISE EXCEPTION 'T2c riwayat';
  END IF;

  -- T2d: cair dua kali ditolak
  BEGIN PERFORM finance_cairkan_kasbon(v, c_bank, 'b.jpg'); RAISE EXCEPTION 'T2d LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%tidak menunggu pencairan%' THEN RAISE; END IF; END;

  -- T2e: admin (punya hak HR & finance) yang menyetujui tidak boleh mencairkan sendiri
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_adm, 'role', 'authenticated')::text, true);
  INSERT INTO cash_advances (staff_id, amount, remaining, reason, status_hr) VALUES (c_crew, 1000, 1000, 'uji sama', 'approved') RETURNING id INTO v3;
  IF (SELECT approved_by FROM cash_advances WHERE id = v3) IS DISTINCT FROM c_adm THEN RAISE EXCEPTION 'T2e fixture'; END IF;
  BEGIN PERFORM finance_cairkan_kasbon(v3, c_bank, 'b.jpg'); RAISE EXCEPTION 'T2e LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%orang lain%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);

  -- T2g: batal pencairan mengembalikan saldo
  BEGIN PERFORM finance_batal_cair_kasbon(v, ' '); RAISE EXCEPTION 'T2g alasan LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%Alasan%' THEN RAISE; END IF; END;
  PERFORM finance_batal_cair_kasbon(v, 'salah rekening');
  IF (SELECT status FROM cash_transaction WHERE id = tx) IS DISTINCT FROM 'void' THEN RAISE EXCEPTION 'T2g void'; END IF;
  SELECT saldo INTO s FROM cash_balance WHERE cash_location_id = c_bank;
  IF s IS DISTINCT FROM s0 THEN RAISE EXCEPTION 'T2g saldo %', s0 - s; END IF;
  SELECT * INTO r FROM cash_advances WHERE id = v;
  IF r.status IS DISTINCT FROM 'menunggu_cair' OR r.dicairkan_at IS NOT NULL OR r.cash_transaction_id IS NOT NULL OR r.metode_cair IS NOT NULL THEN
    RAISE EXCEPTION 'T2g kasbon %', r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM approval_log WHERE jenis = 'kasbon' AND keputusan = 'batal_cair' AND sumber_id = v
                 AND alasan = 'salah rekening') THEN
    RAISE EXCEPTION 'T2g riwayat';
  END IF;

  -- T2h: cair ulang dari tunai; setelah ada cicilan, batal ditolak
  PERFORM finance_cairkan_kasbon(v, c_tun, 'kasbon/v-2-ttd.jpg');
  IF (SELECT metode_cair FROM cash_advances WHERE id = v) IS DISTINCT FROM 'tunai' THEN RAISE EXCEPTION 'T2h tunai'; END IF;
  IF (SELECT count(*) FROM approval_log WHERE jenis = 'kasbon' AND keputusan = 'setuju' AND sumber_id = v) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T2h riwayat ganda';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_hr, 'role', 'authenticated')::text, true);
  INSERT INTO cash_advance_payments (cash_advance_id, amount, payment_date) VALUES (v, 1000, current_date);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  BEGIN PERFORM finance_batal_cair_kasbon(v, 'telat'); RAISE EXCEPTION 'T2h batal LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%sudah dicicil%' THEN RAISE; END IF; END;

  -- T2i: tolak finance
  BEGIN PERFORM finance_tolak_kasbon(v2, ''); RAISE EXCEPTION 'T2i alasan LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%Alasan%' THEN RAISE; END IF; END;
  PERFORM finance_tolak_kasbon(v2, 'terlalu besar');
  SELECT * INTO r FROM cash_advances WHERE id = v2;
  IF r.status_hr IS DISTINCT FROM 'rejected' OR r.rejection_note IS DISTINCT FROM '[Ditolak Finance] terlalu besar'
     OR r.ditolak_finance_oleh IS DISTINCT FROM c_fin OR r.ditolak_finance_at IS NULL THEN
    RAISE EXCEPTION 'T2i kasbon %', r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM approval_log WHERE jenis = 'kasbon' AND keputusan = 'tolak' AND sumber_id = v2
                 AND alasan = 'terlalu besar') THEN
    RAISE EXCEPTION 'T2i riwayat';
  END IF;
  BEGIN PERFORM finance_tolak_kasbon(v2, 'lagi'); RAISE EXCEPTION 'T2i ulang LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%tidak menunggu pencairan%' THEN RAISE; END IF; END;

  RAISE EXCEPTION 'KONTROL: T2 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
