-- Ganti Satuan — perbaikan review C1: skala kolom opname_item dibaca dari data.
-- Spec: docs/superpowers/specs/2026-11-09-ganti-satuan-bahan-baku-design.md §4.3 butir 5 (dikoreksi)
--
-- Versi 20261109104240 mengandaikan opname transisi selalu menyimpan qty_system skala BESAR.
-- Data live: 634 baris transisi skala besar, 259 skala KECIL (form opname sejak 19 Agu 2026
-- mengonversi saldo skala besar ke gram sebelum menyimpan qty_system). Mengalikan baris kecil
-- dengan k_besar merusak riwayat opname (selisih palsu). Kini skala qty_system/qty_fisik
-- ditentukan dengan membandingkan nilainya dengan saldo ledger yang dirujuk; aturan waktu
-- hanya cadangan. Faktor per baris ledger dihitung SEKALI dari nilai asli (_gs_ledger_faktor)
-- sebelum ledger maupun opname diubah. Uji: supabase/verifikasi/ganti_satuan/t4_opname_skala.sql.

CREATE OR REPLACE FUNCTION public.ganti_satuan_bahan(p_bahan uuid, p_baru jsonb, p_jembatan numeric, p_alasan text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_cutoff constant timestamptz := '2026-08-01 20:32:00+07';
  c_maks_ledger constant bigint := 200000;
  v_bahan   public.bahan_baku%ROWTYPE;
  v_r jsonb; v_baru jsonb; v_kk numeric; v_kb numeric;
  v_n jsonb := '{}'::jsonb; v_c bigint;
  v_m0 record; v_m1 record; v_ledger0 bigint; v_ledger1 bigint;
  v_t_gudang timestamptz; v_harga_lama numeric; v_pesan text; v_id uuid;
BEGIN
  PERFORM public._peran_master('data');
  IF COALESCE(btrim(p_alasan), '') = '' THEN
    RAISE EXCEPTION 'Alasan ganti satuan wajib diisi' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('lock_timeout', '5s', true);

  SELECT * INTO v_bahan FROM public.bahan_baku WHERE id = p_bahan FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_bahan USING ERRCODE = 'P0002'; END IF;

  SELECT count(*) INTO v_ledger0 FROM public.ledger_stok WHERE bahan_baku_id = p_bahan;
  IF v_ledger0 > c_maks_ledger THEN
    RAISE EXCEPTION 'Bahan "%" punya % baris riwayat stok (batas %); ganti satuan bahan ini perlu dikerjakan manual oleh developer',
      v_bahan.nama, v_ledger0, c_maks_ledger USING ERRCODE = '22023';
  END IF;

  v_r := public._rencana_ganti_satuan(p_bahan, p_baru, p_jembatan);
  IF jsonb_array_length(v_r -> 'penghalang') > 0 THEN
    SELECT string_agg(
             CASE x->>'jenis'
               WHEN 'opname_draft' THEN 'draft opname'
               WHEN 'surat_jalan' THEN 'surat jalan'
               WHEN 'purchase_order' THEN 'PO'
               WHEN 'terima_vendor' THEN 'terima vendor'
               ELSE x->>'jenis' END
             || ' ' || COALESCE(x->>'nomor', '') || COALESCE(' (' || (x->>'outlet') || ')', ''), '; ')
      INTO v_pesan FROM jsonb_array_elements(v_r -> 'penghalang') x;
    RAISE EXCEPTION 'Ganti satuan "%" ditolak, masih ada dokumen terbuka: %', v_bahan.nama, v_pesan USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(v_r -> 'peringatan_label') > 0 THEN
    SELECT string_agg(x, '; ') INTO v_pesan FROM jsonb_array_elements_text(v_r -> 'peringatan_label') x;
    RAISE EXCEPTION '%', v_pesan USING ERRCODE = '22023';
  END IF;
  v_kk := (v_r ->> 'k_kecil')::numeric;
  v_kb := (v_r ->> 'k_besar')::numeric;
  v_baru := v_r -> 'satuan_baru';

  -- Skala dicatat SEBELUM menulis apa pun.
  DROP TABLE IF EXISTS _gs_transisi;
  CREATE TEMP TABLE _gs_transisi ON COMMIT DROP AS
    SELECT DISTINCT ON (outlet_id) outlet_id, id AS ledger_id, created_at AS t
      FROM public.ledger_stok
     WHERE bahan_baku_id = p_bahan AND tipe = 'opname_selisih' AND created_at >= c_cutoff
     ORDER BY outlet_id, created_at, id;
  DROP TABLE IF EXISTS _gs_skala_saldo;
  CREATE TEMP TABLE _gs_skala_saldo ON COMMIT DROP AS
    SELECT sb.id, public.saldo_is_gram(sb) AS kecil FROM public.stok_balance sb WHERE sb.bahan_baku_id = p_bahan;
  SELECT t INTO v_t_gudang FROM _gs_transisi WHERE outlet_id = public.gudang_pusat_id();

  SELECT * INTO v_m0 FROM public._metrik_ledger_bahan(p_bahan);

  PERFORM set_config('app.ganti_satuan', 'on', true);
  PERFORM set_config('app.alasan',
    format('Ganti satuan %s → %s (1 %s lama = %s %s baru). %s',
      v_bahan.satuan || COALESCE('/' || v_bahan.satuan_tengah, '') || '/' || v_bahan.satuan_kecil,
      (v_baru->>'satuan') || COALESCE('/' || (v_baru->>'satuan_tengah'), '') || '/' || (v_baru->>'satuan_kecil'),
      v_bahan.satuan_kecil, trim_scale(p_jembatan), v_baru->>'satuan_kecil', btrim(p_alasan)), true);

  -- 1. Master
  UPDATE public.bahan_baku SET
    satuan = v_baru->>'satuan',
    satuan_tengah = v_baru->>'satuan_tengah',
    faktor_tengah = (v_baru->>'faktor_tengah')::numeric,
    satuan_kecil = v_baru->>'satuan_kecil',
    faktor_tampilan = (v_baru->>'faktor_tampilan')::numeric,
    satuan_po = v_baru->>'satuan_po',
    satuan_distribusi = v_baru->>'satuan_distribusi',
    default_reorder_point = default_reorder_point * v_kb,
    stok_ideal = stok_ideal * v_kb,
    satuan_diganti_at = now()
  WHERE id = p_bahan;

  -- 2. Saldo
  UPDATE public.stok_balance sb SET saldo = sb.saldo * CASE WHEN s.kecil THEN v_kk ELSE v_kb END
    FROM _gs_skala_saldo s WHERE s.id = sb.id;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('stok_balance', v_c);

  -- 3. Faktor per baris ledger, dihitung dari nilai ASLI sebelum ledger diubah (dipakai opname & ledger).
  DROP TABLE IF EXISTS _gs_ledger_faktor;
  CREATE TEMP TABLE _gs_ledger_faktor ON COMMIT DROP AS
    SELECT l2.id, l2.outlet_id, l2.created_at, l2.tipe, l2.ref_opname_id, l2.saldo_sebelum, l2.saldo_sesudah,
           COALESCE(tr.ledger_id = l2.id, false) AS trans,
           CASE WHEN tr.t IS NULL OR l2.created_at < tr.t OR tr.ledger_id = l2.id THEN v_kb ELSE v_kk END AS fs,
           CASE WHEN tr.t IS NULL OR l2.created_at < tr.t THEN v_kb ELSE v_kk END AS fd
      FROM public.ledger_stok l2 LEFT JOIN _gs_transisi tr ON tr.outlet_id = l2.outlet_id
     WHERE l2.bahan_baku_id = p_bahan;
  CREATE INDEX ON _gs_ledger_faktor (outlet_id, created_at);

  -- 4. Opname — skala tiap kolom dibaca dari DATA (review C1): qty_system dibandingkan dengan
  --    saldo ledger yang dirujuknya (saldo_sebelum baris opname_selisih-nya, atau saldo_sesudah
  --    baris ledger terakhir sebelum opname). Sama → skala baris itu; sama dengan ×faktor_tampilan
  --    lama padahal baris itu skala besar → skala kecil (form sejak 19 Agu menyimpan gram).
  --    qty_fisik dibandingkan dengan saldo_sesudah baris opname_selisih; tanpa baris itu (selisih 0)
  --    mengikuti qty_system. Tak cocok apa pun → aturan waktu (transisi) sebagai cadangan.
  UPDATE public.opname_item oi SET qty_system = oi.qty_system * f.fs, qty_fisik = oi.qty_fisik * f.fd
  FROM (
    SELECT z.id, z.fs,
           CASE WHEN z.lo_id IS NOT NULL AND COALESCE(z.lo_sesudah, 0) <> 0
                     AND abs(z.qty_fisik - z.lo_sesudah) <= 1e-6 * greatest(1, abs(z.lo_sesudah)) THEN z.lo_fd
                WHEN z.lo_id IS NOT NULL AND z.lo_fd = v_kb AND COALESCE(z.lo_sesudah, 0) <> 0 AND v_bahan.faktor_tampilan <> 1
                     AND abs(z.qty_fisik - z.lo_sesudah * v_bahan.faktor_tampilan)
                         <= 1e-6 * greatest(1, abs(z.lo_sesudah * v_bahan.faktor_tampilan)) THEN v_kk
                WHEN z.lo_id IS NULL THEN z.fs
                ELSE z.fb_fd END AS fd
    FROM (
      SELECT y.*,
             CASE WHEN COALESCE(y.ref_s, 0) <> 0
                       AND abs(y.qty_system - y.ref_s) <= 1e-6 * greatest(1, abs(y.ref_s)) THEN y.ref_k
                  WHEN COALESCE(y.ref_s, 0) <> 0 AND y.ref_k = v_kb AND v_bahan.faktor_tampilan <> 1
                       AND abs(y.qty_system - y.ref_s * v_bahan.faktor_tampilan)
                           <= 1e-6 * greatest(1, abs(y.ref_s * v_bahan.faktor_tampilan)) THEN v_kk
                  ELSE y.fb_fs END AS fs
      FROM (
        SELECT oi2.id, oi2.qty_system, oi2.qty_fisik,
               lo.id AS lo_id, lo.saldo_sesudah AS lo_sesudah, lo.fd AS lo_fd,
               COALESCE(lo.saldo_sebelum, lp.saldo_sesudah) AS ref_s,
               CASE WHEN lo.id IS NOT NULL THEN lo.fs ELSE lp.fd END AS ref_k,
               CASE WHEN lo.trans THEN v_kb
                    WHEN tr.t IS NOT NULL AND COALESCE(lo.created_at, o.finalized_at, o.created_at) >= tr.t THEN v_kk
                    ELSE v_kb END AS fb_fs,
               CASE WHEN lo.trans THEN v_kk
                    WHEN tr.t IS NOT NULL AND COALESCE(lo.created_at, o.finalized_at, o.created_at) >= tr.t THEN v_kk
                    ELSE v_kb END AS fb_fd
          FROM public.opname_item oi2
          JOIN public.opname o ON o.id = oi2.opname_id
          LEFT JOIN _gs_transisi tr ON tr.outlet_id = o.outlet_id
          LEFT JOIN LATERAL (SELECT g.* FROM _gs_ledger_faktor g
                              WHERE g.ref_opname_id = o.id AND g.tipe = 'opname_selisih'
                              ORDER BY g.created_at, g.id LIMIT 1) lo ON true
          LEFT JOIN LATERAL (SELECT g.* FROM _gs_ledger_faktor g
                              WHERE g.outlet_id = o.outlet_id AND g.created_at <= COALESCE(o.finalized_at, o.created_at)
                              ORDER BY g.created_at DESC, g.id DESC LIMIT 1) lp ON lo.id IS NULL
         WHERE oi2.bahan_baku_id = p_bahan
      ) y
    ) z
  ) f
  WHERE oi.id = f.id;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('opname_item', v_c);

  -- 4b. Riwayat ledger
  UPDATE public.ledger_stok l SET
    saldo_sebelum = l.saldo_sebelum * f.fs,
    saldo_sesudah = l.saldo_sesudah * f.fd,
    qty = CASE WHEN f.trans AND l.saldo_sebelum IS NOT NULL AND l.saldo_sesudah IS NOT NULL
               THEN l.saldo_sesudah * f.fd - l.saldo_sebelum * f.fs
               ELSE l.qty * f.fd END
  FROM _gs_ledger_faktor f
  WHERE l.id = f.id;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('ledger', v_c);

  -- 5. Mutasi vendor Gudang Pusat (skala ledger Gudang Pusat) & inbound/outbound (skala ledger outletnya)
  UPDATE public.stok_vendor_gudang_mutasi m
     SET qty = m.qty * CASE WHEN v_t_gudang IS NULL OR m.created_at < v_t_gudang THEN v_kb ELSE v_kk END
   WHERE m.bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('svgm', v_c);
  UPDATE public.inbound_outbound io SET qty = io.qty * f.k, harga_satuan = io.harga_satuan / f.k
  FROM (SELECT io2.id, CASE WHEN tr.t IS NULL OR io2.created_at < tr.t THEN v_kb ELSE v_kk END AS k
          FROM public.inbound_outbound io2 LEFT JOIN _gs_transisi tr ON tr.outlet_id = io2.outlet_id
         WHERE io2.bahan_baku_id = p_bahan) f
  WHERE io.id = f.id;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('inbound_outbound', v_c);

  -- 6. Kolom berskala satuan besar
  UPDATE public.opname_item_vendor SET qty_besar = qty_besar * v_kb WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('opname_item_vendor', v_c);
  UPDATE public.outlet_reorder_point SET reorder_point = reorder_point * v_kb, stok_ideal = stok_ideal * v_kb
   WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('reorder_point', v_c);
  UPDATE public.surat_jalan_item SET qty_dikirim = qty_dikirim * v_kb, qty_terima = qty_terima * v_kb,
         harga_snapshot = harga_snapshot / v_kb WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('sj_item', v_c);
  UPDATE public.purchase_order_item SET qty_pesan = qty_pesan * v_kb, qty_terima = qty_terima * v_kb,
         harga_pesan = harga_pesan / v_kb, harga_terima = harga_terima / v_kb WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('po_item', v_c);
  UPDATE public.permintaan_bahan_item SET qty_diminta = qty_diminta * v_kb, qty_disetujui = qty_disetujui * v_kb,
         harga_snapshot = harga_snapshot / v_kb WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('permintaan_item', v_c);
  UPDATE public.stok_waste_reports SET qty = qty * v_kb WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('waste', v_c);
  UPDATE public.terima_vendor_outlet SET qty = qty * v_kb, harga_snapshot = harga_snapshot / v_kb WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('terima_vendor', v_c);
  UPDATE public.retur_stok_item SET qty_klaim = qty_klaim * v_kb, qty_diterima_kitchen = qty_diterima_kitchen * v_kb
   WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('retur_item', v_c);
  UPDATE public.mutasi_antar_outlet_item SET qty_diajukan = qty_diajukan * v_kb, qty_dikirim = qty_dikirim * v_kb,
         qty_diterima = qty_diterima * v_kb WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('mutasi_item', v_c);

  -- 7. Kolom berskala satuan kecil
  UPDATE public.resep_item SET qty_per_porsi = qty_per_porsi * v_kk, satuan = v_baru->>'satuan_kecil'
   WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('resep_item', v_c);

  -- 8. Permintaan pembelian (label bebas): dikonversi ke satuan kecil baru bila labelnya tingkat lama
  UPDATE public.purchase_request pr SET qty = pr.qty * f.isi * v_kk, satuan = v_baru->>'satuan_kecil'
  FROM (SELECT pr2.id,
               CASE public._kanon_satuan(pr2.satuan)
                 WHEN public._kanon_satuan(v_bahan.satuan) THEN v_bahan.faktor_tampilan
                 WHEN public._kanon_satuan(v_bahan.satuan_tengah) THEN v_bahan.faktor_tampilan / v_bahan.faktor_tengah
                 WHEN public._kanon_satuan(v_bahan.satuan_kecil) THEN 1
               END AS isi
          FROM public.purchase_request pr2 WHERE pr2.bahan_baku_id = p_bahan) f
  WHERE pr.id = f.id AND f.isi IS NOT NULL;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('purchase_request', v_c);
  v_n := v_n || jsonb_build_object('purchase_request_dilewati',
    (SELECT count(*) FROM public.purchase_request WHERE bahan_baku_id = p_bahan
       AND public._kanon_satuan(satuan) IS DISTINCT FROM public._kanon_satuan(v_baru->>'satuan_kecil')));

  -- 9. Harga master (sesudah master, sebelum katalog) lalu katalog vendor
  SELECT harga_beli INTO v_harga_lama FROM public.bahan_baku_harga WHERE bahan_baku_id = p_bahan;
  IF v_harga_lama IS NOT NULL THEN
    UPDATE public.bahan_baku_harga SET harga_beli = harga_beli / v_kb, harga_updated_at = now(), updated_by = auth.uid()
     WHERE bahan_baku_id = p_bahan;
    INSERT INTO public.bahan_baku_harga_history (bahan_baku_id, harga_lama, harga_baru, catatan, changed_by)
    VALUES (p_bahan, v_harga_lama, v_harga_lama / v_kb, current_setting('app.alasan', true), auth.uid());
  END IF;
  UPDATE public.bahan_baku_supplier SET isi_satuan_kecil = isi_satuan_kecil * v_kk WHERE bahan_baku_id = p_bahan;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('katalog', v_c);

  -- 10. Asersi
  SELECT count(*) INTO v_ledger1 FROM public.ledger_stok WHERE bahan_baku_id = p_bahan;
  IF v_ledger1 <> v_ledger0 THEN
    RAISE EXCEPTION 'Asersi: jumlah baris ledger berubah (% → %)', v_ledger0, v_ledger1;
  END IF;
  SELECT * INTO v_m1 FROM public._metrik_ledger_bahan(p_bahan);
  IF v_m1.beda > v_m0.beda OR v_m1.putus > v_m0.putus THEN
    RAISE EXCEPTION 'Asersi: riwayat stok jadi tidak konsisten (saldo beda % → %, rantai putus % → %); ganti satuan dibatalkan',
      v_m0.beda, v_m1.beda, v_m0.putus, v_m1.putus;
  END IF;

  INSERT INTO public.bahan_baku_ganti_satuan
    (bahan_baku_id, satuan_lama, satuan_baru, jembatan, k_kecil, k_besar, jumlah_baris, alasan, dibuat_oleh)
  VALUES (p_bahan, v_r -> 'satuan_lama', v_baru, p_jembatan, v_kk, v_kb,
          v_n || jsonb_build_object('metrik_sebelum', jsonb_build_object('beda', v_m0.beda, 'putus', v_m0.putus)),
          btrim(p_alasan), auth.uid())
  RETURNING id INTO v_id;

  PERFORM set_config('app.ganti_satuan', '', true);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ganti_satuan_bahan(uuid, jsonb, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ganti_satuan_bahan(uuid, jsonb, numeric, text) TO authenticated;
