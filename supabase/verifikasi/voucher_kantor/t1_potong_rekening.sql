-- Uji migration 20261110120000: voucher kantor yang disetujui memotong rekening pusat.
-- Dijalankan sebagai postgres (auth.uid() NULL), seluruhnya di-ROLLBACK.
BEGIN;

DO $$
DECLARE
  v_rek uuid;
  v_id  uuid;
  v_saldo_awal numeric;
  v_saldo_akhir numeric;
  v_n int;
  v_kat text;
BEGIN
  SELECT id INTO v_rek FROM cash_location WHERE grup = 'petty_cash' AND is_active LIMIT 1;
  SELECT coalesce(saldo, 0) INTO v_saldo_awal FROM cash_balance WHERE cash_location_id = v_rek;

  INSERT INTO expenses (outlet_id, category, amount, description, expense_date, period_month, type, payment_source)
  VALUES (NULL, 'pengeluaran_global', 495500, '[OFFICE_VCR] uji', current_date, date_trunc('month', current_date)::date,
          'office_waiting_verification', 'transfer_pusat')
  RETURNING id INTO v_id;

  -- (a) voucher yang BELUM disetujui tidak boleh diberi rekening
  BEGIN
    UPDATE expenses SET cash_location_id = v_rek WHERE id = v_id;
    RAISE EXCEPTION 'ASERSI GAGAL: voucher menunggu verifikasi diterima dengan rekening';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- (b) persetujuan: office_settled + rekening -> satu transaksi kas keluar
  UPDATE expenses SET type = 'office_settled', cash_location_id = v_rek WHERE id = v_id;
  SELECT count(*), max(category) INTO v_n, v_kat FROM cash_transaction
   WHERE source_type = 'expense_pusat' AND source_id = v_id AND status <> 'void'
     AND direction = 'out' AND amount = 495500;
  IF v_n <> 1 OR v_kat <> 'OPEX kantor' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: transaksi kas % kategori %', v_n, v_kat;
  END IF;

  SELECT coalesce(saldo, 0) INTO v_saldo_akhir FROM cash_balance WHERE cash_location_id = v_rek;
  IF v_saldo_awal - v_saldo_akhir <> 495500 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: saldo turun % (harus 495500)', v_saldo_awal - v_saldo_akhir;
  END IF;

  RAISE NOTICE 'LULUS: voucher kantor memotong rekening sebesar nominal akhir';
END $$;

ROLLBACK;
