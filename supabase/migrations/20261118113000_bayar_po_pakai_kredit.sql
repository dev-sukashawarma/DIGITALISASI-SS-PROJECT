-- Bayar PO memakai kredit vendor dari retur (2026-11-18), Plan Task 4.
-- Diturunkan dari definisi live ajukan/setujui/tolak_bayar_po (20261106150000,
-- 20261109180000) — perilaku lama dipertahankan saat kredit = 0.
--
-- Kredit dicadangkan (baris vendor_kredit −, status dicadangkan) saat diajukan,
-- jadi aktif saat disetujui, dihapus saat ditolak. paid_amount = bagian KAS saja;
-- bagian kredit dibaca dari vendor_kredit (kolom po_payable_spv.dibayar_kredit).
-- Kredit penuh: tidak ada transaksi kas; pegangan persetujuan = payment_status
-- 'pending' + baris kredit dicadangkan.

CREATE OR REPLACE FUNCTION public.saldo_kredit_vendor(p_supplier_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (retur_vendor_peran_ok('ajukan') OR retur_vendor_peran_ok('putus')) THEN
    RAISE EXCEPTION 'Tidak berhak melihat kredit vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN COALESCE((SELECT SUM(jumlah) FROM vendor_kredit WHERE vendor_induk = vendor_induk(p_supplier_id)), 0);
END $$;
REVOKE ALL ON FUNCTION public.saldo_kredit_vendor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_kredit_vendor(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.ajukan_bayar_po(uuid, text);
CREATE OR REPLACE FUNCTION public.ajukan_bayar_po(p_po_id uuid, p_catatan text DEFAULT NULL::text, p_pakai_kredit numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_po record; v_total numeric; v_lokasi uuid; v_tx uuid; v_kredit numeric := COALESCE(p_pakai_kredit, 0);
        v_induk uuid; v_saldo_kredit numeric; v_kas numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active'
                 AND role IN ('purchasing', 'admin_finance', 'admin', 'owner', 'developer')) THEN
    RAISE EXCEPTION 'Hanya purchasing atau finance yang boleh mengajukan pembayaran vendor' USING ERRCODE = '42501';
  END IF;

  SELECT id, nomor_po, supplier_id, supplier_nama, status, payment_status, cash_location_id INTO v_po
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

  IF v_kredit < 0 THEN RAISE EXCEPTION 'Kredit yang dipakai tidak boleh minus' USING ERRCODE = 'check_violation'; END IF;
  IF v_kredit > 0 THEN
    v_induk := vendor_induk(v_po.supplier_id);
    IF v_induk IS NULL THEN RAISE EXCEPTION 'PO % tidak punya vendor', v_po.nomor_po USING ERRCODE = 'check_violation'; END IF;
    IF v_kredit > v_total + 0.000001 THEN
      RAISE EXCEPTION 'Kredit yang dipakai melebihi tagihan PO %', v_po.nomor_po USING ERRCODE = 'check_violation';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('kredit:' || v_induk::text));
    SELECT COALESCE(SUM(jumlah), 0) INTO v_saldo_kredit FROM vendor_kredit WHERE vendor_induk = v_induk;
    IF v_kredit > v_saldo_kredit + 0.000001 THEN
      RAISE EXCEPTION 'Kredit vendor tinggal %, tidak cukup untuk dipakai %', v_saldo_kredit, v_kredit USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO vendor_kredit (vendor_induk, supplier_id, jumlah, status, purchase_order_id, catatan, dibuat_oleh)
    VALUES (v_induk, v_po.supplier_id, -v_kredit, 'dicadangkan', p_po_id, 'Dipakai untuk PO ' || v_po.nomor_po, auth.uid());
  END IF;
  v_kas := v_total - v_kredit;

  IF v_kas > 0.000001 THEN
    v_lokasi := v_po.cash_location_id;
    IF v_lokasi IS NULL THEN
      SELECT id INTO v_lokasi FROM cash_location
       WHERE grup = 'bahan_baku' AND kind = 'bank' AND is_active ORDER BY created_at LIMIT 1;
    END IF;
    IF v_lokasi IS NULL THEN RAISE EXCEPTION 'Rekening Bahan Baku Bank aktif tidak ditemukan'; END IF;

    INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, source_id,
      note, status, occurred_at, created_by)
    VALUES (v_lokasi, 'out', v_kas,
      format('Bayar PO %s', v_po.nomor_po) || coalesce(' · ' || nullif(btrim(v_po.supplier_nama), ''), ''),
      'supplier_po', p_po_id,
      concat_ws(' · ', nullif(btrim(p_catatan), ''), CASE WHEN v_kredit > 0 THEN 'Kredit retur dipakai ' || v_kredit END),
      'pending_approval', now(), auth.uid())
    RETURNING id INTO v_tx;
  END IF;

  PERFORM set_config('app.bayar_po', 'on', true);
  UPDATE purchase_order SET payment_status = 'pending', cash_transaction_id = v_tx WHERE id = p_po_id;
  PERFORM set_config('app.bayar_po', 'off', true);
  RETURN v_tx;
