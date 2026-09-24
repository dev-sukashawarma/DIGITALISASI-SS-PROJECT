-- supabase/verifikasi/master_bahan/t11_sinkron_daftar_katalog.sql — harapan: tanpa error
-- Sinkron dua arah supplier.bahan_baku_ids (centang di Master Supplier) <-> bahan_baku_supplier
-- (katalog = tab Vendor), migration 20260924150000. Semua dalam transaksi, ROLLBACK di akhir.
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_sup uuid; v_a uuid; v_b uuid; v_c uuid; v_d uuid;
  v_harga_a numeric; v_row public.bahan_baku_supplier%ROWTYPE; v_bb_id uuid;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role = 'admin' AND status = 'active' LIMIT 1;
  -- Empat bahan aktif berharga master & ber-faktor, supaya simpan_harga_vendor bisa dipakai.
  SELECT b.id INTO v_a FROM bahan_baku b JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
   WHERE b.is_active AND b.faktor_tampilan > 0 AND h.harga_beli > 0 ORDER BY b.nama OFFSET 0 LIMIT 1;
  SELECT b.id INTO v_b FROM bahan_baku b JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
   WHERE b.is_active AND b.faktor_tampilan > 0 AND h.harga_beli > 0 ORDER BY b.nama OFFSET 1 LIMIT 1;
  SELECT b.id INTO v_c FROM bahan_baku b JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
   WHERE b.is_active AND b.faktor_tampilan > 0 AND h.harga_beli > 0 ORDER BY b.nama OFFSET 2 LIMIT 1;
  SELECT b.id INTO v_d FROM bahan_baku b JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
   WHERE b.is_active AND b.faktor_tampilan > 0 AND h.harga_beli > 0 ORDER BY b.nama OFFSET 3 LIMIT 1;
  SELECT h.harga_beli INTO v_harga_a FROM bahan_baku_harga h WHERE h.bahan_baku_id = v_a;
  IF v_admin IS NULL OR v_d IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- (a) supplier baru dengan dua centang -> dua baris katalog placeholder (harga 0, perlu ditinjau)
  v_sup := public.simpan_supplier(NULL, jsonb_build_object('nama', 'UJI T11 VENDOR', 'kategori', 'lainnya',
             'bahan_baku_ids', jsonb_build_array(v_a, v_b)), 'uji t11 buat');
  IF (SELECT count(*) FROM bahan_baku_supplier
       WHERE supplier_id = v_sup AND is_active AND perlu_ditinjau AND harga = 0 AND sumber = 'manual') <> 2 THEN
    RAISE EXCEPTION 'GAGAL (a): centang tidak membuat baris katalog placeholder';
  END IF;

  -- (b) beri harga A lewat tab Vendor -> baris A terpercaya
  PERFORM public.simpan_harga_vendor(v_a, v_sup, v_harga_a,
    (SELECT satuan FROM bahan_baku WHERE id = v_a), (SELECT faktor_tampilan FROM bahan_baku WHERE id = v_a),
    'uji t11 harga', true);
  IF NOT EXISTS (SELECT 1 FROM bahan_baku_supplier WHERE supplier_id = v_sup AND bahan_baku_id = v_a
                   AND is_active AND NOT perlu_ditinjau AND harga > 0) THEN
    RAISE EXCEPTION 'GAGAL (b): harga vendor A tak tersimpan';
  END IF;

  -- (c) uncheck A di Master Supplier -> baris katalog A nonaktif, B tetap
  PERFORM public.simpan_supplier(v_sup, jsonb_build_object('bahan_baku_ids', jsonb_build_array(v_b)), 'uji t11 lepas A');
  IF (SELECT is_active FROM bahan_baku_supplier WHERE supplier_id = v_sup AND bahan_baku_id = v_a) THEN
    RAISE EXCEPTION 'GAGAL (c): uncheck tidak menonaktifkan baris katalog';
  END IF;
  IF NOT (SELECT is_active FROM bahan_baku_supplier WHERE supplier_id = v_sup AND bahan_baku_id = v_b) THEN
    RAISE EXCEPTION 'GAGAL (c): baris yang tetap dicentang ikut nonaktif';
  END IF;

  -- (d) centang A lagi -> baris lama aktif kembali, harganya utuh (bukan dibuat ulang jadi 0)
  PERFORM public.simpan_supplier(v_sup, jsonb_build_object('bahan_baku_ids', jsonb_build_array(v_a, v_b)), 'uji t11 centang A');
  SELECT * INTO v_row FROM bahan_baku_supplier WHERE supplier_id = v_sup AND bahan_baku_id = v_a;
  IF NOT v_row.is_active OR v_row.harga <> v_harga_a OR v_row.perlu_ditinjau THEN
    RAISE EXCEPTION 'GAGAL (d): centang ulang tidak memulihkan baris lama (aktif=%, harga=%, tinjau=%)',
      v_row.is_active, v_row.harga, v_row.perlu_ditinjau;
  END IF;

  -- (e) nonaktifkan harga B dari tab Vendor -> B lepas dari daftar centang supplier
  SELECT id INTO v_bb_id FROM bahan_baku_supplier WHERE supplier_id = v_sup AND bahan_baku_id = v_b;
  PERFORM public.nonaktifkan_harga_vendor(v_bb_id, 'uji t11 nonaktif B');
  IF v_b = ANY ((SELECT bahan_baku_ids FROM supplier WHERE id = v_sup)::uuid[]) THEN
    RAISE EXCEPTION 'GAGAL (e): nonaktif di tab Vendor tidak melepas centang';
  END IF;

  -- (f) simpan harga C dari tab Vendor -> C ikut tercentang di Master Supplier
  PERFORM public.simpan_harga_vendor(v_c, v_sup, (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_c),
    (SELECT satuan FROM bahan_baku WHERE id = v_c), (SELECT faktor_tampilan FROM bahan_baku WHERE id = v_c),
    'uji t11 harga C', true);
  IF NOT v_c = ANY ((SELECT bahan_baku_ids FROM supplier WHERE id = v_sup)::uuid[]) THEN
    RAISE EXCEPTION 'GAGAL (f): harga baru di tab Vendor tidak mencentang bahan di supplier';
  END IF;

  -- (g) baris katalog yang tak pernah dicentang (drift lama) TIDAK disentuh saat supplier disimpan
  PERFORM public.simpan_harga_vendor(v_d, v_sup, (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_d),
    (SELECT satuan FROM bahan_baku WHERE id = v_d), (SELECT faktor_tampilan FROM bahan_baku WHERE id = v_d),
    'uji t11 harga D', true);
  RESET ROLE;
  UPDATE supplier SET bahan_baku_ids = array_remove(bahan_baku_ids, v_d) WHERE id = v_sup;   -- tiru drift
  SET LOCAL ROLE authenticated;
  PERFORM public.simpan_supplier(v_sup, jsonb_build_object('bahan_baku_ids', jsonb_build_array(v_a, v_c)), 'uji t11 simpan lagi');
  IF NOT (SELECT is_active FROM bahan_baku_supplier WHERE supplier_id = v_sup AND bahan_baku_id = v_d) THEN
    RAISE EXCEPTION 'GAGAL (g): baris katalog di luar selisih centang ikut dinonaktifkan';
  END IF;

  RAISE NOTICE 't11 LULUS';
END $$;
ROLLBACK;
