-- Perbaikan review akhir retur vendor (2026-11-18).
-- I1: Ganti Satuan (20261109104240) tak tahu tabel baru:
--     * _rencana_ganti_satuan: retur vendor yang belum selesai jadi penghalang;
--     * ganti_satuan_bahan: konversi purchase_order_item.qty_ditolak dan
--       retur_vendor_item.qty / harga / qty_pengganti_diterima (nilai rupiah tetap).
--     Diubah terarah dari pg_get_functiondef live (opsi SET ikut), dengan penjaga.
-- I3: PO yang kembali 'unpaid' (mis. transaksi kas di-void di luar tolak_bayar_po)
--     melepas baris kredit vendor miliknya, agar kredit tidak hangus.

DO $patch$
DECLARE
  v_def text; v_baru text; n int;
BEGIN
  -- I1a: penghalang
  v_def := pg_get_functiondef('public._rencana_ganti_satuan(uuid, jsonb, numeric)'::regprocedure);
  IF position('''jenis'',''retur_vendor''' in v_def) = 0 THEN
    n := (length(v_def) - length(replace(v_def, $$    UNION ALL
    SELECT jsonb_build_object('jenis','substitusi'$$, ''))) / length($$    UNION ALL
    SELECT jsonb_build_object('jenis','substitusi'$$);
    IF n <> 1 THEN RAISE EXCEPTION 'Patch penghalang: titik sisip ditemukan % kali', n; END IF;
    v_baru := replace(v_def, $$    UNION ALL
    SELECT jsonb_build_object('jenis','substitusi'$$, $$    UNION ALL
    SELECT jsonb_build_object('jenis','retur_vendor','id',rv.id,'nomor',rv.nomor,'outlet',NULL)
      FROM public.retur_vendor rv
     WHERE rv.status NOT IN ('selesai','ditolak','dibatalkan')
       AND EXISTS (SELECT 1 FROM public.retur_vendor_item i WHERE i.retur_vendor_id = rv.id AND i.bahan_baku_id = p_bahan)
    UNION ALL
    SELECT jsonb_build_object('jenis','substitusi'$$);
    EXECUTE v_baru;
  END IF;

  -- I1b: konversi
  v_def := pg_get_functiondef('public.ganti_satuan_bahan(uuid, jsonb, numeric, text)'::regprocedure);
  IF position('retur_vendor_item' in v_def) = 0 THEN
    n := (length(v_def) - length(replace(v_def, 'qty_terima = qty_terima * v_kb,
         harga_pesan = harga_pesan / v_kb', ''))) / length('qty_terima = qty_terima * v_kb,
         harga_pesan = harga_pesan / v_kb');
    IF n <> 1 THEN RAISE EXCEPTION 'Patch konversi PO: titik ditemukan % kali', n; END IF;
    v_baru := replace(v_def, 'qty_terima = qty_terima * v_kb,
         harga_pesan = harga_pesan / v_kb', 'qty_terima = qty_terima * v_kb, qty_ditolak = qty_ditolak * v_kb,
         harga_pesan = harga_pesan / v_kb');
    n := (length(v_baru) - length(replace(v_baru, $$v_n := v_n || jsonb_build_object('po_item', v_c);$$, ''))) / length($$v_n := v_n || jsonb_build_object('po_item', v_c);$$);
    IF n <> 1 THEN RAISE EXCEPTION 'Patch konversi retur: titik ditemukan % kali', n; END IF;
    v_baru := replace(v_baru, $$v_n := v_n || jsonb_build_object('po_item', v_c);$$, $$v_n := v_n || jsonb_build_object('po_item', v_c);
  UPDATE public.retur_vendor_item SET qty = qty * v_kb, harga = harga / v_kb,
         qty_pengganti_diterima = qty_pengganti_diterima * v_kb WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('retur_vendor_item', v_c);$$);
    EXECUTE v_baru;
  END IF;

  -- penjaga: opsi fungsi tetap ada
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ganti_satuan_bahan' AND 'search_path=public' = ANY (proconfig))
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_rencana_ganti_satuan' AND 'search_path=public' = ANY (proconfig)) THEN
    RAISE EXCEPTION 'search_path ganti satuan hilang';
  END IF;
END $patch$;

-- I3: lepaskan kredit saat PO kembali belum dibayar.
CREATE OR REPLACE FUNCTION public.po_lepas_kredit_saat_unpaid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_status = 'unpaid' AND OLD.payment_status IS DISTINCT FROM 'unpaid' THEN
    DELETE FROM vendor_kredit WHERE purchase_order_id = NEW.id AND jumlah < 0;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.po_lepas_kredit_saat_unpaid() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_po_lepas_kredit_saat_unpaid ON public.purchase_order;
CREATE TRIGGER trg_po_lepas_kredit_saat_unpaid
  AFTER UPDATE OF payment_status ON public.purchase_order
  FOR EACH ROW EXECUTE FUNCTION public.po_lepas_kredit_saat_unpaid();
