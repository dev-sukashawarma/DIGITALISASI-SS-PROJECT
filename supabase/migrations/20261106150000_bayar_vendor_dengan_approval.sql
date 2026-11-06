-- Pembayaran vendor (PO) dengan approval admin finance (keputusan owner 6 Nov 2026).
--
-- Alur:
--   1. Purchasing (atau admin_finance/admin/owner) MENGAJUKAN bayar PO yang sudah diterima:
--      ajukan_bayar_po -> cash_transaction 'pending_approval' di Rekening Bahan Baku Bank,
--      PO payment_status 'pending'. Saldo belum bergerak.
--   2. Admin finance (atau admin/owner) MENYETUJUI setelah mentransfer, bukti wajib:
--      setujui_bayar_po -> transaksi 'paid' (saldo terpotong lewat cash_apply_balance),
--      PO 'paid' lewat trigger sync_supplier_payment.
--      Atau MENOLAK: tolak_bayar_po -> transaksi 'rejected', PO kembali 'unpaid'.
--
-- Sebelumnya PO bisa ditandai lunas langsung dari form detail PO tanpa transaksi kas,
-- sehingga 53 PO "lunas" tak pernah memotong saldo rekening. Penjaga baru menolak
-- perubahan kolom pembayaran PO dari luar ketiga RPC ini (selain service role).

-- 0) Penjaga: kolom pembayaran PO hanya boleh diubah lewat RPC di bawah. RPC menyalakan
--    app.bayar_po hanya selama UPDATE-nya sendiri lalu mematikannya lagi.
CREATE OR REPLACE FUNCTION public.po_jaga_kolom_bayar()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.payment_status      IS DISTINCT FROM OLD.payment_status
      OR NEW.paid_at             IS DISTINCT FROM OLD.paid_at
      OR NEW.paid_amount         IS DISTINCT FROM OLD.paid_amount
      OR NEW.cash_transaction_id IS DISTINCT FROM OLD.cash_transaction_id)
     AND coalesce(current_setting('app.bayar_po', true), '') <> 'on'
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Status pembayaran PO hanya bisa diubah lewat Ajukan/Setujui Pembayaran Vendor'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_po_jaga_kolom_bayar ON public.purchase_order;
CREATE TRIGGER trg_po_jaga_kolom_bayar
  BEFORE UPDATE ON public.purchase_order
  FOR EACH ROW EXECUTE FUNCTION public.po_jaga_kolom_bayar();

-- 1) Ajukan
CREATE OR REPLACE FUNCTION public.ajukan_bayar_po(p_po_id uuid, p_catatan text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_po record; v_total numeric; v_lokasi uuid; v_tx uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active'
                 AND role IN ('purchasing', 'admin_finance', 'admin', 'owner', 'developer')) THEN
    RAISE EXCEPTION 'Hanya purchasing atau finance yang boleh mengajukan pembayaran vendor' USING ERRCODE = '42501';
  END IF;

  SELECT id, nomor_po, supplier_nama, status, payment_status INTO v_po
    FROM purchase_order WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  IF v_po.status NOT IN ('sebagian_diterima', 'diterima_lengkap') THEN
    RAISE EXCEPTION 'PO belum diterima, belum bisa diajukan pembayarannya';
  END IF;
  IF v_po.payment_status <> 'unpaid' THEN
    RAISE EXCEPTION 'PO % sudah diajukan atau sudah lunas', v_po.nomor_po;
  END IF;

  SELECT coalesce(sum(subtotal), 0) INTO v_total FROM purchase_order_item WHERE purchase_order_id = p_po_id;
  IF v_total <= 0 THEN RAISE EXCEPTION 'Nilai PO 0, tidak ada yang dibayar'; END IF;

  SELECT id INTO v_lokasi FROM cash_location
   WHERE grup = 'bahan_baku' AND kind = 'bank' AND is_active ORDER BY created_at LIMIT 1;
  IF v_lokasi IS NULL THEN RAISE EXCEPTION 'Rekening Bahan Baku Bank aktif tidak ditemukan'; END IF;

  INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, source_id,
    note, status, occurred_at, created_by)
  VALUES (v_lokasi, 'out', v_total,
    format('Bayar PO %s', v_po.nomor_po) || coalesce(' · ' || nullif(btrim(v_po.supplier_nama), ''), ''),
    'supplier_po', p_po_id, nullif(btrim(p_catatan), ''), 'pending_approval', now(), auth.uid())
  RETURNING id INTO v_tx;

  PERFORM set_config('app.bayar_po', 'on', true);
  UPDATE purchase_order SET payment_status = 'pending', cash_transaction_id = v_tx WHERE id = p_po_id;
  PERFORM set_config('app.bayar_po', 'off', true);
  RETURN v_tx;
