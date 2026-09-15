-- supabase/verifikasi/hpp_dinamis/t3_katalog_po.sql
-- Harapan: "HASIL T3: LULUS ..."
-- PERINGATAN: skrip ini mem-BEGIN sebuah transaksi dan mengakhirinya dengan
-- ROLLBACK di baris paling bawah -- ia mengasumsikan seluruh baris yang
-- dibuat (termasuk INSERT PO nyata `TEST/PO/T3` beserta item & ledger-nya
-- di kasus (e)) hilang lagi begitu blok ini selesai. AMAN hanya selama
-- dijalankan lewat kanal yang benar-benar membungkusnya dalam satu transaksi
-- (mis. `supabase db query --linked -f`). Jangan pernah jalankan lewat kanal
-- yang memisah setiap statement menjadi transaksi sendiri (auto-commit per
-- baris) -- itu akan membiarkan data uji ini menetap di DB produksi.
BEGIN;
DO $$
DECLARE v_foil uuid; v_eka uuid; v_kentang uuid; v_agro uuid; v_kitchen uuid;
        v_plastik_besar uuid; v_meyer uuid;
        v_po uuid; v_poi uuid; v_isi numeric; v_harga_katalog numeric; v_harga_master numeric;
        v_n int; v_ok boolean; v_n_hist int;
