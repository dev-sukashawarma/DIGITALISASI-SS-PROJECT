-- supabase/verifikasi/master_bahan/t7_regresi_jalur_lama.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_id uuid; v_sup uuid;
BEGIN
  -- (a) pola createBahanBakuAction (Tahap 0): insert bahan + SKU + harga sebagai service role
  SET LOCAL ROLE service_role;
  INSERT INTO bahan_baku (nama, kategori, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan,
                          faktor_konversi, is_active, is_fisik_checked)
  VALUES ('UJI T7 LAMA', 'UJI', 'tabung', NULL, NULL, 'gram', 12000, 12000, true, false) RETURNING id INTO v_id;
  INSERT INTO bahan_baku_sku (bahan_baku_id, nama_kemasan, qty_isi, harga_beli, is_default, is_active)
  VALUES (v_id, 'tabung', 1, 220000, true, true);
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty, kemasan_satuan, harga_updated_at)
  VALUES (v_id, 220000, 12000, 'gram', now());
  IF (SELECT kemasan_qty FROM bahan_baku_harga WHERE bahan_baku_id = v_id) <> 12000 THEN
    RAISE EXCEPTION 'GAGAL (a): kemasan_qty berubah';
  END IF;
  RESET ROLE;

  -- (b) pola katalog_tulis_dari_po: insert katalog sumber 'po' → master diturunkan, tidak error
  SELECT id INTO v_sup FROM supplier WHERE is_active LIMIT 1;
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, sumber, perlu_ditinjau, harga_updated_at)
  VALUES (v_id, v_sup, 'tabung', 12000, 230000, 'po', false, now());
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_id) - 230000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (b): master tidak mengikuti katalog dari PO';
  END IF;
  RAISE NOTICE 'HASIL T7: LULUS';
END $$;
ROLLBACK;
