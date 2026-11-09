-- Uji 20261109150000: tanggal di Top Up + Refund Dana. Berakhir ROLLBACK.
-- Penanda keberhasilan: 'KONTROL: T12 ...'.
BEGIN;
DO $$
DECLARE
  c_fin  uuid := '7fa90a19-3951-426f-b088-30cc536cffad';   -- admin_finance aktif
  c_crew uuid := '50151804-ff12-4ef3-bbac-f2129ff2e05c';   -- crew aktif
  c_pcb  uuid := 'b0955381-0040-4c0e-9a11-5e70a0000002';   -- Rekening Petty Cash Bank
  c_pct  uuid := 'b0000000-0ff1-4c0e-9a11-5e70a0000003';   -- Rekening Petty Cash Tunai
  s0 numeric; s1 numeric; t0 numeric; v uuid; r record;
BEGIN
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_pcb), 0) INTO s0;
  SELECT coalesce((SELECT saldo FROM cash_balance WHERE cash_location_id = c_pct), 0) INTO t0;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);

  -- (a) top up bertanggal 3 Nov → tercatat tanggal 3 Nov WIB, saldo naik
  v := record_top_up_saldo(c_pcb, 100000, 'Owner', 'b.jpg', NULL, DATE '2026-11-03');
  SELECT occurred_at, status INTO r FROM cash_transaction WHERE id = v;
  IF (r.occurred_at AT TIME ZONE 'Asia/Jakarta')::date <> DATE '2026-11-03' THEN
    RAISE EXCEPTION 'T12a: tanggal tercatat %', r.occurred_at;
  END IF;
  SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = c_pcb;
  IF s1 <> s0 + 100000 THEN RAISE EXCEPTION 'T12a: saldo %', s1 - s0; END IF;

  -- (b) tanggal sebelum 1 Nov & masa depan ditolak
  BEGIN PERFORM record_top_up_saldo(c_pcb, 1000, 'X', 'b', NULL, DATE '2026-10-31'); RAISE EXCEPTION 'T12b1 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%1 November%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_top_up_saldo(c_pcb, 1000, 'X', 'b', NULL, (now() AT TIME ZONE 'Asia/Jakarta')::date + 1); RAISE EXCEPTION 'T12b2 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%masa depan%' THEN RAISE; END IF; END;

  -- (c) panggilan lama tanpa tanggal tetap jalan (app versi lama)
  v := record_top_up_saldo(p_location := c_pcb, p_amount := 1000, p_sumber := 'X', p_proof_url := 'b', p_note := NULL);
  IF (SELECT (occurred_at AT TIME ZONE 'Asia/Jakarta')::date FROM cash_transaction WHERE id = v)
     <> (now() AT TIME ZONE 'Asia/Jakarta')::date THEN RAISE EXCEPTION 'T12c: tanpa tanggal bukan hari ini'; END IF;

  -- (d) refund dari Petty Cash Bank: saldo turun, arah keluar, bertanggal
  SELECT saldo INTO s0 FROM cash_balance WHERE cash_location_id = c_pcb;
  v := record_refund_dana(c_pcb, 50000, 'Owner', 'b.jpg', 'kembalikan modal', DATE '2026-11-05');
  SELECT direction, source_type, category, occurred_at INTO r FROM cash_transaction WHERE id = v;
  IF r.direction <> 'out' OR r.source_type <> 'refund_dana' OR r.category <> 'Refund ke Owner'
     OR (r.occurred_at AT TIME ZONE 'Asia/Jakarta')::date <> DATE '2026-11-05' THEN
    RAISE EXCEPTION 'T12d: baris %', r;
  END IF;
  SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = c_pcb;
  IF s1 <> s0 - 50000 THEN RAISE EXCEPTION 'T12d: saldo %', s1 - s0; END IF;

  -- (e) batal refund: saldo kembali, batal ulang ditolak, tanpa alasan ditolak
  BEGIN PERFORM batal_refund_dana(v, ' '); RAISE EXCEPTION 'T12e1 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%Alasan%' THEN RAISE; END IF; END;
  PERFORM batal_refund_dana(v, 'salah input');
  SELECT saldo INTO s1 FROM cash_balance WHERE cash_location_id = c_pcb;
  IF s1 <> s0 THEN RAISE EXCEPTION 'T12e: saldo tak kembali %', s1 - s0; END IF;
  BEGIN PERFORM batal_refund_dana(v, 'lagi'); RAISE EXCEPTION 'T12e2 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%sudah dibatalkan%' THEN RAISE; END IF; END;

  -- (f) refund tunai melebihi isi brankas ditolak; tanpa tujuan / bukti ditolak
  BEGIN PERFORM record_refund_dana(c_pct, t0 + 1, 'Owner', 'b', NULL, NULL); RAISE EXCEPTION 'T12f1 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%tidak mencukupi%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_refund_dana(c_pcb, 1000, ' ', 'b', NULL, NULL); RAISE EXCEPTION 'T12f2 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%Tujuan%' THEN RAISE; END IF; END;
  BEGIN PERFORM record_refund_dana(c_pcb, 1000, 'Owner', ' ', NULL, NULL); RAISE EXCEPTION 'T12f3 LOLOS';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%Bukti%' THEN RAISE; END IF; END;

  -- (g) crew ditolak
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_crew, 'role', 'authenticated')::text, true);
  BEGIN PERFORM record_refund_dana(c_pcb, 1000, 'Owner', 'b', NULL, NULL); RAISE EXCEPTION 'T12g LOLOS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  RAISE EXCEPTION 'KONTROL: T12 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
