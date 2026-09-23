-- supabase/verifikasi/master_bahan/t4_harga_turunan.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_bahan uuid; v_s1 uuid; v_s2 uuid; v_admin uuid; v_crew uuid; v_bbs uuid; v_h numeric;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role='crew'  AND status='active' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM supplier WHERE nama = 'Beli Tunai / Tanpa Vendor' AND is_active) THEN
    RAISE EXCEPTION 'GAGAL: supplier Beli Tunai / Tanpa Vendor tidak ada';
  END IF;

  INSERT INTO bahan_baku (nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, kategori)
  VALUES ('UJI T4 FOIL', 'Dus', 'Roll', 48, 'cm', 36480, 'UJI') RETURNING id INTO v_bahan;
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli) VALUES (v_bahan, 400000);
  INSERT INTO supplier (nama) VALUES ('UJI T4 VENDOR 1') RETURNING id INTO v_s1;
  INSERT INTO supplier (nama) VALUES ('UJI T4 VENDOR 2') RETURNING id INTO v_s2;

  -- (a) baris katalog terpercaya → master = harga / isi × faktor_tampilan
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga)
  VALUES (v_bahan, v_s1, 'roll', 760, 11554) RETURNING id INTO v_bbs;
  SELECT harga_beli INTO v_h FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan;
  IF abs(v_h - 554592) > 0.01 THEN RAISE EXCEPTION 'GAGAL (a): master % bukan 554592', v_h; END IF;
  IF NOT EXISTS (SELECT 1 FROM bahan_baku_harga_history WHERE bahan_baku_id = v_bahan AND catatan LIKE 'Turunan harga vendor%') THEN
    RAISE EXCEPTION 'GAGAL (a): riwayat turunan tak tercatat';
  END IF;
  IF (SELECT harga_updated_at FROM bahan_baku_supplier WHERE id = v_bbs) IS NULL THEN
    RAISE EXCEPTION 'GAGAL (a): harga_updated_at tak terisi';
  END IF;

  -- (b) satu-satunya baris jadi perlu_ditinjau → master DIBEKUKAN, tidak berubah
  UPDATE bahan_baku_supplier SET perlu_ditinjau = true, harga = 1 WHERE id = v_bbs;
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan) - 554592) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (b): master tidak dibekukan';
  END IF;
  IF (SELECT status FROM bahan_baku_status_harga WHERE bahan_baku_id = v_bahan) <> 'belum_dikonfirmasi' THEN
    RAISE EXCEPTION 'GAGAL (b): status bukan belum_dikonfirmasi';
  END IF;

  -- (c) vendor lain yang lebih baru → master mengikutinya
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, harga_updated_at)
  VALUES (v_bahan, v_s2, 'dus', 36480, 600000, now() + interval '1 minute');
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan) - 600000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (c): master tidak mengikuti vendor terbaru';
  END IF;

  -- (d) supplier dinonaktifkan → katalognya tak lagi dianggap terpercaya
  UPDATE supplier SET is_active = false WHERE id = v_s2;
  IF EXISTS (SELECT 1 FROM harga_vendor_terpercaya(v_bahan)) THEN
    RAISE EXCEPTION 'GAGAL (d): vendor nonaktif masih terpercaya';
  END IF;
  UPDATE supplier SET is_active = true WHERE id = v_s2;

  -- (e) crew tak bisa melihat harga vendor lewat fungsi (INVOKER + RLS katalog); admin bisa
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF NOT EXISTS (SELECT 1 FROM harga_vendor_terpercaya(v_bahan)) THEN
    RAISE EXCEPTION 'GAGAL (e): admin tak melihat harga vendor';
  END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF EXISTS (SELECT 1 FROM harga_vendor_terpercaya(v_bahan)) THEN
    RAISE EXCEPTION 'GAGAL (e): crew melihat harga vendor';
  END IF;
  RAISE NOTICE 'HASIL T4: LULUS';
END $$;
ROLLBACK;
