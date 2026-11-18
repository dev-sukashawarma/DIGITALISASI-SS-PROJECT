-- Retur vendor — penyelesaian (2026-11-18), Plan Task 3.
-- potong_tagihan → kredit vendor (+) langsung selesai.
-- uang_kembali   → finance konfirmasi uang masuk (cash_transaction in, source_type retur_vendor).
-- ganti_barang   → terima pengganti bertahap; ledger pembelian_supplier TANPA ref_po_id.
-- Sisa yang tidak diselesaikan vendor ditutup "tidak dikompensasi" (tidak jadi kredit/biaya).

CREATE OR REPLACE FUNCTION public.catat_penyelesaian_retur_vendor(
  p_id uuid, p_cara text, p_catatan text, p_bukti_vendor_url text, p_uang_dijanjikan numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r retur_vendor%ROWTYPE; v_total numeric;
BEGIN
  IF NOT retur_vendor_peran_ok('selesaikan') THEN
    RAISE EXCEPTION 'Hanya purchasing atau finance yang boleh mencatat penyelesaian retur' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_r FROM retur_vendor WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retur tidak ditemukan'; END IF;
  IF v_r.status <> 'diserahkan' OR v_r.cara_penyelesaian IS NOT NULL THEN
    RAISE EXCEPTION 'Penyelesaian retur % sudah dicatat atau barang belum diserahkan', v_r.nomor USING ERRCODE = 'check_violation';
  END IF;
  IF p_cara NOT IN ('ganti_barang','potong_tagihan','uang_kembali') THEN
    RAISE EXCEPTION 'Cara penyelesaian tidak dikenal' USING ERRCODE = 'check_violation';
  END IF;
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total FROM retur_vendor_item WHERE retur_vendor_id = p_id;

  IF p_cara = 'uang_kembali' AND (p_uang_dijanjikan IS NULL OR p_uang_dijanjikan <= 0) THEN
    RAISE EXCEPTION 'Isi jumlah uang yang akan dikembalikan vendor' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE retur_vendor SET cara_penyelesaian = p_cara, catatan_penyelesaian = NULLIF(btrim(p_catatan), ''),
    bukti_vendor_url = NULLIF(btrim(p_bukti_vendor_url), ''),
    uang_dijanjikan = CASE WHEN p_cara = 'uang_kembali' THEN p_uang_dijanjikan END, updated_at = now()
  WHERE id = p_id;

  IF p_cara = 'potong_tagihan' THEN
    IF v_total <= 0 THEN RAISE EXCEPTION 'Nilai retur 0, tidak ada kredit' USING ERRCODE = 'check_violation'; END IF;
    INSERT INTO vendor_kredit (vendor_induk, supplier_id, jumlah, status, retur_vendor_id, catatan, dibuat_oleh)
    VALUES (v_r.vendor_induk, v_r.supplier_id, v_total, 'aktif', p_id, 'Kredit retur ' || v_r.nomor, auth.uid());
    UPDATE retur_vendor SET status = 'selesai', selesai_oleh = auth.uid(), selesai_at = now() WHERE id = p_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.konfirmasi_uang_retur_vendor(
  p_id uuid, p_cash_location_id uuid, p_jumlah numeric, p_bukti_url text, p_catatan text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r retur_vendor%ROWTYPE; v_lok cash_location%ROWTYPE; v_total numeric; v_tx uuid; v_sup text;
BEGIN
  IF NOT retur_vendor_peran_ok('uang') THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh mencatat uang masuk' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_r FROM retur_vendor WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retur tidak ditemukan'; END IF;
  IF v_r.status <> 'diserahkan' OR v_r.cara_penyelesaian IS DISTINCT FROM 'uang_kembali' THEN
    RAISE EXCEPTION 'Retur % tidak sedang menunggu uang kembali', v_r.nomor USING ERRCODE = 'check_violation';
  END IF;
  IF p_jumlah IS NULL OR p_jumlah <= 0 THEN RAISE EXCEPTION 'Jumlah uang masuk harus lebih dari 0' USING ERRCODE = 'check_violation'; END IF;
  IF length(btrim(COALESCE(p_bukti_url, ''))) = 0 THEN RAISE EXCEPTION 'Bukti transfer wajib dilampirkan' USING ERRCODE = 'check_violation'; END IF;
  SELECT * INTO v_lok FROM cash_location WHERE id = p_cash_location_id;
  IF v_lok.id IS NULL OR v_lok.grup IS NULL OR NOT v_lok.is_active THEN
    RAISE EXCEPTION 'Uang kembali hanya ke rekening pusat yang aktif' USING ERRCODE = 'check_violation';
  END IF;
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total FROM retur_vendor_item WHERE retur_vendor_id = p_id;
  SELECT nama INTO v_sup FROM supplier WHERE id = v_r.supplier_id;
  INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, source_id, status,
    occurred_at, note, proof_url, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_cash_location_id, 'in', p_jumlah, 'Uang kembali retur ' || v_r.nomor || COALESCE(' · ' || v_sup, ''),
    'retur_vendor', p_id, 'reconciled', now(), NULLIF(btrim(p_catatan), ''), btrim(p_bukti_url),
    auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO v_tx;
  UPDATE retur_vendor SET uang_diterima = p_jumlah, cash_transaction_id = v_tx,
    nilai_tidak_dikompensasi = GREATEST(0, v_total - p_jumlah),
    status = 'selesai', selesai_oleh = auth.uid(), selesai_at = now(), updated_at = now()
  WHERE id = p_id;
  RETURN v_tx;
END $$;

CREATE OR REPLACE FUNCTION public.terima_pengganti_retur_vendor(p_id uuid, p_items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_g uuid := gudang_pusat_id();
  v_r retur_vendor%ROWTYPE; it jsonb; v_it record; v_qty numeric; v_skala numeric; v_ledger uuid; v_pasangan record;
BEGIN
  IF NOT retur_vendor_peran_ok('serah') THEN
    RAISE EXCEPTION 'Hanya kitchen atau purchasing yang boleh menerima barang pengganti' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_r FROM retur_vendor WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retur tidak ditemukan'; END IF;
  IF v_r.status <> 'diserahkan' OR v_r.cara_penyelesaian IS DISTINCT FROM 'ganti_barang' THEN
    RAISE EXCEPTION 'Retur % tidak sedang menunggu barang pengganti', v_r.nomor USING ERRCODE = 'check_violation';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Tidak ada barang pengganti' USING ERRCODE = 'check_violation';
  END IF;
  FOR v_pasangan IN
    SELECT DISTINCT lower(i.bahan_baku_id::text) AS b FROM retur_vendor_item i WHERE i.retur_vendor_id = p_id ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('svgm:' || v_pasangan.b || ':' || lower(v_r.vendor_induk::text)));
  END LOOP;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := NULLIF(it->>'qty', '')::numeric;
    SELECT i.*, b.nama INTO v_it FROM retur_vendor_item i JOIN bahan_baku b ON b.id = i.bahan_baku_id
    WHERE i.id = NULLIF(it->>'retur_vendor_item_id', '')::uuid AND i.retur_vendor_id = p_id FOR UPDATE OF i;
    IF v_it.id IS NULL THEN RAISE EXCEPTION 'Barang retur tidak ditemukan' USING ERRCODE = 'check_violation'; END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
    IF v_it.qty_pengganti_diterima + v_qty > v_it.qty + 0.000001 THEN
      RAISE EXCEPTION 'Pengganti % melebihi jumlah yang diretur', v_it.nama USING ERRCODE = 'check_violation';
    END IF;
    v_skala := to_ledger_scale(v_g, v_it.bahan_baku_id, v_qty);
    v_ledger := gen_random_uuid();
    IF bahan_multi_vendor(v_it.bahan_baku_id) AND bahan_vendor_aktif(v_it.bahan_baku_id) THEN
      INSERT INTO stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, ref_ledger_id, catatan, dibuat_oleh)
      VALUES (v_it.bahan_baku_id, v_r.vendor_induk, v_skala, 'retur_vendor', v_ledger, 'Pengganti retur ' || v_r.nomor, auth.uid());
    END IF;
    INSERT INTO ledger_stok (id, outlet_id, bahan_baku_id, tipe, qty, catatan, ref_retur_vendor_id, created_by)
    VALUES (v_ledger, v_g, v_it.bahan_baku_id, 'pembelian_supplier', v_skala,
            'Pengganti retur ' || v_r.nomor || ' — ' || v_it.nama, p_id, auth.uid());
    UPDATE retur_vendor_item SET qty_pengganti_diterima = qty_pengganti_diterima + v_qty WHERE id = v_it.id;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM retur_vendor_item WHERE retur_vendor_id = p_id AND qty_pengganti_diterima + 0.000001 < qty) THEN
    UPDATE retur_vendor SET status = 'selesai', selesai_oleh = auth.uid(), selesai_at = now(), updated_at = now() WHERE id = p_id;
  ELSE
    UPDATE retur_vendor SET updated_at = now() WHERE id = p_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tutup_sisa_retur_vendor(p_id uuid, p_alasan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r retur_vendor%ROWTYPE; v_sisa numeric;
BEGIN
  IF NOT retur_vendor_peran_ok('selesaikan') THEN
    RAISE EXCEPTION 'Hanya purchasing atau finance yang boleh menutup retur' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(COALESCE(p_alasan, ''))) = 0 THEN RAISE EXCEPTION 'Alasan penutupan wajib diisi' USING ERRCODE = 'check_violation'; END IF;
  SELECT * INTO v_r FROM retur_vendor WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retur tidak ditemukan'; END IF;
  IF v_r.status <> 'diserahkan' THEN RAISE EXCEPTION 'Retur % tidak sedang menunggu penyelesaian', v_r.nomor USING ERRCODE = 'check_violation'; END IF;
  IF v_r.cara_penyelesaian = 'ganti_barang' THEN
    SELECT COALESCE(SUM(GREATEST(0, qty - qty_pengganti_diterima) * harga), 0) INTO v_sisa FROM retur_vendor_item WHERE retur_vendor_id = p_id;
  ELSIF v_r.cara_penyelesaian = 'uang_kembali' THEN
    SELECT GREATEST(0, COALESCE(SUM(subtotal), 0) - COALESCE(v_r.uang_diterima, 0)) INTO v_sisa FROM retur_vendor_item WHERE retur_vendor_id = p_id;
  ELSE
    SELECT COALESCE(SUM(subtotal), 0) INTO v_sisa FROM retur_vendor_item WHERE retur_vendor_id = p_id;
  END IF;
  UPDATE retur_vendor SET nilai_tidak_dikompensasi = v_sisa, alasan_tutup_sisa = btrim(p_alasan),
    status = 'selesai', selesai_oleh = auth.uid(), selesai_at = now(), updated_at = now()
  WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.catat_penyelesaian_retur_vendor(uuid, text, text, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.konfirmasi_uang_retur_vendor(uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.terima_pengganti_retur_vendor(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutup_sisa_retur_vendor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catat_penyelesaian_retur_vendor(uuid, text, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.konfirmasi_uang_retur_vendor(uuid, uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.terima_pengganti_retur_vendor(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutup_sisa_retur_vendor(uuid, text) TO authenticated;
