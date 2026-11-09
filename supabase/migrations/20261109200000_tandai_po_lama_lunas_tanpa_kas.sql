-- PO lama (sebelum pencatatan kas bersih 1 November 2026) yang sudah dibayar di luar
-- sistem tapi masih tercatat "belum dibayar". Tanpa dipilah, antrean Tagihan Vendor
-- purchasing langsung berisi 90 PO Agustus-Oktober (Rp 1,51 M), sebagian besar sudah lunas.
--
-- tandai_po_lunas_tanpa_kas: admin finance/admin/owner/developer menandai PO lunas
-- TANPA transaksi kas (saldo rekening tidak bergerak, sama seperti PO lunas sebelum
-- alur approval). Hanya PO bertanggal sebelum 1 Nov 2026 yang sudah diterima & belum
-- dibayar; PO November wajib lewat Ajukan -> Setujui. Alasan wajib, pelaku & waktu
-- disimpan di kolom lunas_tanpa_kas_*. Satu PO yang tak memenuhi syarat menggagalkan
-- seluruh panggilan.
--
-- Penjaga po_jaga_kolom_bayar kini juga mencakup kolom lunas_tanpa_kas_* agar
-- penandaan tak bisa dipalsukan lewat UPDATE langsung.

ALTER TABLE public.purchase_order
  ADD COLUMN IF NOT EXISTS lunas_tanpa_kas_at     timestamptz,
  ADD COLUMN IF NOT EXISTS lunas_tanpa_kas_oleh   uuid REFERENCES public.outlet_staff(id),
  ADD COLUMN IF NOT EXISTS lunas_tanpa_kas_alasan text;

CREATE OR REPLACE FUNCTION public.po_jaga_kolom_bayar()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.payment_status         IS DISTINCT FROM OLD.payment_status
      OR NEW.paid_at                IS DISTINCT FROM OLD.paid_at
      OR NEW.paid_amount            IS DISTINCT FROM OLD.paid_amount
      OR NEW.cash_transaction_id    IS DISTINCT FROM OLD.cash_transaction_id
      OR NEW.lunas_tanpa_kas_at     IS DISTINCT FROM OLD.lunas_tanpa_kas_at
      OR NEW.lunas_tanpa_kas_oleh   IS DISTINCT FROM OLD.lunas_tanpa_kas_oleh
      OR NEW.lunas_tanpa_kas_alasan IS DISTINCT FROM OLD.lunas_tanpa_kas_alasan)
     AND coalesce(current_setting('app.bayar_po', true), '') <> 'on'
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Status pembayaran PO hanya bisa diubah lewat Ajukan/Setujui Pembayaran Vendor'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tandai_po_lunas_tanpa_kas(p_po_ids uuid[], p_alasan text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_jumlah int; v_tidak text; v_n int;
BEGIN
  IF NOT (kas_pencatat_ok()
          OR EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh menandai PO lama lunas' USING ERRCODE = '42501';
  END IF;
  IF btrim(coalesce(p_alasan, '')) = '' THEN
    RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(DISTINCT x) INTO v_jumlah FROM unnest(coalesce(p_po_ids, '{}')) x WHERE x IS NOT NULL;
  IF v_jumlah = 0 THEN RAISE EXCEPTION 'Pilih minimal satu PO' USING ERRCODE = 'check_violation'; END IF;

  PERFORM 1 FROM purchase_order WHERE id = ANY(p_po_ids) ORDER BY id FOR UPDATE;

  SELECT string_agg(coalesce(po.nomor_po, x::text), ', ') INTO v_tidak
    FROM (SELECT DISTINCT x FROM unnest(p_po_ids) x WHERE x IS NOT NULL) ids
    LEFT JOIN purchase_order po ON po.id = ids.x
   WHERE po.id IS NULL
      OR NOT (po.tanggal_po < DATE '2026-11-01'
              AND po.status IN ('sebagian_diterima', 'diterima_lengkap')
              AND po.payment_status = 'unpaid');
  IF v_tidak IS NOT NULL THEN
    RAISE EXCEPTION 'Hanya PO sebelum 1 November 2026 yang sudah diterima dan belum dibayar: %', v_tidak
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('app.bayar_po', 'on', true);
  UPDATE purchase_order po
     SET payment_status = 'paid',
         paid_at = now(),
         paid_amount = (SELECT coalesce(sum(i.subtotal), 0) FROM purchase_order_item i WHERE i.purchase_order_id = po.id),
         lunas_tanpa_kas_at = now(),
         lunas_tanpa_kas_oleh = auth.uid(),
         lunas_tanpa_kas_alasan = btrim(p_alasan)
   WHERE po.id = ANY(p_po_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.bayar_po', 'off', true);
  RETURN v_n;
END $$;

-- View antrean: tambah kolom penandaan lunas tanpa kas di akhir (definisi selebihnya = live).
CREATE OR REPLACE VIEW public.po_payable_spv AS
 SELECT po.id,
    po.nomor_po,
    po.supplier_id,
    po.supplier_nama,
    po.tanggal_po,
    po.status,
    po.payment_status,
    po.paid_at,
    po.cash_transaction_id,
    COALESCE(sum(poi.subtotal), (0)::numeric) AS total,
    po.cash_location_id,
    po.lunas_tanpa_kas_at,
    po.lunas_tanpa_kas_alasan
   FROM (purchase_order po
     LEFT JOIN purchase_order_item poi ON ((poi.purchase_order_id = po.id)))
  WHERE ((po.status = ANY (ARRAY['sebagian_diterima'::text, 'diterima_lengkap'::text])) AND is_finance())
  GROUP BY po.id;

REVOKE ALL ON FUNCTION public.tandai_po_lunas_tanpa_kas(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tandai_po_lunas_tanpa_kas(uuid[], text) TO authenticated;
