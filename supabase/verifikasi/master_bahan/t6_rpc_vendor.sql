-- supabase/verifikasi/master_bahan/t6_rpc_vendor.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE
  v_purch uuid; v_kitchen uuid; v_bahan uuid; v_sup uuid; v_bbs uuid; v_ok boolean; v_msg text;
  v_bahan2 uuid; v_sup2a uuid; v_sup2b uuid; v_bbs2a uuid; v_bbs2b uuid;
  v_bahan3 uuid; v_sup_i uuid; v_sup_j uuid;
BEGIN
  SELECT id INTO v_purch   FROM outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen'    AND status='active' LIMIT 1;
  IF v_purch IS NULL OR v_kitchen IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture staf'; END IF;

  INSERT INTO bahan_baku (nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, kategori)
  VALUES ('UJI T6 FOIL', 'Dus', 'Roll', 48, 'cm', 36480, 'UJI') RETURNING id INTO v_bahan;
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli) VALUES (v_bahan, 554592);

  INSERT INTO bahan_baku (nama, satuan, satuan_kecil, faktor_tampilan, kategori)
  VALUES ('UJI T6 KEDUA', 'Pack', 'Pcs', 10, 'UJI') RETURNING id INTO v_bahan2;
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli) VALUES (v_bahan2, 1000);

  INSERT INTO bahan_baku (nama, satuan, satuan_kecil, faktor_tampilan, kategori)
  VALUES ('UJI T6 GRAM', 'Dus', 'gram', 5000, 'UJI') RETURNING id INTO v_bahan3;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- (a) purchasing membuat supplier & harga vendor; master ikut, riwayat membawa alasan
  v_sup := public.simpan_supplier(NULL, jsonb_build_object('nama','UJI T6 VENDOR','termin_hari',15), 'uji t6 supplier');
  v_bbs := public.simpan_harga_vendor(v_bahan, v_sup, 12000, 'roll', 760, 'uji t6 harga naik');
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan) - 576000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (a): master tak mengikuti (%)', (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM bahan_baku_supplier_history WHERE bahan_baku_supplier_id = v_bbs AND catatan = 'uji t6 harga naik') THEN
    RAISE EXCEPTION 'GAGAL (a): alasan tak masuk riwayat katalog';
  END IF;

  -- (b) alasan kosong ditolak
  v_ok := false;
  BEGIN PERFORM public.simpan_harga_vendor(v_bahan, v_sup, 12000, 'roll', 760, '  ');
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (b): tanpa alasan diterima'; END IF;

  -- (c) isi per satuan beli beda dengan master (roll 500 cm) ditolak — pecah dulu
  v_ok := false;
  BEGIN PERFORM public.simpan_harga_vendor(v_bahan, v_sup, 8791, 'roll', 500, 'uji');
  EXCEPTION WHEN raise_exception THEN v_ok := true; GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT; END;
  IF NOT v_ok OR v_msg NOT LIKE '%dipecah%' THEN RAISE EXCEPTION 'GAGAL (c): %', v_msg; END IF;

  -- (d) harga per Dus diketik sebagai harga per roll (48x) ditolak kecuali dipaksa
  v_ok := false;
  BEGIN PERFORM public.simpan_harga_vendor(v_bahan, v_sup, 576000, 'roll', 760, 'uji salah satuan');
  EXCEPTION WHEN raise_exception THEN v_ok := true; GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT; END;
  IF NOT v_ok OR v_msg NOT LIKE '%salah satuan%' THEN RAISE EXCEPTION 'GAGAL (d): %', v_msg; END IF;
  PERFORM public.simpan_harga_vendor(v_bahan, v_sup, 576000, 'roll', 760, 'uji dipaksa', true);

  -- (e) nonaktifkan baris katalog
  PERFORM public.nonaktifkan_harga_vendor(v_bbs, 'uji t6 stop');
  IF (SELECT is_active FROM bahan_baku_supplier WHERE id = v_bbs) THEN RAISE EXCEPTION 'GAGAL (e)'; END IF;

  -- (f) nama supplier kembar ditolak
  v_ok := false;
  BEGIN PERFORM public.simpan_supplier(NULL, jsonb_build_object('nama','uji t6 vendor'), NULL);
  EXCEPTION WHEN unique_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): supplier kembar diterima'; END IF;

  -- (h) ledger: dua vendor terpercaya, yang lain lebih baru; konfirmasi ulang vendor A
  -- (harga sama) lewat RPC membuat master mengikuti A lagi, karena RPC memaksa
  -- harga_updated_at = now() eksplisit di INSERT maupun ON CONFLICT DO UPDATE.
  v_sup2a := public.simpan_supplier(NULL, jsonb_build_object('nama','UJI T6 VENDOR A'), 'uji t6 vendor a');
  v_sup2b := public.simpan_supplier(NULL, jsonb_build_object('nama','UJI T6 VENDOR B'), 'uji t6 vendor b');

  -- A dulu, lalu dimundurkan waktunya (simulasi harga lama)
  v_bbs2a := public.simpan_harga_vendor(v_bahan2, v_sup2a, 1000, 'pack', 10, 'uji t6 harga a awal');
  UPDATE bahan_baku_supplier SET harga_updated_at = now() - interval '1 hour' WHERE id = v_bbs2a;

  -- B lebih baru dari A (tapi tetap sebelum "sekarang") → master ikut B
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, harga_updated_at)
  VALUES (v_bahan2, v_sup2b, 'pack', 10, 1200, now() - interval '30 minutes') RETURNING id INTO v_bbs2b;
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan2) - 1200) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (h): master belum ikut vendor B (%)', (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan2);
  END IF;

  -- Konfirmasi ulang A dengan harga SAMA (1000) — RPC wajib membumbungkan
  -- harga_updated_at ke sekarang, melewati B, walau harga tak berubah.
  PERFORM public.simpan_harga_vendor(v_bahan2, v_sup2a, 1000, 'pack', 10, 'uji t6 konfirmasi ulang a');
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan2) - 1000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (h): master tak kembali ikut A setelah konfirmasi ulang (%)', (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan2);
  END IF;
  IF (SELECT harga_updated_at FROM bahan_baku_supplier WHERE id = v_bbs2a) <= (SELECT harga_updated_at FROM bahan_baku_supplier WHERE id = v_bbs2b) THEN
    RAISE EXCEPTION 'GAGAL (h): harga_updated_at A tak dibumbungkan melewati B';
  END IF;

  -- (i) label 'kg' tak dikenal hitung_faktor_po(), tapi bahan bersatuan kecil gram —
  -- perlakukan isi master sebagai 1000 (aturan K1/(a) fix round 1) supaya guard isi
  -- normal berlaku: isi 1 (salah) ditolak, isi 1000 (benar) diterima & master ikut.
  v_sup_i := public.simpan_supplier(NULL, jsonb_build_object('nama','UJI T6 VENDOR GRAM'), 'uji t6 vendor gram');
  v_ok := false;
  BEGIN PERFORM public.simpan_harga_vendor(v_bahan3, v_sup_i, 200, 'kg', 1, 'uji t6 kg isi salah');
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (i-1): label kg dengan isi 1 (salah) diterima, harusnya ditolak guard isi'; END IF;

  PERFORM public.simpan_harga_vendor(v_bahan3, v_sup_i, 200, 'kg', 1000, 'uji t6 kg isi benar');
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan3) - 1000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (i-2): master kg/gram salah (%)', (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan3);
  END IF;

  -- (j) label 'rol' (typo, bukan tingkat mana pun) ditolak 22023 tanpa paksa;
  -- diterima dengan p_paksa=true.
  v_sup_j := public.simpan_supplier(NULL, jsonb_build_object('nama','UJI T6 VENDOR ROL'), 'uji t6 vendor rol');
  v_ok := false;
  BEGIN PERFORM public.simpan_harga_vendor(v_bahan, v_sup_j, 11554, 'rol', 760, 'uji t6 label rol tanpa paksa');
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (j-1): label rol (typo) diterima tanpa paksa'; END IF;
  PERFORM public.simpan_harga_vendor(v_bahan, v_sup_j, 11554, 'rol', 760, 'uji t6 label rol paksa', true);

  -- (g) kitchen ditolak
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM public.simpan_harga_vendor(v_bahan, v_sup, 12000, 'roll', 760, 'uji');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g): kitchen bisa ubah harga vendor'; END IF;
  RAISE NOTICE 'HASIL T6: LULUS';
END $$;
ROLLBACK;
