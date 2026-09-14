BEGIN;
DO $$
DECLARE v_kitchen uuid; v_crew uuid; v_n bigint; v_tot bigint; v_a numeric; v_b numeric; v_vendor uuid; v_ok boolean;
  c_dari date := '2026-09-12'; c_sampai date := '2026-09-14';
BEGIN
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen' AND status='active' LIMIT 1;
  SELECT id INTO v_crew FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;
  -- draft ada di rentang → filter status bermakna
  IF NOT EXISTS (SELECT 1 FROM surat_jalan WHERE status IN ('draft','dibatalkan') AND created_at >= '2026-09-12') THEN
    RAISE EXCEPTION 'GAGAL fixture: tak ada draft/dibatalkan'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM * FROM laporan_kiriman_vendor_rincian(c_dari, c_sampai, NULL, NULL, NULL, 50, 0);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (a): crew boleh membaca'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen, 'role','authenticated')::text, true);
  SELECT count(*), max(total_count) INTO v_n, v_tot FROM laporan_kiriman_vendor_rincian(c_dari, c_sampai, NULL, NULL, NULL, 200, 0);
  IF v_n = 0 THEN RAISE EXCEPTION 'GAGAL (b): rincian kosong'; END IF;
  RESET ROLE;

  -- (c) total_count = jumlah baris dasar; tanpa draft/dibatalkan
  IF v_tot <> (SELECT count(*) FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL)) THEN
    RAISE EXCEPTION 'GAGAL (c): total_count % beda', v_tot; END IF;
  IF EXISTS (SELECT 1 FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL) WHERE status IN ('draft','dibatalkan')) THEN
    RAISE EXCEPTION 'GAGAL (c): draft ikut'; END IF;

  -- (d) Σ rekap = Σ baris non-tes
  SELECT COALESCE(sum(nilai),0) INTO v_a FROM laporan_kiriman_vendor_rekap(c_dari, c_sampai, NULL, NULL, NULL);
  SELECT COALESCE(sum(nilai),0) INTO v_b FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL) WHERE NOT outlet_tes;
  IF abs(v_a - v_b) > 0.01 THEN RAISE EXCEPTION 'GAGAL (d): rekap % vs rincian %', v_a, v_b; END IF;
  IF EXISTS (SELECT 1 FROM laporan_kiriman_vendor_rekap(c_dari, c_sampai, NULL, NULL, NULL) r JOIN outlets o ON o.id=r.outlet_id WHERE o.type='test') THEN
    RAISE EXCEPTION 'GAGAL (d): outlet tes masuk rekap'; END IF;

  -- (e) fallback katalog. Data 12-14 Sep: baris tanpa vendor semuanya bahan TANPA
  -- vendor katalog (HAND GLOVE dkk), jadi fallback diuji dengan menambah satu
  -- vendor katalog HAND GLOVE di dalam transaksi ini (ROLLBACK di akhir).
  IF EXISTS (SELECT 1 FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL) b
              WHERE b.vendor_id IS NULL AND (SELECT count(*) FROM vendor_bahan(b.bahan_baku_id)) = 1) THEN
    RAISE EXCEPTION 'GAGAL (e): ada bahan satu-vendor yang tak dapat fallback'; END IF;
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil)
  SELECT b.id, (SELECT id FROM supplier WHERE nama='Pak Aji' LIMIT 1), 'pack', 1
    FROM bahan_baku b WHERE b.nama = 'HAND GLOVE' AND b.is_active;
  IF NOT EXISTS (SELECT 1 FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL)
                  WHERE bahan_nama = 'HAND GLOVE' AND vendor_otomatis AND vendor_nama = 'Pak Aji') THEN
    RAISE EXCEPTION 'GAGAL (e): fallback vendor katalog tidak terisi'; END IF;
  IF EXISTS (SELECT 1 FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL)
              WHERE vendor_otomatis AND bahan_nama <> 'HAND GLOVE') THEN
    RAISE EXCEPTION 'GAGAL (e): fallback muncul di bahan lain'; END IF;

  -- (f) filter vendor
  SELECT vendor_id INTO v_vendor FROM _kiriman_vendor_baris(c_dari, c_sampai, NULL, NULL, NULL) WHERE vendor_id IS NOT NULL LIMIT 1;
  IF EXISTS (SELECT 1 FROM laporan_kiriman_vendor_rincian(c_dari, c_sampai, NULL, NULL, v_vendor, 200, 0) WHERE vendor_id IS DISTINCT FROM v_vendor) THEN
    RAISE EXCEPTION 'GAGAL (f): filter vendor bocor'; END IF;

  -- (g) rentang > 93 hari ditolak
  v_ok := false;
  BEGIN PERFORM * FROM laporan_kiriman_vendor_rekap('2026-01-01', '2026-09-14', NULL, NULL, NULL);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g): rentang panjang lolos'; END IF;

  RAISE EXCEPTION 'HASIL KV1: LULUS (akses, total, status, rekap=rincian non-tes, fallback, filter, rentang)';
END $$;
ROLLBACK;
