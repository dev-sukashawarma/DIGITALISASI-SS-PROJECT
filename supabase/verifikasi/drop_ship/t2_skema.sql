-- Uji Task 2. Jalankan: supabase db query --linked -f supabase/verifikasi/drop_ship/t2_skema.sql
-- Harapan: error P0001 berbunyi "HASIL T2: LULUS ..." (bukan pesan galat lain).
BEGIN;
DO $$
DECLARE r record; v int;
BEGIN
  -- tabel & kolom ada
  PERFORM 1 FROM pg_class WHERE relname = 'terima_vendor_outlet' AND relnamespace = 'public'::regnamespace;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: tabel terima_vendor_outlet tidak ada'; END IF;
  PERFORM 1 FROM pg_class WHERE relname = 'nota_vendor' AND relnamespace = 'public'::regnamespace;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: tabel nota_vendor tidak ada'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='ledger_stok' AND column_name='ref_terima_vendor_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: ledger_stok.ref_terima_vendor_id tidak ada'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_name='purchase_order' AND column_name='nota_vendor_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: purchase_order.nota_vendor_id tidak ada'; END IF;

  -- FK ledger_stok.ref_terima_vendor_id wajib tervalidasi (ruling R2), bukan cuma NOT VALID
  PERFORM 1 FROM pg_constraint
   WHERE conname = 'ledger_stok_ref_terima_vendor_id_fkey'
     AND conrelid = 'public.ledger_stok'::regclass
     AND convalidated = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: FK ref_terima_vendor_id tidak ada atau belum tervalidasi'; END IF;

  -- kesetaraan dengan periodeTagihan.ts (kasus identik dengan Task 1)
  FOR r IN SELECT * FROM (VALUES
      ('2026-09-03'::date, '2026-09-01'::date, '2026-09-10'::date, '2026-09-10'::date),
      ('2026-09-10', '2026-09-01', '2026-09-10', '2026-09-10'),
      ('2026-09-11', '2026-09-11', '2026-09-20', '2026-09-20'),
      ('2026-09-21', '2026-09-21', '2026-09-30', '2026-09-30'),
      ('2026-10-31', '2026-10-21', '2026-10-31', '2026-10-31'),
      ('2027-02-25', '2027-02-21', '2027-02-28', '2027-02-28'),
      ('2028-02-29', '2028-02-21', '2028-02-29', '2028-02-29')) AS k(tgl, mulai, akhir, tagih)
  LOOP
    PERFORM 1 FROM public.periode_tagihan(r.tgl) p
      WHERE p.mulai = r.mulai AND p.akhir = r.akhir AND p.tanggal_tagihan = r.tagih;
    IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: periode_tagihan(%) tidak sama dengan TS', r.tgl; END IF;
  END LOOP;

  -- tidak ada USING(true) di tabel baru
  SELECT count(*) INTO v FROM pg_policies
   WHERE tablename IN ('terima_vendor_outlet','nota_vendor','nota_vendor_rincian')
     AND (qual = 'true' OR with_check = 'true');
  IF v > 0 THEN RAISE EXCEPTION 'GAGAL: % policy USING(true)', v; END IF;

  -- tulis langsung dicabut (dua sisi: SELECT tetap ada lewat policy, tulis tidak)
  IF has_table_privilege('authenticated', 'public.terima_vendor_outlet', 'INSERT') THEN
    RAISE EXCEPTION 'GAGAL: authenticated masih bisa INSERT langsung';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.terima_vendor_outlet', 'SELECT') THEN
    RAISE EXCEPTION 'GAGAL: authenticated kehilangan SELECT -- layar crew akan kosong';
  END IF;

  PERFORM 1 FROM storage.buckets WHERE id = 'drop-ship';
  IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL: bucket drop-ship tidak ada'; END IF;

  RAISE EXCEPTION 'HASIL T2: LULUS (skema, kesetaraan periode 7 kasus, RLS, grant, bucket)';
END $$;
ROLLBACK;
