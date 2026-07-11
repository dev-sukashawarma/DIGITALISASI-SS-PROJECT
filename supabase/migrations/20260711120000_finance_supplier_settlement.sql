-- 20260711120000_finance_supplier_settlement.sql
-- M5 Finance P3: bayar PO (purchase_order) yang sudah diterima → arus kas treasury.
-- Aditif. PO RLS tetap milik admin/kitchen; finance baca lewat view definer ber-gate
-- is_finance(), tulis lewat RPC SECURITY DEFINER. Tak menyentuh policy PO existing.

-- 1. Kolom status pembayaran di purchase_order (aditif, idempotent).
ALTER TABLE public.purchase_order
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.purchase_order
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.purchase_order
  ADD COLUMN IF NOT EXISTS cash_transaction_id uuid REFERENCES public.cash_transaction(id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_payment_status_check') THEN
    ALTER TABLE public.purchase_order
      ADD CONSTRAINT purchase_order_payment_status_check
      CHECK (payment_status IN ('unpaid', 'pending', 'paid'));
  END IF;
END $$;

-- 2. View tagihan PO untuk finance (definer; hanya balik baris bila pemanggil finance).
--    Total = SUM(subtotal item). Hanya PO yang sudah diterima (sebagian/lengkap).
CREATE OR REPLACE VIEW public.po_payable_spv AS
SELECT
  po.id,
  po.nomor_po,
  po.supplier_id,
  po.supplier_nama,
  po.tanggal_po,
  po.status,
  po.payment_status,
  po.paid_at,
  po.cash_transaction_id,
  COALESCE(SUM(poi.subtotal), 0) AS total
FROM public.purchase_order po
LEFT JOIN public.purchase_order_item poi ON poi.purchase_order_id = po.id
WHERE po.status IN ('sebagian_diterima', 'diterima_lengkap')
  AND public.is_finance()
GROUP BY po.id;

GRANT SELECT ON public.po_payable_spv TO authenticated;

-- 3. RPC settle_purchase_order: buat cash_transaction (out) sebesar total PO.
CREATE OR REPLACE FUNCTION public.settle_purchase_order(
  p_po_id uuid, p_location uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric; v_nomor text; v_status text; v_pay text; tx uuid;
BEGIN
  IF NOT public.is_finance() THEN RAISE EXCEPTION 'forbidden: bukan finance'; END IF;

  SELECT po.nomor_po, po.status, po.payment_status,
         COALESCE(SUM(poi.subtotal), 0)
    INTO v_nomor, v_status, v_pay, v_total
  FROM public.purchase_order po
  LEFT JOIN public.purchase_order_item poi ON poi.purchase_order_id = po.id
  WHERE po.id = p_po_id
  GROUP BY po.id;

  IF v_nomor IS NULL THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  IF v_status NOT IN ('sebagian_diterima','diterima_lengkap') THEN
    RAISE EXCEPTION 'PO belum diterima, tak bisa dibayar';
  END IF;
  IF v_pay <> 'unpaid' THEN RAISE EXCEPTION 'PO sudah diproses pembayaran'; END IF;
  IF v_total <= 0 THEN RAISE EXCEPTION 'Nilai PO 0, tak ada yang dibayar'; END IF;

  INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category,
    source_type, source_id, note, status, created_by)
  VALUES (p_location, 'out', v_total, format('Bayar PO %s', v_nomor),
    'supplier_po', p_po_id, 'Settlement supplier', 'pending_approval', auth.uid())
  RETURNING id INTO tx;

  UPDATE public.purchase_order
    SET payment_status = 'pending', cash_transaction_id = tx
    WHERE id = p_po_id;

  RETURN tx;
END;
$$;

-- 4. Trigger sinkron pembayaran PO saat status cash_transaction (supplier_po) berubah.
CREATE OR REPLACE FUNCTION public.sync_supplier_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source_type <> 'supplier_po' OR NEW.source_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.status IN ('paid','reconciled') AND OLD.status NOT IN ('paid','reconciled') THEN
    UPDATE public.purchase_order SET payment_status = 'paid', paid_at = now()
      WHERE id = NEW.source_id;
  ELSIF NEW.status IN ('rejected','void') AND OLD.status NOT IN ('rejected','void') THEN
    UPDATE public.purchase_order SET payment_status = 'unpaid', cash_transaction_id = NULL, paid_at = NULL
      WHERE id = NEW.source_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_supplier_payment ON public.cash_transaction;
CREATE TRIGGER trg_sync_supplier_payment
  AFTER UPDATE OF status ON public.cash_transaction
  FOR EACH ROW EXECUTE FUNCTION public.sync_supplier_payment();

-- DOWN:
-- DROP TRIGGER trg_sync_supplier_payment ON public.cash_transaction;
-- DROP FUNCTION sync_supplier_payment(); DROP FUNCTION settle_purchase_order(uuid,uuid);
-- DROP VIEW po_payable_spv;
-- ALTER TABLE purchase_order DROP CONSTRAINT purchase_order_payment_status_check,
--   DROP COLUMN payment_status, DROP COLUMN paid_at, DROP COLUMN cash_transaction_id;
