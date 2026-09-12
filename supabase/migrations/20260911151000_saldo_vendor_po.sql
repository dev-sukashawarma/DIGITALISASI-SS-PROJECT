-- ledger_stok ada di publication realtime: DDL di sini pernah deadlock (2026-09-11).
-- Satu CREATE TRIGGER saja; bila gagal lock, ulangi.
SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.stok_vendor_dari_po() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vendor uuid;
BEGIN
  IF NOT public.bahan_multi_vendor(NEW.bahan_baku_id) THEN RETURN NULL; END IF;
  SELECT public.vendor_induk(po.supplier_id) INTO v_vendor FROM public.purchase_order po WHERE po.id = NEW.ref_po_id;
  IF v_vendor IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, ref_ledger_id, catatan, dibuat_oleh)
  VALUES (NEW.bahan_baku_id, v_vendor, NEW.qty, 'po', NEW.id, 'Terima PO', NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.stok_vendor_dari_po() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_stok_vendor_dari_po ON public.ledger_stok;
CREATE TRIGGER trg_stok_vendor_dari_po
  AFTER INSERT ON public.ledger_stok
  FOR EACH ROW
  WHEN (NEW.tipe = 'pembelian_supplier' AND NEW.ref_po_id IS NOT NULL
        AND NEW.outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'::uuid)
  EXECUTE FUNCTION public.stok_vendor_dari_po();
