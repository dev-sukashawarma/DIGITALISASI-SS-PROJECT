-- Ganti Satuan bahan baku — Task 3: eksekusi.
-- Spec: docs/superpowers/specs/2026-11-09-ganti-satuan-bahan-baku-design.md §4.3, 4.3a, 4.3b
-- Plan: docs/superpowers/plans/2026-11-09-ganti-satuan-bahan-baku.md (Task 3, tabel kolom→faktor)
--
-- Satu transaksi. Mengganti satuan bahan dan mengonversi semua angka berskala satuan lama:
-- saldo, riwayat ledger, opname, resep, katalog vendor, harga master, dokumen selesai.
-- Nilai rupiah dijaga: kolom qty ×faktor, kolom harga per satuan ÷faktor yang sama.
--
-- Skala baris ledger (aturan saldo_is_gram): per (outlet, bahan), transisi = baris
-- opname_selisih pertama sejak 2026-08-01 20:32 WIB. Sebelum transisi = satuan besar
-- (k_besar), sesudah = satuan kecil (k_kecil). Baris transisi: saldo_sebelum ×k_besar,
-- saldo_sesudah ×k_kecil, qty = selisih keduanya.
--
-- Ini pengecualian sengaja atas SOP "perubahan stok lewat ledger": bukan perubahan kuantitas,
-- melainkan perubahan satuan ukur. Trigger efek samping diam lewat app.ganti_satuan (Task 1).
-- bahan_baku_sku sengaja TIDAK dikonversi (kolom qty_isi tanpa satuan baku, 0 baris di DB).

CREATE OR REPLACE FUNCTION public._metrik_ledger_bahan(p_bahan uuid, OUT beda bigint, OUT putus bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.stok_balance sb
       LEFT JOIN LATERAL (SELECT l.saldo_sesudah FROM public.ledger_stok l
                           WHERE l.outlet_id = sb.outlet_id AND l.bahan_baku_id = sb.bahan_baku_id
                           ORDER BY l.created_at DESC, l.id DESC LIMIT 1) l ON true
      WHERE sb.bahan_baku_id = p_bahan
        AND (l.saldo_sesudah IS NULL OR abs(l.saldo_sesudah - sb.saldo) > 1e-6 * greatest(1, abs(sb.saldo)))),
    (SELECT count(*) FROM (
       SELECT l.saldo_sebelum,
              lag(l.saldo_sesudah) OVER (PARTITION BY l.outlet_id ORDER BY l.created_at, l.id) AS prev
         FROM public.ledger_stok l WHERE l.bahan_baku_id = p_bahan) x
      WHERE x.prev IS NOT NULL AND x.saldo_sebelum IS NOT NULL
        AND abs(x.saldo_sebelum - x.prev) > 1e-6 * greatest(1, abs(x.prev)));
$$;
REVOKE ALL ON FUNCTION public._metrik_ledger_bahan(uuid) FROM PUBLIC, anon, authenticated;

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

  -- 3. Riwayat ledger
  UPDATE public.ledger_stok l SET
    saldo_sebelum = l.saldo_sebelum * f.fs,
    saldo_sesudah = l.saldo_sesudah * f.fd,
    qty = CASE WHEN f.trans AND l.saldo_sebelum IS NOT NULL AND l.saldo_sesudah IS NOT NULL
               THEN l.saldo_sesudah * f.fd - l.saldo_sebelum * f.fs
               ELSE l.qty * f.fd END
  FROM (SELECT l2.id,
               COALESCE(tr.ledger_id = l2.id, false) AS trans,
               CASE WHEN tr.t IS NULL OR l2.created_at < tr.t OR tr.ledger_id = l2.id THEN v_kb ELSE v_kk END AS fs,
               CASE WHEN tr.t IS NULL OR l2.created_at < tr.t THEN v_kb ELSE v_kk END AS fd
          FROM public.ledger_stok l2 LEFT JOIN _gs_transisi tr ON tr.outlet_id = l2.outlet_id
         WHERE l2.bahan_baku_id = p_bahan) f
  WHERE l.id = f.id;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('ledger', v_c);

  -- 4. Opname (opname transisi: qty_system skala besar, qty_fisik skala kecil)
  UPDATE public.opname_item oi SET qty_system = oi.qty_system * f.fs, qty_fisik = oi.qty_fisik * f.fd
  FROM (SELECT oi2.id,
               CASE WHEN lo.id IS NOT NULL AND lo.id = tr.ledger_id THEN v_kb
                    WHEN tr.t IS NOT NULL AND COALESCE(lo.created_at, o.finalized_at, o.created_at) >= tr.t THEN v_kk
                    ELSE v_kb END AS fs,
               CASE WHEN lo.id IS NOT NULL AND lo.id = tr.ledger_id THEN v_kk
                    WHEN tr.t IS NOT NULL AND COALESCE(lo.created_at, o.finalized_at, o.created_at) >= tr.t THEN v_kk
                    ELSE v_kb END AS fd
          FROM public.opname_item oi2
          JOIN public.opname o ON o.id = oi2.opname_id
          LEFT JOIN _gs_transisi tr ON tr.outlet_id = o.outlet_id
          LEFT JOIN LATERAL (SELECT l.id, l.created_at FROM public.ledger_stok l
                              WHERE l.ref_opname_id = o.id AND l.bahan_baku_id = p_bahan AND l.tipe = 'opname_selisih'
                              ORDER BY l.created_at, l.id LIMIT 1) lo ON true
         WHERE oi2.bahan_baku_id = p_bahan) f
  WHERE oi.id = f.id;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n || jsonb_build_object('opname_item', v_c);

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