END $$;

-- 2) Setujui (setelah transfer)
CREATE OR REPLACE FUNCTION public.setujui_bayar_po(p_po_id uuid, p_proof_url text, p_catatan text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_po record; v_tx record;
BEGIN
  IF NOT (kas_pencatat_ok()
          OR EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh menyetujui pembayaran vendor' USING ERRCODE = '42501';
  END IF;
  IF btrim(coalesce(p_proof_url, '')) = '' THEN RAISE EXCEPTION 'Bukti transfer wajib dilampirkan'; END IF;

  SELECT id, nomor_po, payment_status, cash_transaction_id INTO v_po
    FROM purchase_order WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  IF v_po.payment_status <> 'pending' OR v_po.cash_transaction_id IS NULL THEN
    RAISE EXCEPTION 'PO % tidak sedang menunggu approval pembayaran', v_po.nomor_po;
  END IF;

  SELECT id, status, amount, note INTO v_tx FROM cash_transaction WHERE id = v_po.cash_transaction_id FOR UPDATE;
  IF NOT FOUND OR v_tx.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Transaksi pembayaran PO % tidak dalam status menunggu approval', v_po.nomor_po;
  END IF;

  PERFORM set_config('app.bayar_po', 'on', true);
  UPDATE cash_transaction
     SET status = 'paid', proof_url = p_proof_url, occurred_at = now(),
         approved_by = auth.uid(), approved_at = now(),
         note = concat_ws(' · ', nullif(btrim(v_tx.note), ''), nullif(btrim(p_catatan), ''))
   WHERE id = v_tx.id;
  -- sync_supplier_payment sudah mengisi payment_status 'paid' & paid_at.
  UPDATE purchase_order SET paid_amount = v_tx.amount WHERE id = p_po_id;
  PERFORM set_config('app.bayar_po', 'off', true);
  RETURN v_tx.id;
END $$;

-- 3) Tolak
CREATE OR REPLACE FUNCTION public.tolak_bayar_po(p_po_id uuid, p_alasan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_po record; v_tx record;
BEGIN
  IF NOT (kas_pencatat_ok()
          OR EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh menolak pembayaran vendor' USING ERRCODE = '42501';
  END IF;
  IF btrim(coalesce(p_alasan, '')) = '' THEN RAISE EXCEPTION 'Alasan penolakan wajib diisi'; END IF;

  SELECT id, nomor_po, payment_status, cash_transaction_id INTO v_po
    FROM purchase_order WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  IF v_po.payment_status <> 'pending' OR v_po.cash_transaction_id IS NULL THEN
    RAISE EXCEPTION 'PO % tidak sedang menunggu approval pembayaran', v_po.nomor_po;
  END IF;

  SELECT id, status, note INTO v_tx FROM cash_transaction WHERE id = v_po.cash_transaction_id FOR UPDATE;
  IF NOT FOUND OR v_tx.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Transaksi pembayaran PO % tidak dalam status menunggu approval', v_po.nomor_po;
  END IF;

  PERFORM set_config('app.bayar_po', 'on', true);
  UPDATE cash_transaction
     SET status = 'rejected',
         note = concat_ws(' · ', nullif(btrim(v_tx.note), ''), '[Ditolak: ' || btrim(p_alasan) || ']')
   WHERE id = v_tx.id;
  -- sync_supplier_payment mengembalikan PO ke 'unpaid'.
  PERFORM set_config('app.bayar_po', 'off', true);
END $$;

-- 4) Jalur lama: settle_purchase_order kini hanya mengajukan (rekening selalu Bahan Baku Bank).
CREATE OR REPLACE FUNCTION public.settle_purchase_order(p_po_id uuid, p_location uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ajukan_bayar_po(p_po_id, NULL);
$$;

REVOKE ALL ON FUNCTION public.ajukan_bayar_po(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.setujui_bayar_po(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tolak_bayar_po(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_purchase_order(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajukan_bayar_po(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.setujui_bayar_po(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tolak_bayar_po(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_purchase_order(uuid, uuid) TO authenticated;
