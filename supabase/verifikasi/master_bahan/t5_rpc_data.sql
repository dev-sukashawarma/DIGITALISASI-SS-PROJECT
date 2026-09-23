-- supabase/verifikasi/master_bahan/t5_rpc_data.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_admin uuid; v_purch uuid; v_id uuid; v_id2 uuid; v_id3 uuid; v_ok boolean; v_hg uuid; v_sku uuid; v_msg text;
        v_sup uuid; v_harga numeric;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_purch FROM outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_hg FROM bahan_baku WHERE nama = 'HAND GLOVE';
  SELECT id INTO v_sup FROM supplier WHERE is_active ORDER BY id LIMIT 1;
  IF v_admin IS NULL OR v_purch IS NULL OR v_hg IS NULL OR v_sup IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- (a) buat bahan tiga tingkat; faktor dihitung server
  v_id := public.simpan_bahan_baku(NULL, jsonb_build_object(
    'nama','UJI T5 FOIL','kategori','UJI','satuan','Dus','satuan_tengah','Roll','faktor_tengah',48,
    'satuan_kecil','cm','isi_kecil_per_tengah',760,'satuan_po','roll','peruntukan','keduanya'), 'uji t5 buat');
  IF (SELECT faktor_tampilan FROM bahan_baku WHERE id = v_id) <> 36480
     OR (SELECT faktor_konversi FROM bahan_baku WHERE id = v_id) <> 760 THEN
    RAISE EXCEPTION 'GAGAL (a): faktor salah';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM master_bahan_audit WHERE baris_id = v_id AND aksi = 'INSERT' AND alasan = 'uji t5 buat') THEN
    RAISE EXCEPTION 'GAGAL (a): audit INSERT tak tercatat';
  END IF;

  -- (b) nama kembar (aktif, beda huruf) ditolak
  v_ok := false;
  BEGIN
    PERFORM public.simpan_bahan_baku(NULL, jsonb_build_object('nama','uji t5 foil','kategori','UJI','satuan','Pcs','isi_kecil_per_tengah',1), NULL);
  EXCEPTION WHEN unique_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (b): nama kembar diterima'; END IF;

  -- (c) kunci liar ditolak
  v_ok := false;
  BEGIN
    PERFORM public.simpan_bahan_baku(v_id, jsonb_build_object('faktor_konversi', 5), NULL);
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): kunci liar diterima'; END IF;

  -- (d) ubah batas minimum & ikut opname
  PERFORM public.simpan_bahan_baku(v_id, jsonb_build_object('default_reorder_point', 2, 'is_opname', false), 'uji t5 edit');
  IF (SELECT default_reorder_point FROM bahan_baku WHERE id = v_id) <> 2
     OR (SELECT is_opname FROM bahan_baku WHERE id = v_id) THEN
    RAISE EXCEPTION 'GAGAL (d): edit tak tersimpan';
  END IF;

  -- (e) satuan bahan ber-riwayat stok tak bisa diubah lewat simpan
  v_ok := false;
  BEGIN
    PERFORM public.simpan_bahan_baku(v_hg, jsonb_build_object('satuan','Dus','satuan_tengah','Box','faktor_tengah',50,
      'satuan_kecil','Lembar','isi_kecil_per_tengah',100), 'uji');
  EXCEPTION WHEN raise_exception THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (e): satuan ber-riwayat bisa diubah'; END IF;

  -- (f) SKU: buat, jadikan default, hapus
  v_sku := public.simpan_sku(NULL, v_id, jsonb_build_object('nama_kemasan','Dus','qty_isi',1,'harga_beli',0));
  PERFORM public.set_default_sku(v_sku);
  IF NOT (SELECT is_default FROM bahan_baku_sku WHERE id = v_sku) THEN RAISE EXCEPTION 'GAGAL (f): default'; END IF;
  PERFORM public.hapus_sku(v_sku);

  -- (g) bahan baru tanpa referensi bisa dihapus
  PERFORM public.hapus_bahan_baku(v_id, 'uji t5 hapus');
  IF EXISTS (SELECT 1 FROM bahan_baku WHERE id = v_id) THEN RAISE EXCEPTION 'GAGAL (g): tak terhapus'; END IF;

  -- (h) bahan ber-riwayat tak bisa dihapus, pesannya menyebut penghalang
  v_ok := false;
  BEGIN
    PERFORM public.hapus_bahan_baku(v_hg, 'uji');
  EXCEPTION WHEN raise_exception THEN v_ok := true; GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
  END;
  IF NOT v_ok OR v_msg NOT LIKE '%ledger_stok%' THEN RAISE EXCEPTION 'GAGAL (h): %', v_msg; END IF;

  -- (i) nonaktifkan ditolak bila saldo ≠ 0
  IF EXISTS (SELECT 1 FROM stok_balance WHERE bahan_baku_id = v_hg AND saldo <> 0) THEN
    v_ok := false;
    BEGIN
      PERFORM public.nonaktifkan_bahan_baku(v_hg, 'uji');
    EXCEPTION WHEN raise_exception THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (i): nonaktif bahan bersaldo diterima'; END IF;
  END IF;

  -- (j) bahan bersih bisa dinonaktifkan & diaktifkan lagi; alasan kosong ditolak
  v_id2 := public.simpan_bahan_baku(NULL, jsonb_build_object('nama','UJI T5 BERSIH','kategori','UJI','satuan','Pcs','isi_kecil_per_tengah',1), NULL);
  v_ok := false;
  BEGIN
    PERFORM public.nonaktifkan_bahan_baku(v_id2, ' ');
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (j): nonaktif tanpa alasan diterima'; END IF;
  PERFORM public.nonaktifkan_bahan_baku(v_id2, 'uji t5 nonaktif');
  IF (SELECT is_active FROM bahan_baku WHERE id = v_id2) THEN RAISE EXCEPTION 'GAGAL (j): tetap aktif'; END IF;
  PERFORM public.aktifkan_bahan_baku(v_id2, 'uji t5 aktif');

  -- (l) ubah satuan bahan tanpa riwayat -> harga master diturunkan ulang dari katalog
  --     terpercaya (turunan bergantung faktor_tampilan; keputusan controller Task 4).
  v_id3 := public.simpan_bahan_baku(NULL, jsonb_build_object('nama','UJI T5 SATUAN','kategori','UJI',
    'satuan','Dus','satuan_kecil','Pcs','isi_kecil_per_tengah',10), 'uji t5 satuan');
  RESET ROLE;
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga,
                                   is_active, perlu_ditinjau, sumber, harga_updated_at)
  VALUES (v_id3, v_sup, 'dus', 10, 1000, true, false, 'manual', now());
  SELECT harga_beli INTO v_harga FROM bahan_baku_harga WHERE bahan_baku_id = v_id3;
  IF v_harga IS DISTINCT FROM 1000 THEN RAISE EXCEPTION 'GAGAL (l): fixture harga awal %', v_harga; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.simpan_bahan_baku(v_id3, jsonb_build_object('satuan','Dus','satuan_kecil','Pcs',
    'isi_kecil_per_tengah',20), 'uji t5 ganti isi');
  RESET ROLE;
  IF (SELECT faktor_tampilan FROM bahan_baku WHERE id = v_id3) <> 20 THEN RAISE EXCEPTION 'GAGAL (l): faktor tak berubah'; END IF;
  SELECT harga_beli INTO v_harga FROM bahan_baku_harga WHERE bahan_baku_id = v_id3;
  IF v_harga IS DISTINCT FROM 2000 THEN
    RAISE EXCEPTION 'GAGAL (l): harga master tak diturunkan ulang (harga_beli=%, harap 2000)', v_harga;
  END IF;

  -- (k) purchasing ditolak untuk lingkup data
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN
    PERFORM public.simpan_bahan_baku(v_id2, jsonb_build_object('nama','X'), NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (k): purchasing bisa ubah data bahan'; END IF;
  RAISE NOTICE 'HASIL T5: LULUS';
END $$;
ROLLBACK;
