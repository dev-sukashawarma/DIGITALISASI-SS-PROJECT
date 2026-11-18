-- Uji 20261118110000: skema retur vendor. Berakhir ROLLBACK.
BEGIN;
DO $$
DECLARE
  c_fin  uuid := (SELECT id FROM outlet_staff WHERE role = 'admin_finance' AND status = 'active' ORDER BY id LIMIT 1);
  c_crew uuid := (SELECT id FROM outlet_staff WHERE role = 'crew' AND status = 'active' ORDER BY id LIMIT 1);
  c_sup  uuid := (SELECT id FROM supplier ORDER BY created_at LIMIT 1);
  c_loc  uuid := (SELECT id FROM cash_location WHERE grup = 'bahan_baku' AND kind = 'bank' AND is_active LIMIT 1);
  n int;
BEGIN
  IF to_regclass('public.retur_vendor') IS NULL OR to_regclass('public.retur_vendor_item') IS NULL
     OR to_regclass('public.vendor_kredit') IS NULL THEN
    RAISE EXCEPTION 'T1a tabel belum ada';
  END IF;
  IF c_fin IS NULL OR c_crew IS NULL OR c_sup IS NULL OR c_loc IS NULL THEN RAISE EXCEPTION 'T1 fixture kosong'; END IF;

  -- T1b: klien tidak bisa menulis
  IF has_table_privilege('authenticated', 'public.retur_vendor', 'INSERT')
     OR has_table_privilege('authenticated', 'public.vendor_kredit', 'UPDATE')
     OR has_table_privilege('anon', 'public.retur_vendor_item', 'SELECT') THEN
    RAISE EXCEPTION 'T1b hak tulis/baca klien terbuka';
  END IF;

  INSERT INTO retur_vendor (nomor, supplier_id, vendor_induk, alasan)
  VALUES ('RV/UJI/T1', c_sup, vendor_induk(c_sup), 'rusak');

  -- T1c: crew tidak melihat, admin_finance melihat
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM retur_vendor WHERE nomor = 'RV/UJI/T1';
  IF n <> 0 THEN RAISE EXCEPTION 'T1c crew melihat %', n; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c_fin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM retur_vendor WHERE nomor = 'RV/UJI/T1';
  IF n <> 1 THEN RAISE EXCEPTION 'T1c finance melihat %', n; END IF;
  RESET ROLE;

  -- T1d: lainnya tanpa catatan ditolak
  BEGIN
    INSERT INTO retur_vendor (nomor, supplier_id, vendor_induk, alasan) VALUES ('RV/UJI/T1b', c_sup, vendor_induk(c_sup), 'lainnya');
    RAISE EXCEPTION 'T1d LOLOS';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- T1e: source_type retur_vendor diterima
  INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, status, occurred_at)
  VALUES (c_loc, 'in', 1, 'Uji T1', 'retur_vendor', 'draft', now());

  -- T1f: qty_ditolak default 0, ref_retur_vendor_id ada
  IF (SELECT column_default FROM information_schema.columns
      WHERE table_name = 'purchase_order_item' AND column_name = 'qty_ditolak') IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'T1f qty_ditolak default';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ledger_stok' AND column_name = 'ref_retur_vendor_id') THEN
    RAISE EXCEPTION 'T1f ref_retur_vendor_id';
  END IF;

  RAISE NOTICE 'T1 LULUS';
END $$;
ROLLBACK;