END $function$;
REVOKE ALL ON FUNCTION public.ajukan_bayar_po(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajukan_bayar_po(uuid, text, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.setujui_bayar_po(p_po_id uuid, p_proof_url text, p_catatan text DEFAULT NULL::text, p_cash_location_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_po record; v_tx record; v_lok cash_location%ROWTYPE; v_saldo numeric; v_kredit numeric;
BEGIN
  IF NOT (kas_pencatat_ok()
          OR EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh menyetujui pembayaran vendor' USING ERRCODE = '42501';
  END IF;
  IF btrim(coalesce(p_proof_url, '')) = '' THEN RAISE EXCEPTION 'Bukti transfer wajib dilampirkan'; END IF;

  SELECT id, nomor_po, supplier_nama, payment_status, cash_transaction_id INTO v_po
    FROM purchase_order WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  SELECT -COALESCE(SUM(jumlah), 0) INTO v_kredit FROM vendor_kredit WHERE purchase_order_id = p_po_id AND status = 'dicadangkan';

  -- Kredit penuh: tidak ada transaksi kas.
  IF v_po.payment_status = 'pending' AND v_po.cash_transaction_id IS NULL AND v_kredit > 0 THEN
    UPDATE vendor_kredit SET status = 'aktif' WHERE purchase_order_id = p_po_id AND status = 'dicadangkan';
    PERFORM set_config('app.bayar_po', 'on', true);
    UPDATE purchase_order SET payment_status = 'paid', paid_at = now(), paid_amount = 0 WHERE id = p_po_id;
    PERFORM set_config('app.bayar_po', 'off', true);
    INSERT INTO approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, pelaku, waktu, waktu_urut)
    VALUES ('bayar_vendor', 'setuju', p_po_id, v_po.supplier_nama, v_po.nomor_po || ' (kredit retur)', v_kredit, auth.uid(), now(), now())
    ON CONFLICT (jenis, keputusan, sumber_id) DO UPDATE SET nominal = EXCLUDED.nominal, pelaku = EXCLUDED.pelaku,
      waktu = EXCLUDED.waktu, waktu_urut = EXCLUDED.waktu_urut, dari_data_lama = false;
    RETURN NULL;
  END IF;

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

  UPDATE vendor_kredit SET status = 'aktif' WHERE purchase_order_id = p_po_id AND status = 'dicadangkan';

  PERFORM set_config('app.bayar_po', 'on', true);
  UPDATE cash_transaction
     SET status = 'paid', proof_url = p_proof_url, occurred_at = now(),
         cash_location_id = v_lok.id,
         approved_by = auth.uid(), approved_at = now(),
         note = concat_ws(' · ', nullif(btrim(v_tx.note), ''), nullif(btrim(p_catatan), ''))
   WHERE id = v_tx.id;
  UPDATE purchase_order SET paid_amount = v_tx.amount, cash_location_id = v_lok.id WHERE id = p_po_id;
  PERFORM set_config('app.bayar_po', 'off', true);
  RETURN v_tx.id;
END $function$;

CREATE OR REPLACE FUNCTION public.tolak_bayar_po(p_po_id uuid, p_alasan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_po record; v_tx record; v_kredit numeric;
BEGIN
  IF NOT (kas_pencatat_ok()
          OR EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh menolak pembayaran vendor' USING ERRCODE = '42501';
  END IF;
  IF btrim(coalesce(p_alasan, '')) = '' THEN RAISE EXCEPTION 'Alasan penolakan wajib diisi'; END IF;

  SELECT id, nomor_po, supplier_nama, payment_status, cash_transaction_id INTO v_po
    FROM purchase_order WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  SELECT -COALESCE(SUM(jumlah), 0) INTO v_kredit FROM vendor_kredit WHERE purchase_order_id = p_po_id AND status = 'dicadangkan';

  -- Kredit penuh: tidak ada transaksi kas.
  IF v_po.payment_status = 'pending' AND v_po.cash_transaction_id IS NULL AND v_kredit > 0 THEN
    DELETE FROM vendor_kredit WHERE purchase_order_id = p_po_id AND status = 'dicadangkan';
    PERFORM set_config('app.bayar_po', 'on', true);
    UPDATE purchase_order SET payment_status = 'unpaid', paid_at = NULL WHERE id = p_po_id;
    PERFORM set_config('app.bayar_po', 'off', true);
    INSERT INTO approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu, waktu_urut)
    VALUES ('bayar_vendor', 'tolak', p_po_id, v_po.supplier_nama, v_po.nomor_po || ' (kredit retur)', v_kredit, btrim(p_alasan), auth.uid(), now(), now())
    ON CONFLICT (jenis, keputusan, sumber_id) DO UPDATE SET nominal = EXCLUDED.nominal, alasan = EXCLUDED.alasan,
      pelaku = EXCLUDED.pelaku, waktu = EXCLUDED.waktu, waktu_urut = EXCLUDED.waktu_urut, dari_data_lama = false;
    RETURN;
  END IF;

  IF v_po.payment_status <> 'pending' OR v_po.cash_transaction_id IS NULL THEN
    RAISE EXCEPTION 'PO % tidak sedang menunggu approval pembayaran', v_po.nomor_po;
  END IF;

  SELECT id, status, note INTO v_tx FROM cash_transaction WHERE id = v_po.cash_transaction_id FOR UPDATE;
  IF NOT FOUND OR v_tx.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Transaksi pembayaran PO % tidak dalam status menunggu approval', v_po.nomor_po;
  END IF;

  DELETE FROM vendor_kredit WHERE purchase_order_id = p_po_id AND status = 'dicadangkan';

  PERFORM set_config('app.bayar_po', 'on', true);
  UPDATE cash_transaction
     SET status = 'rejected',
         note = concat_ws(' · ', nullif(btrim(v_tx.note), ''), '[Ditolak: ' || btrim(p_alasan) || ']')
   WHERE id = v_tx.id;
  PERFORM set_config('app.bayar_po', 'off', true);
END $function$;

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
    po.lunas_tanpa_kas_alasan,
    COALESCE((SELECT -sum(k.jumlah) FROM vendor_kredit k WHERE k.purchase_order_id = po.id), 0) AS dibayar_kredit
   FROM (purchase_order po
     LEFT JOIN purchase_order_item poi ON ((poi.purchase_order_id = po.id)))
  WHERE ((po.status = ANY (ARRAY['sebagian_diterima'::text, 'diterima_lengkap'::text])) AND is_finance())
  GROUP BY po.id;
