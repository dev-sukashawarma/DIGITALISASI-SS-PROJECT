-- Uji 20261109200000: tandai PO lama lunas tanpa transaksi kas. Berakhir ROLLBACK.
-- Penanda keberhasilan: 'KONTROL: T14 ...'.
BEGIN;
DO $$
DECLARE
  c_fin uuid := '7fa90a19-3951-426f-b088-30cc536cffad';   -- admin_finance aktif
  c_pur uuid; v_lama uuid; v_lama2 uuid; v_nov uuid; v_total numeric; n int;
  saldo0 numeric; saldo1 numeric; tx0 int; tx1 int; r record;
BEGIN
  SELECT id INTO c_pur FROM outlet_staff WHERE role = 'purchasing' AND status = 'active' LIMIT 1;
  SELECT id INTO v_lama FROM purchase_order WHERE tanggal_po < '2026-11-01' AND status IN ('sebagian_diterima','diterima_lengkap')
     AND payment_status = 'unpaid' ORDER BY tanggal_po LIMIT 1;
  SELECT id INTO v_lama2 FROM purchase_order WHERE tanggal_po < '2026-11-01' AND status IN ('sebagian_diterima','diterima_lengkap')
     AND payment_status = 'unpaid' AND id <> v_lama ORDER BY tanggal_po LIMIT 1;
  SELECT id INTO v_nov FROM purchase_order WHERE tanggal_po >= '2026-11-01' AND status IN ('sebagian_diterima','diterima_lengkap')
     AND payment_status = 'unpaid' LIMIT 1;
  SELECT sum(subtotal) INTO v_total FROM purchase_order_item WHERE purchase_order_id = v_lama;
  SELECT sum(saldo) INTO saldo0 FROM cash_balance;
  SELECT count(*) INTO tx0 FROM cash_transaction;

  -- (a) purchasing ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_pur, 'role', 'authenticated')::text, true);
  BEGIN PERFORM tandai_po_lunas_tanpa_kas(ARRAY[v_lama], 'x'); RAISE EXCEPTION 'T14a LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  -- (b) alasan kosong / daftar kosong
  BEGIN PERFORM tandai_po_lunas_tanpa_kas(ARRAY[v_lama], ' '); RAISE EXCEPTION 'T14b1 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%Alasan%' THEN RAISE; END IF; END;
  BEGIN PERFORM tandai_po_lunas_tanpa_kas('{}'::uuid[], 'x'); RAISE EXCEPTION 'T14b2 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%minimal satu%' THEN RAISE; END IF; END;

  -- (c) PO November ikut dipilih -> seluruh panggilan gagal, PO lama tetap unpaid
  IF v_nov IS NOT NULL THEN
    BEGIN PERFORM tandai_po_lunas_tanpa_kas(ARRAY[v_lama, v_nov], 'x'); RAISE EXCEPTION 'T14c LOLOS';
    EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%sebelum 1 November%' THEN RAISE; END IF; END;
    IF (SELECT payment_status FROM purchase_order WHERE id = v_lama) <> 'unpaid' THEN RAISE EXCEPTION 'T14c: PO lama ikut berubah'; END IF;
  END IF;

  -- (d) dua PO lama -> lunas, saldo & transaksi kas tidak bergerak
  n := tandai_po_lunas_tanpa_kas(ARRAY[v_lama, v_lama2, v_lama], 'Sudah dibayar sebelum 1 Nov');
  IF n <> 2 THEN RAISE EXCEPTION 'T14d: jumlah %', n; END IF;
  SELECT * INTO r FROM purchase_order WHERE id = v_lama;
  IF r.payment_status <> 'paid' OR r.paid_amount <> v_total OR r.lunas_tanpa_kas_oleh <> c_fin
     OR r.lunas_tanpa_kas_alasan <> 'Sudah dibayar sebelum 1 Nov' OR r.lunas_tanpa_kas_at IS NULL THEN
    RAISE EXCEPTION 'T14d: baris % % %', r.payment_status, r.paid_amount, r.lunas_tanpa_kas_oleh;
  END IF;
  SELECT sum(saldo) INTO saldo1 FROM cash_balance;
  SELECT count(*) INTO tx1 FROM cash_transaction;
  IF saldo1 <> saldo0 OR tx1 <> tx0 THEN RAISE EXCEPTION 'T14d: kas bergerak % / % tx', saldo1 - saldo0, tx1 - tx0; END IF;
  IF (SELECT lunas_tanpa_kas_alasan FROM po_payable_spv WHERE id = v_lama) IS NULL THEN RAISE EXCEPTION 'T14d: view tanpa kolom baru'; END IF;

  -- (e) ditandai ulang ditolak
  BEGIN PERFORM tandai_po_lunas_tanpa_kas(ARRAY[v_lama], 'x'); RAISE EXCEPTION 'T14e LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (f) UPDATE langsung kolom penanda ditolak penjaga
  BEGIN UPDATE purchase_order SET lunas_tanpa_kas_alasan = 'palsu' WHERE id = v_lama2; RAISE EXCEPTION 'T14f LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  RAISE EXCEPTION 'KONTROL: T14 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
