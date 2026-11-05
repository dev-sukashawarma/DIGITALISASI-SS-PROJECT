-- Pindahkan transaksi 1–5 Nov 2026 dari rekening lama BCA 48523399425 ke kas baru.
-- Keputusan owner (grilling 5 Nov): mulai bersih 1 Nov 2026.
--   cash_deposit (74, Rp 39.076.900)   → Rekening Setoran 0955193763
--   petty_cash_topup (16, Rp 6.900.000) → Rekening Office 0955381004
-- Pola per baris: status → void (trigger membalik saldo lama), pindah lokasi, status semula
-- (trigger menambah saldo baru). Nominal & tanggal tak berubah.
-- Default: simulasi dan rollback. Untuk eksekusi, ubah c_simulasi ke false dan ROLLBACK ke COMMIT.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.petty_cash_topups, public.cash_transaction IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  c_simulasi constant boolean := true;
  c_lama    uuid := '0c116d5f-f147-4eff-9bc2-ce9d549e2869';
  c_setoran uuid := 'b0955193-7630-4c0e-9a11-5e70a0000001';
  c_office  uuid := 'b0955381-0040-4c0e-9a11-5e70a0000002';
  c_mulai   timestamptz := '2026-11-01 00:00+07';
  c_akhir   timestamptz := '2026-11-06 00:00+07';
  n_dep int; s_dep numeric; n_top int; s_top numeric; n_lain int;
  total0 numeric; total1 numeric; n int; s numeric; sidik text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cash_location WHERE id = c_lama AND NOT is_active)
     OR NOT EXISTS (SELECT 1 FROM cash_location WHERE id = c_setoran AND is_active AND grup = 'setoran_outlet' AND kind = 'bank')
     OR NOT EXISTS (SELECT 1 FROM cash_location WHERE id = c_office AND is_active AND grup = 'office' AND kind = 'bank') THEN
    RAISE EXCEPTION 'Status atau grup rekening berubah — berhenti';
  END IF;
  SELECT count(*) FILTER (WHERE source_type = 'cash_deposit' AND status = 'reconciled'),
         coalesce(sum(amount) FILTER (WHERE source_type = 'cash_deposit' AND status = 'reconciled'), 0),
         count(*) FILTER (WHERE source_type = 'petty_cash_topup' AND status = 'paid'),
         coalesce(sum(amount) FILTER (WHERE source_type = 'petty_cash_topup' AND status = 'paid'), 0),
         count(*) FILTER (WHERE occurred_at >= c_akhir
           OR NOT ((source_type = 'cash_deposit' AND status = 'reconciled' AND direction = 'in')
                OR (source_type = 'petty_cash_topup' AND status = 'paid' AND direction = 'out'))),
         md5(string_agg(id::text, ',' ORDER BY id))
    INTO n_dep, s_dep, n_top, s_top, n_lain, sidik
    FROM cash_transaction WHERE cash_location_id = c_lama AND occurred_at >= c_mulai;
  RAISE NOTICE 'target: setoran % (Rp %), topup % (Rp %), lain %', n_dep, s_dep, n_top, s_top, n_lain;
  IF n_lain <> 0 THEN RAISE EXCEPTION 'Ada % baris jenis/status lain — berhenti', n_lain; END IF;
  IF n_dep <> 74 OR s_dep <> 39076900 OR n_top <> 16 OR s_top <> 6900000 THEN
    RAISE EXCEPTION 'Angka berubah sejak disetujui owner (74/39.076.900, 16/6.900.000) — berhenti';
  END IF;
  IF sidik IS DISTINCT FROM '3eee3a5df2269ca95ca492f689809ea4' THEN
    RAISE EXCEPTION 'Daftar ID transaksi berubah sejak pemeriksaan — berhenti';
  END IF;

  SELECT sum(saldo) INTO total0 FROM cash_balance;

  CREATE TEMP TABLE _pindah ON COMMIT DROP AS
    SELECT id, status AS status_awal, source_type, source_id,
           CASE source_type WHEN 'cash_deposit' THEN c_setoran ELSE c_office END AS tujuan
      FROM cash_transaction WHERE cash_location_id = c_lama AND occurred_at >= c_mulai;

  UPDATE cash_transaction t SET status = 'void' FROM _pindah p WHERE t.id = p.id;
  UPDATE cash_transaction t SET cash_location_id = p.tujuan, status = p.status_awal FROM _pindah p WHERE t.id = p.id;
  UPDATE petty_cash_topups pc SET disbursed_from_cash_location_id = c_office
    FROM _pindah p WHERE p.source_type = 'petty_cash_topup' AND pc.id = p.source_id
     AND pc.disbursed_from_cash_location_id = c_lama;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> n_top THEN RAISE EXCEPTION 'Sumber dana hanya diperbarui pada % dari % pengajuan', n, n_top; END IF;

  SELECT count(*) INTO n FROM cash_transaction WHERE cash_location_id = c_lama AND occurred_at >= c_mulai;
  IF n <> 0 THEN RAISE EXCEPTION 'Masih % baris November di rekening lama', n; END IF;
  SELECT count(*), sum(amount) INTO n, s FROM cash_transaction t JOIN _pindah p ON p.id = t.id
   WHERE t.cash_location_id = c_setoran AND t.source_type = 'cash_deposit' AND t.status = 'reconciled';
  IF n <> 74 OR s <> 39076900 THEN RAISE EXCEPTION 'Setoran pindah % / %', n, s; END IF;
  SELECT count(*), sum(amount) INTO n, s FROM cash_transaction t JOIN _pindah p ON p.id = t.id
   WHERE t.cash_location_id = c_office AND t.source_type = 'petty_cash_topup' AND t.status = 'paid';
  IF n <> 16 OR s <> 6900000 THEN RAISE EXCEPTION 'Topup pindah % / %', n, s; END IF;
  SELECT sum(saldo) INTO total1 FROM cash_balance;
  IF total1 <> total0 THEN RAISE EXCEPTION 'Total saldo berubah % → %', total0, total1; END IF;

  IF c_simulasi THEN
    RAISE EXCEPTION 'KONTROL: uji coba lolos, saldo lama -%, setoran +%, office -% (ROLLBACK)', s_dep - s_top, s_dep, s_top;
  END IF;
END $$;
ROLLBACK;
