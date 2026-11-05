-- Uji Task 1: skema grup kas, lokasi baru, tabel setor_bank & income_lainnya.
-- Jalankan utuh; berakhir ROLLBACK (nol perubahan nyata).
BEGIN;
DO $$
DECLARE n int; ok boolean;
BEGIN
  SELECT count(*) INTO n FROM cash_location WHERE is_active AND grup = 'setoran_outlet';
  IF n <> 2 THEN RAISE EXCEPTION 'T1a: lokasi aktif setoran_outlet = %, harus 2', n; END IF;
  SELECT count(*) INTO n FROM cash_location WHERE is_active AND grup = 'office';
  IF n <> 2 THEN RAISE EXCEPTION 'T1b: lokasi aktif office = %, harus 2', n; END IF;

  SELECT is_active INTO ok FROM cash_location WHERE id = '0c116d5f-f147-4eff-9bc2-ce9d549e2869';
  IF ok THEN RAISE EXCEPTION 'T1c: rekening lama masih aktif'; END IF;

  INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, status)
  VALUES ('b0000000-0ff1-4c0e-9a11-5e70a0000003', 'in', 1, 'uji', 'setor_bank', 'draft');

  BEGIN
    INSERT INTO income_lainnya (occurred_at, kategori, keterangan, pembeli, amount, cash_location_id, proof_url, created_by)
    VALUES (now(), 'lainnya', '  ', 'X', 1000, 'b0000000-0ff1-4c0e-9a11-5e70a0000003', 'p', NULL);
    RAISE EXCEPTION 'T1d: lainnya tanpa keterangan LOLOS';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  IF has_table_privilege('anon', 'public.income_lainnya', 'SELECT') THEN
    RAISE EXCEPTION 'T1e: anon bisa SELECT income_lainnya';
  END IF;
  IF has_table_privilege('authenticated', 'public.setor_bank', 'INSERT') THEN
    RAISE EXCEPTION 'T1f: authenticated bisa INSERT setor_bank langsung';
  END IF;
  RAISE NOTICE 'T1 LULUS';
END $$;
ROLLBACK;
