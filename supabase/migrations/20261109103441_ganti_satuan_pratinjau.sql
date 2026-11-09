-- Ganti Satuan bahan baku — Task 2: rencana (satu sumber rumus) & pratinjau read-only.
-- Spec: docs/superpowers/specs/2026-11-09-ganti-satuan-bahan-baku-design.md §4.1–4.2
--
-- _rencana_ganti_satuan(bahan, baru, jembatan) → faktor + satuan lama/baru + penghalang.
--   Jembatan = satuan kecil BARU per 1 satuan kecil LAMA.
--   k_kecil = jembatan; k_besar = faktor_tampilan_lama × jembatan ÷ faktor_tampilan_baru.
--   Hanya bahan yang lama DAN baru punya satuan kecil (spec §4.3b).
-- pratinjau_ganti_satuan(...) → rencana + saldo per lokasi + jumlah baris + harga master.

CREATE OR REPLACE FUNCTION public._rencana_ganti_satuan(p_bahan uuid, p_baru jsonb, p_jembatan numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_boleh constant text[] := ARRAY['satuan','satuan_tengah','faktor_tengah','satuan_kecil',
    'isi_kecil_per_tengah','satuan_po','satuan_distribusi'];
  v_kunci text;
  v_lama  public.bahan_baku%ROWTYPE;
  v_satuan text; v_tengah text; v_ft numeric; v_kecil text; v_isi numeric; v_tampilan numeric;
  v_po text; v_dist text; v_tingkat text[]; v_peringatan text[] := '{}';
  v_k_kecil numeric; v_k_besar numeric;
  v_penghalang jsonb;
BEGIN
  IF p_baru IS NULL OR jsonb_typeof(p_baru) <> 'object' THEN
    RAISE EXCEPTION 'Satuan baru harus objek JSON' USING ERRCODE = '22023';
  END IF;
  FOR v_kunci IN SELECT jsonb_object_keys(p_baru) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak dikenal untuk ganti satuan', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF p_jembatan IS NULL OR p_jembatan = 'NaN'::numeric OR p_jembatan <= 0 THEN
    RAISE EXCEPTION 'Jembatan konversi wajib angka lebih dari 0' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_lama FROM public.bahan_baku WHERE id = p_bahan;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_bahan USING ERRCODE = 'P0002'; END IF;
  IF v_lama.satuan_kecil IS NULL OR COALESCE(v_lama.faktor_tampilan, 0) <= 0 THEN
    RAISE EXCEPTION 'Bahan "%" belum punya satuan kecil; ganti satuan belum mendukung bahan seperti ini', v_lama.nama
      USING ERRCODE = '22023';
  END IF;

  v_satuan := NULLIF(btrim(p_baru ->> 'satuan'), '');
  v_tengah := NULLIF(btrim(p_baru ->> 'satuan_tengah'), '');
  v_ft     := NULLIF(p_baru ->> 'faktor_tengah', '')::numeric;
  v_kecil  := NULLIF(btrim(p_baru ->> 'satuan_kecil'), '');
  v_isi    := NULLIF(p_baru ->> 'isi_kecil_per_tengah', '')::numeric;
  IF v_satuan IS NULL THEN RAISE EXCEPTION 'Satuan besar baru wajib diisi' USING ERRCODE = '22023'; END IF;
  IF v_kecil IS NULL THEN
    RAISE EXCEPTION 'Satuan kecil baru wajib diisi (ganti satuan belum mendukung bahan tanpa satuan kecil)'
      USING ERRCODE = '22023';
  END IF;
  IF v_isi IS NULL OR v_isi = 'NaN'::numeric OR v_isi <= 0 THEN
    RAISE EXCEPTION 'Isi satuan kecil wajib lebih dari 0' USING ERRCODE = '22023';
  END IF;
  -- Semantik sama dengan simpan_bahan_baku.
  IF v_tengah IS NULL OR (lower(v_tengah) = lower(v_satuan) AND COALESCE(v_ft, 1) = 1) THEN
    v_tengah := NULL; v_ft := NULL; v_tampilan := v_isi;
  ELSE
    IF v_ft IS NULL OR v_ft = 'NaN'::numeric OR v_ft <= 0 THEN
      RAISE EXCEPTION 'Isi satuan tengah per satuan besar wajib lebih dari 0' USING ERRCODE = '22023';
    END IF;
    v_tampilan := v_ft * v_isi;
  END IF;

  v_po   := CASE WHEN p_baru ? 'satuan_po' THEN NULLIF(btrim(p_baru ->> 'satuan_po'), '') ELSE v_lama.satuan_po END;
  v_dist := CASE WHEN p_baru ? 'satuan_distribusi' THEN NULLIF(btrim(p_baru ->> 'satuan_distribusi'), '')
                 ELSE v_lama.satuan_distribusi END;
  v_tingkat := array_remove(ARRAY[public._kanon_satuan(v_satuan), public._kanon_satuan(v_tengah),
                                  public._kanon_satuan(v_kecil)], NULL);
  IF v_po IS NOT NULL AND NOT (public._kanon_satuan(v_po) = ANY (v_tingkat)) THEN
    v_peringatan := v_peringatan || format('Satuan PO "%s" bukan salah satu tingkat satuan baru', v_po);
  END IF;
  IF v_dist IS NOT NULL AND NOT (public._kanon_satuan(v_dist) = ANY (v_tingkat)
       OR (public._kanon_satuan(v_dist) = 'kg' AND public._kanon_satuan(v_kecil) = 'gram')) THEN
    v_peringatan := v_peringatan || format('Satuan distribusi "%s" bukan salah satu tingkat satuan baru', v_dist);
  END IF;

  v_k_kecil := p_jembatan;
  v_k_besar := v_lama.faktor_tampilan * p_jembatan / v_tampilan;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'jenis', x->>'nomor'), '[]'::jsonb) INTO v_penghalang FROM (
    SELECT jsonb_build_object('jenis','opname_draft','id',o.id,'nomor','Opname ' || o.tanggal,'outlet',ot.name) x
      FROM public.opname o JOIN public.outlets ot ON ot.id = o.outlet_id
     WHERE o.status IN ('draft','pending_approval')
       AND EXISTS (SELECT 1 FROM public.opname_item i WHERE i.opname_id = o.id AND i.bahan_baku_id = p_bahan)
    UNION ALL
    SELECT jsonb_build_object('jenis','surat_jalan','id',s.id,'nomor',COALESCE(s.document_number, left(s.id::text, 8)),'outlet',ot.name)
      FROM public.surat_jalan s JOIN public.outlets ot ON ot.id = s.outlet_id
     WHERE s.status IN ('draft','dikirim')
       AND EXISTS (SELECT 1 FROM public.surat_jalan_item i WHERE i.surat_jalan_id = s.id AND i.bahan_baku_id = p_bahan)
    UNION ALL
    SELECT jsonb_build_object('jenis','purchase_order','id',po.id,'nomor',COALESCE(po.nomor_po, left(po.id::text, 8)),'outlet',NULL)
      FROM public.purchase_order po
     WHERE po.status NOT IN ('diterima_lengkap','dibatalkan','ditolak')
       AND EXISTS (SELECT 1 FROM public.purchase_order_item i WHERE i.purchase_order_id = po.id AND i.bahan_baku_id = p_bahan)
    UNION ALL
    SELECT jsonb_build_object('jenis','permintaan','id',pb.id,'nomor','Permintaan ' || to_char(pb.created_at AT TIME ZONE 'Asia/Jakarta','DD/MM/YYYY'),'outlet',ot.name)
      FROM public.permintaan_bahan pb JOIN public.outlets ot ON ot.id = pb.outlet_id
     WHERE pb.status NOT IN ('disetujui','ditolak','dibatalkan')
       AND EXISTS (SELECT 1 FROM public.permintaan_bahan_item i WHERE i.permintaan_id = pb.id AND i.bahan_baku_id = p_bahan)
    UNION ALL
    SELECT jsonb_build_object('jenis','terima_vendor','id',t.id,'nomor','Terima vendor ' || to_char(t.tanggal_terima,'DD/MM/YYYY'),'outlet',ot.name)
      FROM public.terima_vendor_outlet t JOIN public.outlets ot ON ot.id = t.outlet_id
     WHERE t.status = 'dicatat' AND t.bahan_baku_id = p_bahan
    UNION ALL
    SELECT jsonb_build_object('jenis','waste','id',w.id,'nomor','Laporan waste ' || to_char(w.created_at AT TIME ZONE 'Asia/Jakarta','DD/MM/YYYY'),'outlet',ot.name)
      FROM public.stok_waste_reports w JOIN public.outlets ot ON ot.id = w.outlet_id
     WHERE w.status = 'PENDING' AND w.bahan_baku_id = p_bahan
    UNION ALL
    SELECT jsonb_build_object('jenis','mutasi','id',m.id,'nomor','Mutasi ' || left(m.id::text, 8),'outlet',ot.name)
      FROM public.mutasi_antar_outlet m JOIN public.outlets ot ON ot.id = m.outlet_asal_id
     WHERE m.status NOT IN ('selesai','ditolak')
       AND EXISTS (SELECT 1 FROM public.mutasi_antar_outlet_item i WHERE i.mutasi_id = m.id AND i.bahan_baku_id = p_bahan)
    UNION ALL
    SELECT jsonb_build_object('jenis','retur','id',r.id,'nomor',COALESCE(r.nomor_retur, left(r.id::text, 8)),'outlet',ot.name)
      FROM public.retur_stok r JOIN public.outlets ot ON ot.id = r.outlet_id
     WHERE r.status NOT IN ('selesai','ditolak','dibatalkan')
       AND EXISTS (SELECT 1 FROM public.retur_stok_item i WHERE i.retur_stok_id = r.id AND i.bahan_baku_id = p_bahan)
    UNION ALL
    SELECT jsonb_build_object('jenis','substitusi','id',sb.id,'nomor','Pasangan substitusi waterfall','outlet',NULL)
      FROM public.bahan_baku_substitusi sb
     WHERE v_k_kecil <> 1 AND (sb.bahan_baku_utama_id = p_bahan OR sb.bahan_baku_pengganti_id = p_bahan)
  ) q;

  RETURN jsonb_build_object(
    'faktor_tampilan_lama', v_lama.faktor_tampilan,
    'faktor_tampilan_baru', v_tampilan,
    'jembatan', p_jembatan,
    'k_kecil', v_k_kecil,
    'k_besar', v_k_besar,
    'satuan_lama', jsonb_build_object('satuan', v_lama.satuan, 'satuan_tengah', v_lama.satuan_tengah,
       'faktor_tengah', v_lama.faktor_tengah, 'satuan_kecil', v_lama.satuan_kecil,
       'faktor_tampilan', v_lama.faktor_tampilan, 'satuan_po', v_lama.satuan_po,
       'satuan_distribusi', v_lama.satuan_distribusi),
    'satuan_baru', jsonb_build_object('satuan', v_satuan, 'satuan_tengah', v_tengah, 'faktor_tengah', v_ft,
       'satuan_kecil', v_kecil, 'faktor_tampilan', v_tampilan, 'satuan_po', v_po, 'satuan_distribusi', v_dist),
    'peringatan_label', to_jsonb(v_peringatan),
    'penghalang', v_penghalang);
