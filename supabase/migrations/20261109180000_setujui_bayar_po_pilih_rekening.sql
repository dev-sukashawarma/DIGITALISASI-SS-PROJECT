-- Setujui pembayaran vendor kini bisa memilih / mengganti rekening sumber dana.
-- Sebelumnya rekening dikunci sejak pengajuan (dari pilihan saat Approval PO, atau
-- Rekening Bahan Baku Bank); bila finance mentransfer dari rekening lain, tak ada
-- cara mencatatnya dengan benar.
--
-- p_cash_location_id NULL = tetap rekening pengajuan (perilaku lama, app versi lama
-- tetap jalan). Bila diisi: wajib rekening pusat aktif; rekening tunai tidak boleh
-- keluar melebihi saldonya (aturan sama dengan Transfer & Refund Dana). Rekening
-- pilihan juga disimpan di purchase_order.cash_location_id.
-- Badan selebihnya = definisi live (20261106150000).

DROP FUNCTION IF EXISTS public.setujui_bayar_po(uuid, text, text);

CREATE FUNCTION public.setujui_bayar_po(
  p_po_id uuid, p_proof_url text, p_catatan text DEFAULT NULL, p_cash_location_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_po record; v_tx record; v_lok cash_location%ROWTYPE; v_saldo numeric;
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

  SELECT id, status, amount, note, cash_location_id INTO v_tx
    FROM cash_transaction WHERE id = v_po.cash_transaction_id FOR UPDATE;
  IF NOT FOUND OR v_tx.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Transaksi pembayaran PO % tidak dalam status menunggu approval', v_po.nomor_po;
  END IF;

  SELECT * INTO v_lok FROM cash_location WHERE id = coalesce(p_cash_location_id, v_tx.cash_location_id);
  IF p_cash_location_id IS NOT NULL AND (v_lok.id IS NULL OR v_lok.grup IS NULL OR NOT v_lok.is_active) THEN
    RAISE EXCEPTION 'Pembayaran vendor hanya dari rekening pusat yang aktif' USING ERRCODE = 'check_violation';
  END IF;
  IF v_lok.kind = 'cash' THEN
    SELECT saldo INTO v_saldo FROM cash_balance WHERE cash_location_id = v_lok.id FOR UPDATE;
    IF coalesce(v_saldo, 0) < v_tx.amount THEN
      RAISE EXCEPTION 'Saldo % tidak mencukupi untuk membayar PO %', v_lok.label, v_po.nomor_po
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  PERFORM set_config('app.bayar_po', 'on', true);
  -- Rekening & status diubah dalam satu UPDATE: cash_apply_balance memotong NEW.cash_location_id.
  UPDATE cash_transaction
     SET status = 'paid', proof_url = p_proof_url, occurred_at = now(),
         cash_location_id = v_lok.id,
         approved_by = auth.uid(), approved_at = now(),
         note = concat_ws(' · ', nullif(btrim(v_tx.note), ''), nullif(btrim(p_catatan), ''))
   WHERE id = v_tx.id;
  UPDATE purchase_order SET paid_amount = v_tx.amount, cash_location_id = v_lok.id WHERE id = p_po_id;
  PERFORM set_config('app.bayar_po', 'off', true);
  RETURN v_tx.id;
END $$;

REVOKE ALL ON FUNCTION public.setujui_bayar_po(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.setujui_bayar_po(uuid, text, text, uuid) TO authenticated;
