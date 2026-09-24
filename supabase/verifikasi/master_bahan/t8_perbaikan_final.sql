-- supabase/verifikasi/master_bahan/t8_perbaikan_final.sql — harapan: tanpa error
-- Menutup temuan review akhir Tahap 1:
--   I1  ubah status aktif / hapus supplier hanya admin/owner/purchasing (menggeser harga master)
--   I2a baris katalog yang isinya tak konsisten dengan master tidak dipakai sebagai sumber harga
--   I2b harga_updated_at dari klien dijepit ke now() (tak boleh bertanggal masa depan)
--   M1  bahan yang masih ada di bahan_baku_substitusi tak bisa dinonaktifkan
BEGIN;
DO $$
DECLARE
  v_purch uuid; v_kitchen uuid; v_admin uuid; v_af uuid;
  v_bahan uuid; v_bahan2 uuid; v_sub_a uuid; v_sub_b uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_s4 uuid; v_bbs3 uuid;
  v_ok boolean; v_msg text; v_n int; v_ts timestamptz;
BEGIN
  SELECT id INTO v_purch   FROM outlet_staff WHERE role='purchasing'    AND status='active' LIMIT 1;
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen'       AND status='active' LIMIT 1;
  SELECT id INTO v_admin   FROM outlet_staff WHERE role='admin'         AND status='active' LIMIT 1;
  SELECT id INTO v_af      FROM outlet_staff WHERE role='admin_finance' AND status='active' LIMIT 1;
  IF v_purch IS NULL OR v_kitchen IS NULL OR v_admin IS NULL OR v_af IS NULL THEN
    RAISE EXCEPTION 'GAGAL: fixture staf';
  END IF;

  -- ── Fixture (sebagai postgres, SEBELUM berganti peran) ──────────────────────
  INSERT INTO bahan_baku (nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, kategori)
  VALUES ('UJI T8 FOIL', 'Dus', 'Roll', 48, 'cm', 36480, 'UJI') RETURNING id INTO v_bahan;
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli) VALUES (v_bahan, 554592);

  INSERT INTO bahan_baku (nama, satuan, satuan_kecil, faktor_tampilan, kategori)
  VALUES ('UJI T8 PACK', 'Pack', 'Pcs', 10, 'UJI') RETURNING id INTO v_bahan2;
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli) VALUES (v_bahan2, 1000);

  INSERT INTO bahan_baku (nama, satuan, kategori) VALUES ('UJI T8 SUB UTAMA', 'Pcs', 'UJI') RETURNING id INTO v_sub_a;
  INSERT INTO bahan_baku (nama, satuan, kategori) VALUES ('UJI T8 SUB PENGGANTI', 'Pcs', 'UJI') RETURNING id INTO v_sub_b;
  INSERT INTO bahan_baku_substitusi (bahan_baku_utama_id, bahan_baku_pengganti_id, urutan) VALUES (v_sub_a, v_sub_b, 1);

  INSERT INTO supplier (nama) VALUES ('UJI T8 VENDOR KONSISTEN') RETURNING id INTO v_s1;
  INSERT INTO supplier (nama) VALUES ('UJI T8 VENDOR ISI BEDA')  RETURNING id INTO v_s2;
  INSERT INTO supplier (nama) VALUES ('UJI T8 VENDOR STATUS')    RETURNING id INTO v_s3;
  INSERT INTO supplier (nama) VALUES ('UJI T8 VENDOR HAPUS')     RETURNING id INTO v_s4;

  -- Baris konsisten (roll 760 = 36480/48) lebih lama; baris tak konsisten (roll 500) lebih baru.
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, harga_updated_at)
  VALUES (v_bahan, v_s1, 'roll', 760, 11554, now() - interval '1 hour');
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, harga_updated_at)
  VALUES (v_bahan, v_s2, 'roll', 500, 8791, now() - interval '30 minutes');

  -- (a) I2a: baris isi-tak-konsisten tidak dipilih; master mengikuti baris konsisten
  IF (SELECT supplier_id FROM harga_vendor_terpercaya(v_bahan)) IS DISTINCT FROM v_s1 THEN
    RAISE EXCEPTION 'GAGAL (a): harga_vendor_terpercaya memilih baris isi tak konsisten (%)',
      (SELECT supplier_id FROM harga_vendor_terpercaya(v_bahan));
  END IF;
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan) - 554592) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (a): master tergeser baris isi tak konsisten (%)',
      (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan);
  END IF;

  -- (b) I2b: harga_updated_at masa depan dijepit ke now() — INSERT dan UPDATE
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, harga_updated_at)
  VALUES (v_bahan2, v_s3, 'pack', 10, 1000, now() + interval '1 day') RETURNING id, harga_updated_at INTO v_bbs3, v_ts;
  IF v_ts > now() THEN RAISE EXCEPTION 'GAGAL (b): INSERT masa depan tak dijepit (%)', v_ts; END IF;
  UPDATE bahan_baku_supplier SET harga_updated_at = now() + interval '2 days' WHERE id = v_bbs3
  RETURNING harga_updated_at INTO v_ts;
  IF v_ts > now() THEN RAISE EXCEPTION 'GAGAL (b): UPDATE masa depan tak dijepit (%)', v_ts; END IF;
  -- backdate tetap boleh (dipakai uji lain untuk menyusun urutan waktu)
  UPDATE bahan_baku_supplier SET harga_updated_at = now() - interval '1 hour' WHERE id = v_bbs3
  RETURNING harga_updated_at INTO v_ts;
  IF v_ts <> now() - interval '1 hour' THEN RAISE EXCEPTION 'GAGAL (b): backdate ikut diubah (%)', v_ts; END IF;

  -- (c) I1: kitchen tak boleh menonaktifkan / menghapus supplier; master tak bergeser
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN UPDATE supplier SET is_active = false WHERE id = v_s3;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): kitchen bisa menonaktifkan supplier'; END IF;
  v_ok := false;
  BEGIN DELETE FROM supplier WHERE id = v_s4;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): kitchen bisa menghapus supplier'; END IF;
  RESET ROLE;
  IF NOT (SELECT is_active FROM supplier WHERE id = v_s3) THEN RAISE EXCEPTION 'GAGAL (c): supplier tetap berubah'; END IF;
  IF NOT EXISTS (SELECT 1 FROM supplier WHERE id = v_s4) THEN RAISE EXCEPTION 'GAGAL (c): supplier terhapus'; END IF;
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan2) - 1000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (c): master bergeser';
  END IF;

  -- (d) admin_finance: ubah status ditolak, tapi edit kontak tetap boleh (sampai Tahap 2)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_af, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN UPDATE supplier SET is_active = false WHERE id = v_s3;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): admin_finance bisa menonaktifkan supplier'; END IF;
  UPDATE supplier SET kontak = 'uji t8 kontak' WHERE id = v_s3;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (d): admin_finance tak bisa edit kontak (row_count %)', v_n; END IF;
  RESET ROLE;
  IF (SELECT kontak FROM supplier WHERE id = v_s3) IS DISTINCT FROM 'uji t8 kontak' THEN
    RAISE EXCEPTION 'GAGAL (d): kontak tak tersimpan';
  END IF;

  -- (e) purchasing boleh menonaktifkan & menghapus supplier
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE supplier SET is_active = false WHERE id = v_s3;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (e): purchasing tak bisa menonaktifkan (row_count %)', v_n; END IF;
  DELETE FROM supplier WHERE id = v_s4;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (e): purchasing tak bisa menghapus (row_count %)', v_n; END IF;
  RESET ROLE;
  IF (SELECT is_active FROM supplier WHERE id = v_s3) THEN RAISE EXCEPTION 'GAGAL (e): masih aktif'; END IF;

  -- (f) M1: bahan utama maupun pengganti di substitusi tak bisa dinonaktifkan
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false; v_msg := NULL;
  BEGIN PERFORM public.nonaktifkan_bahan_baku(v_sub_b, 'uji t8 pengganti');
  EXCEPTION WHEN raise_exception THEN v_ok := true; GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT; END;
  IF NOT v_ok OR v_msg NOT LIKE '%substitusi%' THEN RAISE EXCEPTION 'GAGAL (f): pengganti bisa dinonaktifkan (%)', v_msg; END IF;
  v_ok := false; v_msg := NULL;
  BEGIN PERFORM public.nonaktifkan_bahan_baku(v_sub_a, 'uji t8 utama');
  EXCEPTION WHEN raise_exception THEN v_ok := true; GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT; END;
  IF NOT v_ok OR v_msg NOT LIKE '%substitusi%' THEN RAISE EXCEPTION 'GAGAL (f): utama bisa dinonaktifkan (%)', v_msg; END IF;
  RESET ROLE;

  RAISE NOTICE 'HASIL T8: LULUS';
END $$;
ROLLBACK;