END;
$$;
REVOKE ALL ON FUNCTION public._rencana_ganti_satuan(uuid, jsonb, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pratinjau_ganti_satuan(p_bahan uuid, p_baru jsonb, p_jembatan numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r jsonb; v_kk numeric; v_kb numeric; v_saldo jsonb; v_jumlah jsonb; v_harga numeric;
BEGIN
  PERFORM public._peran_master('data');
  v_r := public._rencana_ganti_satuan(p_bahan, p_baru, p_jembatan);
  v_kk := (v_r ->> 'k_kecil')::numeric;
  v_kb := (v_r ->> 'k_besar')::numeric;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'outlet_id', s.outlet_id, 'outlet', s.outlet, 'skala', s.skala,
           'saldo_lama', s.saldo, 'saldo_baru', s.saldo * CASE WHEN s.skala = 'kecil' THEN v_kk ELSE v_kb END)
         ORDER BY s.saldo DESC, s.outlet), '[]'::jsonb)
    INTO v_saldo
    FROM (SELECT sb.outlet_id, o.name AS outlet, sb.saldo,
                 CASE WHEN public.saldo_is_gram(sb) THEN 'kecil' ELSE 'besar' END AS skala
            FROM public.stok_balance sb JOIN public.outlets o ON o.id = sb.outlet_id
           WHERE sb.bahan_baku_id = p_bahan) s;

  v_jumlah := jsonb_build_object(
    'ledger',            (SELECT count(*) FROM public.ledger_stok WHERE bahan_baku_id = p_bahan),
    'opname_item',       (SELECT count(*) FROM public.opname_item WHERE bahan_baku_id = p_bahan),
    'opname_item_vendor',(SELECT count(*) FROM public.opname_item_vendor WHERE bahan_baku_id = p_bahan),
    'svgm',              (SELECT count(*) FROM public.stok_vendor_gudang_mutasi WHERE bahan_baku_id = p_bahan),
    'resep_item',        (SELECT count(*) FROM public.resep_item WHERE bahan_baku_id = p_bahan),
    'katalog',           (SELECT count(*) FROM public.bahan_baku_supplier WHERE bahan_baku_id = p_bahan),
    'sku',               (SELECT count(*) FROM public.bahan_baku_sku WHERE bahan_baku_id = p_bahan),
    'reorder_point',     (SELECT count(*) FROM public.outlet_reorder_point WHERE bahan_baku_id = p_bahan),
    'sj_item',           (SELECT count(*) FROM public.surat_jalan_item WHERE bahan_baku_id = p_bahan),
    'po_item',           (SELECT count(*) FROM public.purchase_order_item WHERE bahan_baku_id = p_bahan),
    'permintaan_item',   (SELECT count(*) FROM public.permintaan_bahan_item WHERE bahan_baku_id = p_bahan),
    'waste',             (SELECT count(*) FROM public.stok_waste_reports WHERE bahan_baku_id = p_bahan),
    'terima_vendor',     (SELECT count(*) FROM public.terima_vendor_outlet WHERE bahan_baku_id = p_bahan),
    'retur_item',        (SELECT count(*) FROM public.retur_stok_item WHERE bahan_baku_id = p_bahan),
    'mutasi_item',       (SELECT count(*) FROM public.mutasi_antar_outlet_item WHERE bahan_baku_id = p_bahan),
    'inbound_outbound',  (SELECT count(*) FROM public.inbound_outbound WHERE bahan_baku_id = p_bahan),
    'purchase_request',  (SELECT count(*) FROM public.purchase_request WHERE bahan_baku_id = p_bahan));

  SELECT harga_beli INTO v_harga FROM public.bahan_baku_harga WHERE bahan_baku_id = p_bahan;

  RETURN v_r || jsonb_build_object(
    'saldo', v_saldo,
    'jumlah', v_jumlah,
    'harga_master_lama', v_harga,
    'harga_master_baru', v_harga / v_kb);
END;
$$;
REVOKE ALL ON FUNCTION public.pratinjau_ganti_satuan(uuid, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pratinjau_ganti_satuan(uuid, jsonb, numeric) TO authenticated;
