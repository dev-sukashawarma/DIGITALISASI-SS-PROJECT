-- Uji trigger riwayat approval. Jalankan di dalam BEGIN ... ROLLBACK.
-- Fungsi trigger dipasang ke tabel sementara berstruktur sama (LIKE) agar
-- baris produksi tidak tersentuh dan trigger aturan alur tidak terpicu.
DO $$
DECLARE
  v_dev uuid := (SELECT id FROM outlet_staff WHERE role = 'developer' AND status = 'active' LIMIT 1);
  v_id  uuid := gen_random_uuid();
  v_po  uuid := gen_random_uuid();
  v_tx  uuid := gen_random_uuid();
  r     record;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dev, 'role', 'authenticated')::text, true);

  -- Petty cash: acc, tolak (dengan alasan), serah ke AM.
  CREATE TEMP TABLE uji_pc (LIKE petty_cash_topups INCLUDING DEFAULTS) ON COMMIT DROP;
  CREATE TRIGGER t AFTER UPDATE OF status ON uji_pc FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_approval_log_petty_cash();
  INSERT INTO uji_pc (id, outlet_id, amount, description, status)
  VALUES (v_id, (SELECT id FROM outlets LIMIT 1), 500000, 'beli gas', 'forwarded_to_finance');
  UPDATE uji_pc SET status = 'approved_by_finance' WHERE id = v_id;
  UPDATE uji_pc SET status = 'forwarded_by_finance' WHERE id = v_id;

  SELECT * INTO r FROM approval_log WHERE sumber_id = v_id AND keputusan = 'setuju';
  IF r IS NULL OR r.jenis <> 'petty_cash' OR r.nominal <> 500000 OR r.pelaku IS DISTINCT FROM v_dev OR r.waktu IS NULL THEN
    RAISE EXCEPTION 'GAGAL: acc petty cash tidak tercatat benar: %', row_to_json(r);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM approval_log WHERE sumber_id = v_id AND keputusan = 'serah_am') THEN
    RAISE EXCEPTION 'GAGAL: serah ke AM tidak tercatat';
  END IF;

  v_id := gen_random_uuid();
  INSERT INTO uji_pc (id, outlet_id, amount, description, status)
  VALUES (v_id, (SELECT id FROM outlets LIMIT 1), 300000, 'awal', 'forwarded_to_finance');
  UPDATE uji_pc SET status = 'rejected', description = E'awal\n\n[Ditolak Finance: salah nominal]' WHERE id = v_id;
  SELECT * INTO r FROM approval_log WHERE sumber_id = v_id;
  IF r IS NULL OR r.keputusan <> 'tolak' OR r.alasan IS DISTINCT FROM 'salah nominal' THEN
    RAISE EXCEPTION 'GAGAL: tolak petty cash / alasan tidak tercatat: %', row_to_json(r);
  END IF;

  -- Status lain (bukan keputusan finance) tidak dicatat.
  v_id := gen_random_uuid();
  INSERT INTO uji_pc (id, outlet_id, amount, description, status)
  VALUES (v_id, (SELECT id FROM outlets LIMIT 1), 1, 'x', 'forwarded_by_finance');
  UPDATE uji_pc SET status = 'forwarded_by_area_manager' WHERE id = v_id;
  IF EXISTS (SELECT 1 FROM approval_log WHERE sumber_id = v_id) THEN
    RAISE EXCEPTION 'GAGAL: langkah AM ikut tercatat';
  END IF;

  -- Approval PO: tolak dengan alasan di catatan.
  CREATE TEMP TABLE uji_po (LIKE purchase_order INCLUDING DEFAULTS) ON COMMIT DROP;
  CREATE TRIGGER t AFTER UPDATE OF status ON uji_po FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION trg_approval_log_po();
  INSERT INTO uji_po (id, nomor_po, supplier_nama, status)
  VALUES (v_po, 'UJI/PO/1', 'Supplier Uji', 'menunggu_approval_finance');
  UPDATE uji_po SET status = 'draft', catatan = E'catatan lama\n[Ditolak finance] harga terlalu tinggi' WHERE id = v_po;
  SELECT * INTO r FROM approval_log WHERE sumber_id = v_po;
  IF r IS NULL OR r.jenis <> 'po' OR r.keputusan <> 'tolak' OR r.alasan IS DISTINCT FROM 'harga terlalu tinggi'
     OR r.pelaku IS DISTINCT FROM v_dev OR r.judul <> 'Supplier Uji' THEN
    RAISE EXCEPTION 'GAGAL: tolak PO tidak tercatat benar: %', row_to_json(r);
  END IF;

  -- Bayar vendor: tolak dengan alasan di note.
  CREATE TEMP TABLE uji_ct (LIKE cash_transaction INCLUDING DEFAULTS) ON COMMIT DROP;
  CREATE TRIGGER t AFTER UPDATE OF status ON uji_ct FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.source_type = 'supplier_po') EXECUTE FUNCTION trg_approval_log_bayar_vendor();
  -- Tabel LIKE tidak menyalin FK, jadi lokasi kas cukup uuid acak.
  INSERT INTO uji_ct (id, cash_location_id, direction, source_type, source_id, amount, status, note)
  VALUES (v_tx, gen_random_uuid(), 'out', 'supplier_po', v_po, 4250000, 'pending_approval', 'ajuan');
  UPDATE uji_ct SET status = 'rejected', note = 'ajuan · [Ditolak: belum ada invoice]' WHERE id = v_tx;
  SELECT * INTO r FROM approval_log WHERE sumber_id = v_po AND jenis = 'bayar_vendor';
  IF r IS NULL OR r.keputusan <> 'tolak' OR r.nominal <> 4250000 OR r.alasan IS DISTINCT FROM 'belum ada invoice' THEN
    RAISE EXCEPTION 'GAGAL: tolak bayar vendor tidak tercatat benar: %', row_to_json(r);
  END IF;

  -- Trigger terpasang di tabel produksi.
  IF (SELECT count(*) FROM pg_trigger WHERE tgname IN
        ('trg_approval_log_petty_cash', 'trg_approval_log_po', 'trg_approval_log_bayar_vendor')) <> 3 THEN
    RAISE EXCEPTION 'GAGAL: trigger belum terpasang di tabel produksi';
  END IF;

  -- Klien tidak bisa menulis log.
  IF has_table_privilege('authenticated', 'public.approval_log', 'INSERT') THEN
    RAISE EXCEPTION 'GAGAL: authenticated bisa INSERT approval_log';
  END IF;

  RAISE NOTICE 'LULUS: riwayat approval';
END $$;
