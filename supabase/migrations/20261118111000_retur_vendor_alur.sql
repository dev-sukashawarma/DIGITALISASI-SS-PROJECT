-- Retur vendor — alur ajukan → setujui/tolak → batal → serahkan (2026-11-18)
-- Plan Task 2. Stok Gudang Pusat hanya berubah saat diserahkan.
-- ledger_stamp_saldo MENGECUALIKAN retur_ke_vendor dari larangan saldo minus,
-- jadi cek saldo di serahkan_retur_vendor adalah satu-satunya penjaga.

-- Sisa qty item PO yang masih bisa diretur (dokumen lain selain ditolak/dibatalkan).
CREATE OR REPLACE FUNCTION public._retur_vendor_sisa_poi(p_poi uuid, p_kecuali uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(poi.qty_terima, 0) - COALESCE((
    SELECT SUM(i.qty) FROM retur_vendor_item i JOIN retur_vendor r ON r.id = i.retur_vendor_id
    WHERE i.purchase_order_item_id = p_poi AND r.status NOT IN ('ditolak','dibatalkan')
      AND r.id IS DISTINCT FROM p_kecuali), 0)
  FROM purchase_order_item poi WHERE poi.id = p_poi;
$$;
REVOKE ALL ON FUNCTION public._retur_vendor_sisa_poi(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ajukan_retur_vendor(
  p_supplier_id uuid, p_alasan text, p_catatan text, p_bukti_urls text[], p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_induk uuid; v_id uuid; v_nomor text; v_tgl date; v_seq int;
  it jsonb; v_poi record; v_qty numeric; v_alasan text; v_sisa numeric;
BEGIN
  IF NOT retur_vendor_peran_ok('ajukan') THEN
    RAISE EXCEPTION 'Hanya purchasing, kitchen, atau finance yang boleh mengajukan retur vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_induk := vendor_induk(p_supplier_id);
  IF v_induk IS NULL THEN RAISE EXCEPTION 'Vendor tidak ditemukan' USING ERRCODE = 'check_violation'; END IF;
  IF p_alasan IS NULL OR p_alasan NOT IN ('rusak','kualitas_tidak_sesuai','salah_kirim','kadaluarsa','lainnya') THEN
    RAISE EXCEPTION 'Pilih alasan retur' USING ERRCODE = 'check_violation';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Tidak ada barang yang diretur' USING ERRCODE = 'check_violation';
  END IF;

  v_tgl := date_trunc('month', (now() AT TIME ZONE 'Asia/Jakarta'))::date;
  v_seq := nomor_urut_berikut('RV', v_tgl);
  v_nomor := 'RV/' || to_char(v_tgl, 'YYYY/MM') || '/' || lpad(v_seq::text, GREATEST(3, length(v_seq::text)), '0');

  INSERT INTO retur_vendor (nomor, supplier_id, vendor_induk, alasan, catatan, bukti_urls, diajukan_oleh)
  VALUES (v_nomor, p_supplier_id, v_induk, p_alasan, NULLIF(btrim(p_catatan), ''), COALESCE(p_bukti_urls, '{}'), auth.uid())
  RETURNING id INTO v_id;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := NULLIF(it->>'qty', '')::numeric;
    v_alasan := COALESCE(NULLIF(it->>'alasan', ''), p_alasan);
    SELECT poi.id, poi.bahan_baku_id, COALESCE(poi.harga_terima, poi.harga_pesan, 0) AS harga,
           po.status, po.nomor_po, vendor_induk(po.supplier_id) AS induk, b.nama
      INTO v_poi
      FROM purchase_order_item poi
      JOIN purchase_order po ON po.id = poi.purchase_order_id
      LEFT JOIN bahan_baku b ON b.id = poi.bahan_baku_id
     WHERE poi.id = NULLIF(it->>'purchase_order_item_id', '')::uuid
     FOR UPDATE OF poi;
    IF v_poi.id IS NULL THEN RAISE EXCEPTION 'Barang PO tidak ditemukan' USING ERRCODE = 'check_violation'; END IF;
    IF v_poi.bahan_baku_id IS NULL THEN RAISE EXCEPTION 'Barang PO % bukan bahan baku', v_poi.nomor_po USING ERRCODE = 'check_violation'; END IF;
    IF v_poi.induk IS DISTINCT FROM v_induk THEN
      RAISE EXCEPTION 'PO % bukan milik vendor ini', v_poi.nomor_po USING ERRCODE = 'check_violation';
    END IF;
    IF v_poi.status NOT IN ('sebagian_diterima','diterima_lengkap') THEN
      RAISE EXCEPTION 'PO % belum diterima', v_poi.nomor_po USING ERRCODE = 'check_violation';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Jumlah % harus lebih dari 0', v_poi.nama USING ERRCODE = 'check_violation'; END IF;
    IF v_alasan NOT IN ('rusak','kualitas_tidak_sesuai','salah_kirim','kadaluarsa','lainnya') THEN
      RAISE EXCEPTION 'Alasan % tidak dikenal', v_alasan USING ERRCODE = 'check_violation';
    END IF;
    v_sisa := _retur_vendor_sisa_poi(v_poi.id, v_id);
    IF v_qty > v_sisa + 0.000001 THEN
      RAISE EXCEPTION 'Retur % melebihi yang diterima di PO % (sisa %)', v_poi.nama, v_poi.nomor_po, round(v_sisa, 3)
        USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO retur_vendor_item (retur_vendor_id, bahan_baku_id, purchase_order_item_id, qty, harga, alasan, catatan)
    VALUES (v_id, v_poi.bahan_baku_id, v_poi.id, v_qty, v_poi.harga, v_alasan, NULLIF(btrim(it->>'catatan'), ''));
  END LOOP;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.putuskan_retur_vendor(p_id uuid, p_setuju boolean, p_alasan text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r retur_vendor%ROWTYPE; v_total numeric; v_sup text;
BEGIN
  IF NOT retur_vendor_peran_ok('putus') THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh memutuskan retur vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_r FROM retur_vendor WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retur tidak ditemukan'; END IF;
  IF v_r.status <> 'diajukan' THEN RAISE EXCEPTION 'Retur % tidak sedang menunggu persetujuan', v_r.nomor USING ERRCODE = 'check_violation'; END IF;
  IF v_r.diajukan_oleh = auth.uid() THEN
    RAISE EXCEPTION 'Retur yang Anda ajukan sendiri harus diputuskan orang lain' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT p_setuju AND length(btrim(COALESCE(p_alasan, ''))) = 0 THEN
    RAISE EXCEPTION 'Alasan penolakan wajib diisi' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE retur_vendor SET status = CASE WHEN p_setuju THEN 'disetujui' ELSE 'ditolak' END,
    diputuskan_oleh = auth.uid(), diputuskan_at = now(),
    alasan_tolak = CASE WHEN p_setuju THEN NULL ELSE btrim(p_alasan) END, updated_at = now()
  WHERE id = p_id;
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total FROM retur_vendor_item WHERE retur_vendor_id = p_id;
  SELECT nama INTO v_sup FROM supplier WHERE id = v_r.supplier_id;
  INSERT INTO approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu)
  VALUES ('retur_vendor', CASE WHEN p_setuju THEN 'setuju' ELSE 'tolak' END, p_id,
          'Retur ' || v_r.nomor, v_sup, v_total, CASE WHEN p_setuju THEN NULL ELSE btrim(p_alasan) END, auth.uid(), now());
END $$;

CREATE OR REPLACE FUNCTION public.batalkan_retur_vendor(p_id uuid, p_alasan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r retur_vendor%ROWTYPE;
BEGIN
  SELECT * INTO v_r FROM retur_vendor WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retur tidak ditemukan'; END IF;
  IF NOT (retur_vendor_peran_ok('putus') OR (v_r.diajukan_oleh = auth.uid() AND retur_vendor_peran_ok('ajukan'))) THEN
    RAISE EXCEPTION 'Hanya pengaju atau finance yang boleh membatalkan retur' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_r.status NOT IN ('diajukan','disetujui') THEN
    RAISE EXCEPTION 'Retur % sudah tidak bisa dibatalkan', v_r.nomor USING ERRCODE = 'check_violation';
  END IF;
  IF length(btrim(COALESCE(p_alasan, ''))) = 0 THEN RAISE EXCEPTION 'Alasan pembatalan wajib diisi' USING ERRCODE = 'check_violation'; END IF;
  UPDATE retur_vendor SET status = 'dibatalkan', dibatalkan_oleh = auth.uid(), dibatalkan_at = now(),
    alasan_batal = btrim(p_alasan), updated_at = now() WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.serahkan_retur_vendor(p_id uuid, p_penerima_vendor text, p_bukti_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_g uuid := gudang_pusat_id();
  v_r retur_vendor%ROWTYPE; v_it record; v_pasangan record;
  v_qty numeric; v_saldo numeric; v_sisa numeric; v_sisa_poi numeric; v_ledger uuid;
BEGIN
  IF NOT retur_vendor_peran_ok('serah') THEN
    RAISE EXCEPTION 'Hanya purchasing atau kitchen yang boleh mencatat serah barang ke vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(COALESCE(p_bukti_url, ''))) = 0 THEN RAISE EXCEPTION 'Bukti serah terima wajib dilampirkan' USING ERRCODE = 'check_violation'; END IF;
  SELECT * INTO v_r FROM retur_vendor WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retur tidak ditemukan'; END IF;
  IF v_r.status <> 'disetujui' THEN RAISE EXCEPTION 'Retur % belum disetujui', v_r.nomor USING ERRCODE = 'check_violation'; END IF;

  -- Kunci semua pasangan (bahan, vendor) di muka, urutan sama dengan sj_vendor_on_dikirim.
  FOR v_pasangan IN
    SELECT DISTINCT lower(i.bahan_baku_id::text) AS b FROM retur_vendor_item i WHERE i.retur_vendor_id = p_id ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('svgm:' || v_pasangan.b || ':' || lower(v_r.vendor_induk::text)));
  END LOOP;

  FOR v_it IN
    SELECT i.*, b.nama FROM retur_vendor_item i JOIN bahan_baku b ON b.id = i.bahan_baku_id
    WHERE i.retur_vendor_id = p_id ORDER BY i.bahan_baku_id
  LOOP
    v_sisa_poi := _retur_vendor_sisa_poi(v_it.purchase_order_item_id, p_id);
    IF v_it.qty > v_sisa_poi + 0.000001 THEN
      RAISE EXCEPTION 'Retur % melebihi yang diterima di PO (sisa %)', v_it.nama, round(v_sisa_poi, 3) USING ERRCODE = 'check_violation';
    END IF;
    v_qty := to_ledger_scale(v_g, v_it.bahan_baku_id, v_it.qty);
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Skala satuan % tidak bisa dihitung', v_it.nama USING ERRCODE = 'check_violation'; END IF;
    SELECT saldo INTO v_saldo FROM stok_balance WHERE outlet_id = v_g AND bahan_baku_id = v_it.bahan_baku_id FOR UPDATE;
    IF COALESCE(v_saldo, 0) + 0.000001 < v_qty THEN
      RAISE EXCEPTION 'Stok % di Gudang Pusat tidak cukup untuk diretur', v_it.nama USING ERRCODE = 'check_violation';
    END IF;
    v_ledger := gen_random_uuid();
    IF bahan_multi_vendor(v_it.bahan_baku_id) AND bahan_vendor_aktif(v_it.bahan_baku_id) THEN
      v_sisa := sisa_vendor_gudang(v_it.bahan_baku_id, v_r.vendor_induk);
      IF v_qty > COALESCE(v_sisa, 0) + 0.000001 THEN
        RAISE EXCEPTION 'Sisa % dari vendor ini di Gudang Pusat tidak cukup untuk diretur', v_it.nama USING ERRCODE = 'check_violation';
      END IF;
      INSERT INTO stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, ref_ledger_id, catatan, dibuat_oleh)
      VALUES (v_it.bahan_baku_id, v_r.vendor_induk, -v_qty, 'retur_vendor', v_ledger, 'Retur ' || v_r.nomor, auth.uid());
    END IF;
    INSERT INTO ledger_stok (id, outlet_id, bahan_baku_id, tipe, qty, catatan, ref_retur_vendor_id, created_by)
    VALUES (v_ledger, v_g, v_it.bahan_baku_id, 'retur_ke_vendor', -v_qty,
            'Retur ' || v_r.nomor || ' — ' || v_it.nama, p_id, auth.uid());
    UPDATE retur_vendor_item SET ledger_serah_id = v_ledger WHERE id = v_it.id;
  END LOOP;

  UPDATE retur_vendor SET status = 'diserahkan', diserahkan_oleh = auth.uid(), diserahkan_at = now(),
    penerima_vendor = NULLIF(btrim(p_penerima_vendor), ''), bukti_serah_url = btrim(p_bukti_url), updated_at = now()
  WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.ajukan_retur_vendor(uuid, text, text, text[], jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.putuskan_retur_vendor(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.batalkan_retur_vendor(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.serahkan_retur_vendor(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajukan_retur_vendor(uuid, text, text, text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.putuskan_retur_vendor(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batalkan_retur_vendor(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.serahkan_retur_vendor(uuid, text, text) TO authenticated;
