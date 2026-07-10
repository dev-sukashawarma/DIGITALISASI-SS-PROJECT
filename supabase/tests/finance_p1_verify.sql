-- supabase/tests/finance_p1_verify.sql
-- Test lapisan DB untuk Finance P1 (saldo atomik, maker-checker, transfer dua-kaki).
-- Jalankan: psql "$DATABASE_URL" -f supabase/tests/finance_p1_verify.sql
-- Semua di dalam transaksi yang di-ROLLBACK di akhir (tak meninggalkan data).
--
-- Catatan env: RPC memakai auth.uid() yang membaca request.jwt.claims.sub. Harness
-- men-set klaim via SET LOCAL. Jika di env kamu auth.uid() tak membaca ini (mis. bukan
-- Supabase), jalankan lewat Supabase SQL editor atau impersonate role 'authenticated'.
BEGIN;

-- Seed: dua staff (maker admin_finance, checker owner) + dua lokasi (Kas Pusat, Bank).
INSERT INTO public.outlet_staff (id, name, role)
VALUES ('11111111-1111-1111-1111-111111111111','Maker Finance','admin_finance'),
       ('22222222-2222-2222-2222-222222222222','Owner Checker','owner')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cash_location (id, label, kind)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Kas Pusat','cash'),
       ('bbbbbbbb-0000-0000-0000-000000000002','BCA Pusat','bank');

-- Maker submit transaksi keluar Rp100.000 dari Bank.
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
SELECT public.submit_cash_transaction(
  'bbbbbbbb-0000-0000-0000-000000000002','out',100000,'manual') AS tx_id \gset

-- ASSERT 1: saldo bank BELUM berubah (masih pending_approval).
DO $$ DECLARE s numeric; BEGIN
  SELECT COALESCE(saldo,0) INTO s FROM public.cash_balance WHERE cash_location_id='bbbbbbbb-0000-0000-0000-000000000002';
  ASSERT COALESCE(s,0) = 0, 'FAIL: saldo berubah sebelum reconciled';
END $$;

-- ASSERT 2: maker TAK BOLEH approve transaksinya sendiri.
DO $$ BEGIN
  BEGIN
    PERFORM public.approve_cash_transaction(:'tx_id');
    ASSERT false, 'FAIL: maker berhasil approve transaksinya sendiri';
  EXCEPTION WHEN others THEN NULL; -- diharapkan gagal
  END;
END $$;

-- Checker approve → reconciled.
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
SELECT public.approve_cash_transaction(:'tx_id');
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
SELECT public.mark_cash_transaction_paid(:'tx_id');

-- ASSERT 3: saldo bank kini -100000 (out, reconciled).
DO $$ DECLARE s numeric; BEGIN
  SELECT saldo INTO s FROM public.cash_balance WHERE cash_location_id='bbbbbbbb-0000-0000-0000-000000000002';
  ASSERT s = -100000, format('FAIL: saldo bank = %s, harusnya -100000', s);
END $$;

-- ASSERT 4: transfer dua-kaki Kas Pusat -> Bank Rp50.000 (butuh checker).
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
SELECT public.record_cash_transfer(
  'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002',50000) AS tr_id \gset

DO $$ DECLARE kas numeric; bank numeric; BEGIN
  SELECT saldo INTO kas  FROM public.cash_balance WHERE cash_location_id='aaaaaaaa-0000-0000-0000-000000000001';
  SELECT saldo INTO bank FROM public.cash_balance WHERE cash_location_id='bbbbbbbb-0000-0000-0000-000000000002';
  ASSERT kas = -50000, format('FAIL: Kas Pusat = %s, harusnya -50000', kas);
  ASSERT bank = -50000, format('FAIL: Bank = %s, harusnya -50000 (-100000 + 50000)', bank);
END $$;

DO $$ BEGIN RAISE NOTICE 'ALL FINANCE P1 ASSERTIONS PASSED'; END $$;
ROLLBACK;
