-- Migration: PO Approval pilih rekening
-- Memungkinkan admin finance memilih rekening sumber dana saat menyetujui PO di Hub Approval.
-- Rekening disimpan di purchase_order.cash_location_id dan digunakan saat pengajuan/realisasi bayar vendor.

-- 1. Tambah kolom cash_location_id di purchase_order
ALTER TABLE public.purchase_order
  ADD COLUMN IF NOT EXISTS cash_location_id uuid REFERENCES public.cash_location(id);

-- 2. Update approve_po_finance agar menerima p_cash_location_id
DROP FUNCTION IF EXISTS public.approve_po_finance(uuid);
DROP FUNCTION IF EXISTS public.approve_po_finance(uuid, uuid);

CREATE OR REPLACE FUNCTION public.approve_po_finance(p_po_id uuid, p_cash_location_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT public.can_approve_po() THEN
    RAISE EXCEPTION 'Hanya finance/owner/admin yang dapat approve PO'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT status INTO v_status FROM public.purchase_order WHERE id = p_po_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  IF v_status <> 'menunggu_approval_finance' THEN
    RAISE EXCEPTION 'PO tidak dalam status menunggu approval (status: %)', v_status;
  END IF;

  IF p_cash_location_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.cash_location WHERE id = p_cash_location_id AND is_active = true) THEN
      RAISE EXCEPTION 'Rekening kas tidak ditemukan atau tidak aktif';
    END IF;
  END IF;

  UPDATE public.purchase_order
    SET status = 'dikirim_ke_supplier',
        disetujui_finance_oleh = auth.uid(),
        disetujui_finance_at = now(),
        cash_location_id = coalesce(p_cash_location_id, cash_location_id),
        updated_at = now()
    WHERE id = p_po_id;
END; $$;

REVOKE ALL ON FUNCTION public.approve_po_finance(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_po_finance(uuid, uuid) TO authenticated;

-- 3. Update ajukan_bayar_po agar menggunakan cash_location_id dari PO bila ada
CREATE OR REPLACE FUNCTION public.ajukan_bayar_po(p_po_id uuid, p_catatan text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_po record; v_total numeric; v_lokasi uuid; v_tx uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active'
                 AND role IN ('purchasing', 'admin_finance', 'admin', 'owner', 'developer')) THEN
    RAISE EXCEPTION 'Hanya purchasing atau finance yang boleh mengajukan pembayaran vendor' USING ERRCODE = '42501';
  END IF;

  SELECT id, nomor_po, supplier_nama, status, payment_status, cash_location_id INTO v_po
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

  v_lokasi := v_po.cash_location_id;
  IF v_lokasi IS NULL THEN
    SELECT id INTO v_lokasi FROM cash_location
     WHERE grup = 'bahan_baku' AND kind = 'bank' AND is_active ORDER BY created_at LIMIT 1;
  END IF;
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

-- 4. Update po_payable_spv view agar memuat cash_location_id
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
  COALESCE(SUM(poi.subtotal), 0) AS total,
  po.cash_location_id
FROM public.purchase_order po
LEFT JOIN public.purchase_order_item poi ON poi.purchase_order_id = po.id
WHERE po.status IN ('sebagian_diterima', 'diterima_lengkap')
  AND public.is_finance()
GROUP BY po.id;

GRANT SELECT ON public.po_payable_spv TO authenticated;

-- 5. Update trg_approval_log_po agar memuat label rekening jika ada
CREATE OR REPLACE FUNCTION public.trg_approval_log_po()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_keputusan text; v_total numeric; v_rekening text;
BEGIN
  BEGIN
    IF OLD.status <> 'menunggu_approval_finance' THEN RETURN NEW; END IF;
    IF NEW.status = 'dikirim_ke_supplier' THEN v_keputusan := 'setuju';
    ELSIF NEW.status = 'draft' THEN v_keputusan := 'tolak';
    ELSE RETURN NEW;
    END IF;

    IF NEW.cash_location_id IS NOT NULL THEN
      SELECT label INTO v_rekening FROM cash_location WHERE id = NEW.cash_location_id;
    END IF;

    SELECT coalesce(sum(subtotal), 0) INTO v_total FROM purchase_order_item WHERE purchase_order_id = NEW.id;
    INSERT INTO approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu, waktu_urut)
    VALUES ('po', v_keputusan, NEW.id, NEW.supplier_nama,
            concat_ws(' · ', NEW.nomor_po, v_rekening), v_total,
            CASE WHEN v_keputusan = 'tolak' THEN
              nullif(btrim(substring(coalesce(NEW.catatan, '') from '.*\[Ditolak finance\]\s*(.*)$')), '') END,
            coalesce(auth.uid(), NEW.disetujui_finance_oleh), now(), now())
    ON CONFLICT (jenis, keputusan, sumber_id) DO UPDATE
      SET nominal = EXCLUDED.nominal, alasan = EXCLUDED.alasan, pelaku = EXCLUDED.pelaku,
          keterangan = EXCLUDED.keterangan,
          waktu = EXCLUDED.waktu, waktu_urut = EXCLUDED.waktu_urut, dari_data_lama = false;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'approval_log po gagal dicatat (%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;
