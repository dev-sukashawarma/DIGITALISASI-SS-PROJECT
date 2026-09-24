-- supabase/verifikasi/master_bahan/t4b_katalog_tulis_k1.sql — harapan: tanpa error
-- K1: tulis katalog vendor (= tulis harga master lewat trigger turunan) hanya
-- admin/owner/purchasing yang aktif. Baca katalog tetap seperti sebelumnya.
BEGIN;
DO $$
DECLARE v_kitchen uuid; v_purch uuid; v_bahan uuid; v_s uuid; v_bbs uuid; v_n int; v_ok boolean; v_s2 uuid;
BEGIN
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen'    AND status='active' LIMIT 1;
  SELECT id INTO v_purch   FROM outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  IF v_kitchen IS NULL OR v_purch IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture staf tak lengkap'; END IF;

  -- fixture (sebagai pemilik, sebelum ganti peran)
  INSERT INTO bahan_baku (nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, kategori)
  VALUES ('UJI T4B BAHAN', 'Dus', 'Roll', 48, 'cm', 36480, 'UJI') RETURNING id INTO v_bahan;
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli) VALUES (v_bahan, 400000);
  INSERT INTO supplier (nama) VALUES ('UJI T4B VENDOR') RETURNING id INTO v_s;
  INSERT INTO supplier (nama) VALUES ('UJI T4B VENDOR 2') RETURNING id INTO v_s2;
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga)
  VALUES (v_bahan, v_s, 'dus', 36480, 500000) RETURNING id INTO v_bbs;
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan) - 500000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL fixture: master tidak mengikuti katalog awal';
  END IF;

  -- (a) kitchen: baca katalog tetap bisa
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF NOT EXISTS (SELECT 1 FROM bahan_baku_supplier WHERE id = v_bbs) THEN
    RAISE EXCEPTION 'GAGAL (a): kitchen tak bisa membaca katalog';
  END IF;

  -- (b) kitchen: UPDATE katalog tidak mengenai baris apa pun
  UPDATE bahan_baku_supplier SET harga = 999999 WHERE id = v_bbs;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (b): kitchen mengubah % baris katalog', v_n; END IF;

  -- (c) kitchen: INSERT katalog ditolak
  v_ok := false;
  BEGIN
    INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga)
    VALUES (v_bahan, v_s2, 'dus', 36480, 1);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): kitchen bisa INSERT katalog'; END IF;

  -- (d) kitchen: DELETE katalog tidak mengenai baris apa pun
  DELETE FROM bahan_baku_supplier WHERE id = v_bbs;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (d): kitchen menghapus % baris katalog', v_n; END IF;
  RESET ROLE;

  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan) - 500000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (b): master berubah oleh kitchen';
  END IF;

  -- (e) purchasing: UPDATE katalog berhasil, master mengikuti
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE bahan_baku_supplier SET harga = 550000 WHERE id = v_bbs;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (e): purchasing mengubah % baris (harapan 1)', v_n; END IF;
  RESET ROLE;
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan) - 550000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (e): master tidak mengikuti perubahan purchasing';
  END IF;
  RAISE NOTICE 'HASIL T4B: LULUS';
END $$;
ROLLBACK;
