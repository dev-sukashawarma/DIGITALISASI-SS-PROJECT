-- supabase/verifikasi/saldo_vendor/t3_surat_jalan.sql — harapan "HASIL T3: LULUS"
BEGIN;
DO $$
DECLARE v_sapi uuid; v_ayam uuid; v_dj uuid; v_az uuid; v_outlet uuid; v_sj surat_jalan; v_ok boolean;
        v_n int; v_harga_dj numeric; v_sisa numeric;
BEGIN
  SELECT id INTO v_sapi FROM bahan_baku WHERE nama='SAPI';
  SELECT id INTO v_ayam FROM bahan_baku WHERE nama='AYAM';
  SELECT public.vendor_induk(id) INTO v_dj FROM supplier WHERE nama ILIKE 'Djafafood%';
  SELECT id INTO v_az FROM supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 10';
  SELECT id INTO v_outlet FROM outlets WHERE type='test' LIMIT 1;
  -- titik awal: aktifkan SAPI (Djafafood 3 Blok, Pak Aziz 4 Blok) lewat mutasi langsung sebagai postgres
  INSERT INTO stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, catatan) VALUES
    (v_sapi, v_dj, public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 3), 'hitung_fisik', 'UJI'),
    (v_sapi, v_az, public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 4), 'hitung_fisik', 'UJI');

  -- (a) create_surat_jalan (service) pecah 3+2 + AYAM tanpa vendor (terisi otomatis)
  PERFORM set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
  v_sj := public.create_surat_jalan(v_outlet, jsonb_build_array(
    jsonb_build_object('bahan_baku_id', v_sapi, 'qty_dikirim', 3, 'vendor_id', v_dj),
    jsonb_build_object('bahan_baku_id', v_sapi, 'qty_dikirim', 2, 'vendor_id', v_az),
    jsonb_build_object('bahan_baku_id', v_ayam, 'qty_dikirim', 1)));
  SELECT count(*) INTO v_n FROM surat_jalan_item WHERE surat_jalan_id = v_sj.id;
  IF v_n <> 3 THEN RAISE EXCEPTION 'GAGAL (a): baris %', v_n; END IF;
  IF EXISTS (SELECT 1 FROM surat_jalan_item WHERE surat_jalan_id=v_sj.id AND bahan_baku_id=v_ayam AND vendor_id IS NULL) THEN
    RAISE EXCEPTION 'GAGAL (a): vendor AYAM tak terisi otomatis'; END IF;

  -- (b) harga baris Djafafood = katalog Djafafood bila > 0
  SELECT max(bs.harga) INTO v_harga_dj FROM bahan_baku_supplier bs JOIN supplier s ON s.id=bs.supplier_id
   WHERE bs.bahan_baku_id=v_sapi AND bs.is_active AND COALESCE(s.vendor_induk_id,s.id)=v_dj AND bs.harga > 0;
  IF v_harga_dj IS NOT NULL AND NOT EXISTS (SELECT 1 FROM surat_jalan_item WHERE surat_jalan_id=v_sj.id AND vendor_id=v_dj AND harga_snapshot=v_harga_dj) THEN
    RAISE EXCEPTION 'GAGAL (b): harga snapshot bukan harga katalog Djafafood'; END IF;

  -- (c) kirim → 2 mutasi sj_kirim, sisa Djafafood 0, Pak Aziz 2
  UPDATE surat_jalan SET status='dikirim' WHERE id = v_sj.id;
  SELECT count(*) INTO v_n FROM stok_vendor_gudang_mutasi m JOIN surat_jalan_item i ON i.id=m.ref_surat_jalan_item_id
   WHERE i.surat_jalan_id = v_sj.id AND m.sumber='sj_kirim';
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL (c): mutasi sj_kirim %', v_n; END IF;
  v_sisa := public.sisa_vendor_gudang(v_sapi, v_az) / public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 1);
  IF v_sisa <> 2 THEN RAISE EXCEPTION 'GAGAL (c): sisa Pak Aziz % bukan 2', v_sisa; END IF;

  -- (d) SJ baru minta 1 Djafafood (sisa 0) → kirim DITOLAK
  v_sj := public.create_surat_jalan(v_outlet, jsonb_build_array(
    jsonb_build_object('bahan_baku_id', v_sapi, 'qty_dikirim', 1, 'vendor_id', v_dj)));
  v_ok := false;
  BEGIN UPDATE surat_jalan SET status='dikirim' WHERE id = v_sj.id;
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): kirim melebihi sisa lolos'; END IF;

  -- (e) SAPI tanpa vendor → kirim DITOLAK
  v_sj := public.create_surat_jalan(v_outlet, jsonb_build_array(
    jsonb_build_object('bahan_baku_id', v_sapi, 'qty_dikirim', 1)));
  v_ok := false;
  BEGIN UPDATE surat_jalan SET status='dikirim' WHERE id = v_sj.id;
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (e): bahan multi-vendor tanpa vendor lolos'; END IF;

  -- (f) approve_permintaan_svc: alokasi total tak pas → ditolak
  -- (dijalankan hanya bila ada permintaan menunggu fixture; dibuat di sini)
  DECLARE v_p uuid; BEGIN
    INSERT INTO permintaan_bahan (outlet_id, status, dibuat_oleh) VALUES (v_outlet, 'menunggu', gen_random_uuid()) RETURNING id INTO v_p;
    v_ok := false;
    BEGIN PERFORM public.approve_permintaan_svc(v_p, jsonb_build_array(jsonb_build_object(
      'bahan_baku_id', v_sapi, 'qty_disetujui', 2,
      'alokasi', jsonb_build_array(jsonb_build_object('vendor_id', v_az, 'qty', 1)))));
    EXCEPTION WHEN check_violation THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): alokasi tak pas lolos'; END IF;
    -- (g) alokasi pas → SJ 1 baris Pak Aziz 2
    PERFORM public.approve_permintaan_svc(v_p, jsonb_build_array(jsonb_build_object(
      'bahan_baku_id', v_sapi, 'qty_disetujui', 2,
      'alokasi', jsonb_build_array(jsonb_build_object('vendor_id', v_az, 'qty', 2)))));
    PERFORM 1 FROM permintaan_bahan p JOIN surat_jalan_item i ON i.surat_jalan_id = p.surat_jalan_id
     WHERE p.id = v_p AND i.vendor_id = v_az AND i.qty_dikirim = 2;
    IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (g): SJ dari approval tak ber-vendor'; END IF;
  END;

  RAISE EXCEPTION 'HASIL T3: LULUS (pecah 3+2, vendor otomatis, harga vendor, sj_kirim, blokir sisa & tanpa vendor, approval alokasi)';
END $$;
ROLLBACK;
