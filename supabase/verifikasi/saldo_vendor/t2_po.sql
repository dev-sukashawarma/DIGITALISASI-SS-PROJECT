-- supabase/verifikasi/saldo_vendor/t2_po.sql — harapan "HASIL T2: LULUS"
BEGIN;
DO $$
DECLARE v_sapi uuid; v_ayam uuid; v_dj uuid; v_po uuid; v_ledger uuid; v_n int; v_qty numeric;
BEGIN
  SELECT id INTO v_sapi FROM bahan_baku WHERE nama='SAPI';
  SELECT id INTO v_ayam FROM bahan_baku WHERE nama='AYAM';
  SELECT id INTO v_dj FROM supplier WHERE nama ILIKE 'Djafafood%';
  SELECT id INTO v_po FROM purchase_order WHERE supplier_id = v_dj ORDER BY created_at DESC LIMIT 1;
  IF v_po IS NULL THEN RAISE EXCEPTION 'GAGAL: tak ada PO Djafafood untuk fixture'; END IF;

  -- (a) pembelian_supplier SAPI ber-PO di gudang → 1 mutasi po, qty sama, vendor Djafafood
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_po_id, catatan)
  VALUES (public.gudang_pusat_id(), v_sapi, 'pembelian_supplier', 4000, v_po, 'UJI t2') RETURNING id INTO v_ledger;
  SELECT count(*), max(qty) INTO v_n, v_qty FROM stok_vendor_gudang_mutasi
   WHERE ref_ledger_id = v_ledger AND sumber='po' AND vendor_id = public.vendor_induk(v_dj);
  IF v_n <> 1 OR v_qty <> 4000 THEN RAISE EXCEPTION 'GAGAL (a): n=% qty=%', v_n, v_qty; END IF;

  -- (b) bahan satu-vendor → nol mutasi
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_po_id, catatan)
  VALUES (public.gudang_pusat_id(), v_ayam, 'pembelian_supplier', 1000, v_po, 'UJI t2') RETURNING id INTO v_ledger;
  IF EXISTS (SELECT 1 FROM stok_vendor_gudang_mutasi WHERE ref_ledger_id = v_ledger) THEN RAISE EXCEPTION 'GAGAL (b): AYAM dapat mutasi'; END IF;

  -- (c) outlet lain / tanpa PO → nol mutasi
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
  VALUES (public.gudang_pusat_id(), v_sapi, 'adjustment', 100, 'UJI t2') RETURNING id INTO v_ledger;
  IF EXISTS (SELECT 1 FROM stok_vendor_gudang_mutasi WHERE ref_ledger_id = v_ledger) THEN RAISE EXCEPTION 'GAGAL (c): adjustment dapat mutasi'; END IF;

  RAISE EXCEPTION 'HASIL T2: LULUS (PO multi-vendor tercatat sekali, satu-vendor & adjustment diabaikan)';
END $$;
ROLLBACK;