BEGIN
  SELECT id INTO v_foil FROM bahan_baku WHERE nama='FOIL';
  SELECT id INTO v_kentang FROM bahan_baku WHERE nama='KENTANG';
  SELECT s.id INTO v_eka FROM supplier s WHERE s.nama ILIKE 'Ekadharma%' LIMIT 1;
  SELECT s.id INTO v_agro FROM supplier s WHERE s.nama ILIKE '%Agro Boga%' LIMIT 1;
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen' AND status='active' LIMIT 1;
  SELECT id INTO v_plastik_besar FROM bahan_baku WHERE nama='PLASTIK BESAR';
  SELECT id INTO v_meyer FROM supplier s WHERE s.nama ILIKE '%Meyer Proteindo%' LIMIT 1;
  IF v_foil IS NULL OR v_eka IS NULL OR v_kentang IS NULL OR v_agro IS NULL OR v_kitchen IS NULL
     OR v_plastik_besar IS NULL OR v_meyer IS NULL THEN
    RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  -- (a) FOIL/Ekadharma: satuan_beli 'roll' (isi 760), master Dus (kemasan_qty 36480).
  --     Harga besar 554.592/Dus harus jadi 11.554/roll — BUKAN 554.592.
  SELECT isi_satuan_kecil INTO v_isi FROM bahan_baku_supplier WHERE bahan_baku_id=v_foil AND supplier_id=v_eka;
  IF v_isi IS NULL THEN RAISE EXCEPTION 'GAGAL (a): katalog FOIL/Eka tak ada'; END IF;
  PERFORM public.katalog_tulis_dari_po(v_foil, v_eka, 554592, NULL);
  SELECT harga INTO v_harga_katalog FROM bahan_baku_supplier WHERE bahan_baku_id=v_foil AND supplier_id=v_eka;
  IF abs(v_harga_katalog - 554592.0/36480*v_isi) > 0.5 THEN
    RAISE EXCEPTION 'GAGAL (a): FOIL katalog % (harap ~% per roll)', v_harga_katalog, 554592.0/36480*v_isi; END IF;

  -- (b) KENTANG/Agro: satuan_beli = satuan master -> harga apa adanya
  PERFORM public.katalog_tulis_dari_po(v_kentang, v_agro, 251000, NULL);
  SELECT harga, perlu_ditinjau INTO v_harga_katalog, v_ok FROM bahan_baku_supplier WHERE bahan_baku_id=v_kentang AND supplier_id=v_agro;
  IF v_harga_katalog <> 251000 OR v_ok THEN RAISE EXCEPTION 'GAGAL (b): % / ditinjau=%', v_harga_katalog, v_ok; END IF;

  -- (c) pasangan baru (KENTANG/Ekadharma) -> INSERT dengan satuan master
  PERFORM public.katalog_tulis_dari_po(v_kentang, v_eka, 240000, NULL);
  SELECT count(*) INTO v_n FROM bahan_baku_supplier WHERE bahan_baku_id=v_kentang AND supplier_id=v_eka AND sumber='po' AND harga=240000;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (c): baris baru tidak dibuat'; END IF;

  -- (d) riwayat katalog ikut bertambah (trigger bbs_tulis_riwayat)
  SELECT count(*) INTO v_n_hist FROM bahan_baku_supplier_history h
   JOIN bahan_baku_supplier bs ON bs.id=h.bahan_baku_supplier_id
  WHERE bs.bahan_baku_id=v_kentang AND bs.supplier_id=v_agro;
  IF v_n_hist < 1 THEN RAISE EXCEPTION 'GAGAL (d): riwayat katalog tidak ditulis'; END IF;

  -- (e) PO uji coba lewat verifikasi_terima_po TIDAK menulis katalog
  --     buat PO uji + item KENTANG/Agro, verifikasi sebagai kitchen
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO purchase_order (nomor_po, supplier_id, supplier_nama, status, dibuat_oleh)
  VALUES ('TEST/PO/T3', v_agro, 'Agro', 'dikirim_ke_supplier', v_kitchen) RETURNING id INTO v_po;
  INSERT INTO purchase_order_item (purchase_order_id, bahan_baku_id, qty_pesan, harga_pesan)
  VALUES (v_po, v_kentang, 1, 999999) RETURNING id INTO v_poi;
  PERFORM public.verifikasi_terima_po(v_po, jsonb_build_array(jsonb_build_object('id', v_poi, 'qty_datang', 1, 'harga_terima', 999999)));
  EXECUTE 'RESET ROLE';
  SELECT harga INTO v_harga_katalog FROM bahan_baku_supplier WHERE bahan_baku_id=v_kentang AND supplier_id=v_agro;
  IF v_harga_katalog = 999999 THEN RAISE EXCEPTION 'GAGAL (e): PO uji menulis katalog'; END IF;
  SELECT harga_beli INTO v_harga_master FROM bahan_baku_harga WHERE bahan_baku_id=v_kentang;
  IF v_harga_master = 999999 THEN RAISE EXCEPTION 'GAGAL (e): PO uji menulis master (guard lama rusak!)'; END IF;

  -- (f) kontrol negatif
  v_ok := false;
  BEGIN IF v_harga_katalog <> 999999 THEN RAISE EXCEPTION 'KONTROL'; END IF;
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): kontrol negatif'; END IF;

  -- (g) PLASTIK BESAR/Meyer: tak ada baris katalog sama sekali (fixture).
  --     satuan master 'Ikat', kemasan_qty 100 vs faktor_tampilan 250 -- cabang
  --     INSERT akan menulis isi_satuan_kecil=100 untuk satuan_beli='ikat',
  --     yang langsung ditolak cek_isi_kemasan_vendor pada penerimaan
  --     berikutnya. Guard baru harus menahan pembuatan barisnya: nol baris.
  SELECT count(*) INTO v_n FROM bahan_baku_supplier
   WHERE bahan_baku_id=v_plastik_besar AND supplier_id=v_meyer;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (g): fixture sudah punya baris katalog, tak bisa diuji'; END IF;
  PERFORM public.katalog_tulis_dari_po(v_plastik_besar, v_meyer, 25000, NULL);
  SELECT count(*) INTO v_n FROM bahan_baku_supplier
   WHERE bahan_baku_id=v_plastik_besar AND supplier_id=v_meyer;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (g): baris PLASTIK BESAR/Meyer dibuat, harusnya ditahan guard'; END IF;

  RAISE EXCEPTION 'HASIL T3: LULUS (FOIL per roll, KENTANG apa adanya, pasangan baru, riwayat, PO uji ditolak, kontrol negatif, PLASTIK BESAR ditahan guard)';
END $$;
ROLLBACK;
