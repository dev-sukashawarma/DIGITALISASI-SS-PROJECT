-- 20260911122000_drop_ship_sahkan_nota.sql
-- Pengesahan nota vendor drop-ship -> utang (PO). Spec §4.2, §4.3, §5.2.
--
-- TIGA LARANGAN (spec §4.3), dijaga di sini:
--  1. Tidak memanggil verifikasi_terima_po (menulis stok ke Gudang Pusat).
--     Stok SUDAH masuk ke outlet lewat trigger catatan crew. Fungsi ini menulis
--     NOL baris ledger -- diuji t7 (f).
--  2. PO dibuat lewat INSERT berstatus diterima_lengkap, BUKAN UPDATE status:
--     po_status_transition_guard (BEFORE UPDATE) hanya mengizinkan
--     kitchen/admin/owner, sedangkan purchasing boleh mengesahkan (K2).
--  3. PO membawa nota_vendor_id supaya pemeriksa PO-tanpa-ledger bisa
--     mengecualikannya.

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.ringkasan_nota_vendor(p_supplier_id uuid, p_tanggal_tagihan date)
RETURNS TABLE(outlet_id uuid, outlet_nama text, bahan_baku_id uuid, bahan_nama text,
              jumlah_catatan int, total_qty numeric, total_nilai numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF public.peran_saya() NOT IN ('purchasing','kitchen','admin','owner','admin_finance') OR public.peran_saya() IS NULL THEN
    RAISE EXCEPTION 'Hanya purchasing/kitchen/admin yang bisa melihat nota vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO p FROM public.periode_tagihan(p_tanggal_tagihan);
  RETURN QUERY
    SELECT t.outlet_id, o.name, t.bahan_baku_id, b.nama, count(*)::int, sum(t.qty), sum(t.qty * t.harga_snapshot)
      FROM public.terima_vendor_outlet t
      JOIN public.outlets o ON o.id = t.outlet_id
      JOIN public.bahan_baku b ON b.id = t.bahan_baku_id
     -- Outlet tes SENGAJA ikut tampil: catatan yang harus disahkan tak boleh
     -- disembunyikan. Aturan "outlet tes jangan dihitung" ditegakkan di laporan.
     WHERE t.supplier_id = p_supplier_id AND t.status = 'dicatat'
       AND t.tanggal_terima BETWEEN p.mulai AND p.akhir
     GROUP BY t.outlet_id, o.name, t.bahan_baku_id, b.nama
     ORDER BY o.name;
END $$;

CREATE OR REPLACE FUNCTION public.sahkan_nota_vendor(
  p_supplier_id uuid, p_tanggal_tagihan date, p_total_kg numeric, p_total_rupiah numeric,
  p_foto_nota_url text, p_catatan_selisih text DEFAULT NULL, p_rincian jsonb DEFAULT '[]')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c_batas_persen CONSTANT numeric := 0.5;   -- SAMA dengan BATAS_SELISIH_PERSEN di dropShip.ts
  v_staff uuid := auth.uid(); v_peran text := public.peran_saya();
  p record; v_crew numeric; v_bahan uuid; v_n_bahan int; v_harga numeric;
  v_nota uuid; v_po uuid; v_supplier_nama text; v_nomor text; r jsonb;
  v_old numeric; v_rasio numeric; v_faktor numeric; v_salah boolean := false;
BEGIN
  IF v_peran IS NULL OR v_peran NOT IN ('purchasing','kitchen','admin') THEN
    RAISE EXCEPTION 'Hanya purchasing, kitchen, atau admin yang boleh mengesahkan nota vendor'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO p FROM public.periode_tagihan(p_tanggal_tagihan);
  IF p.tanggal_tagihan <> p_tanggal_tagihan THEN
    RAISE EXCEPTION 'Tanggal % bukan tanggal tagihan (seharusnya %)', p_tanggal_tagihan, p.tanggal_tagihan
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_total_kg IS NULL OR p_total_kg <= 0 OR p_total_rupiah IS NULL OR p_total_rupiah <= 0 THEN
    RAISE EXCEPTION 'Total kg dan total rupiah nota wajib diisi' USING ERRCODE = 'check_violation';
  END IF;
  IF p_foto_nota_url IS NULL OR btrim(p_foto_nota_url) = '' THEN
    RAISE EXCEPTION 'Foto nota wajib' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(DISTINCT t.bahan_baku_id), min(t.bahan_baku_id::text)::uuid, COALESCE(sum(t.qty), 0)
    INTO v_n_bahan, v_bahan, v_crew
    FROM public.terima_vendor_outlet t
   WHERE t.supplier_id = p_supplier_id AND t.status = 'dicatat'
     AND t.tanggal_terima BETWEEN p.mulai AND p.akhir;
  IF v_n_bahan = 0 THEN
    RAISE EXCEPTION 'Tidak ada catatan terima crew di periode % s/d %', p.mulai, p.akhir USING ERRCODE = 'check_violation';
  END IF;
  IF v_n_bahan > 1 THEN
    -- YAGNI: Tempo 10 hanya sayur. Nota multi-bahan butuh rincian per bahan -- belum didukung.
    RAISE EXCEPTION 'Nota multi-bahan belum didukung (% bahan di periode ini)', v_n_bahan USING ERRCODE = 'check_violation';
  END IF;
  IF abs(v_crew - p_total_kg) / p_total_kg * 100 > c_batas_persen
     AND (p_catatan_selisih IS NULL OR btrim(p_catatan_selisih) = '') THEN
    RAISE EXCEPTION 'Catatan crew % kg vs nota % kg -- selisih wajib dijelaskan', v_crew, p_total_kg
      USING ERRCODE = 'check_violation';
  END IF;

  v_harga := p_total_rupiah / p_total_kg;
  SELECT nama INTO v_supplier_nama FROM public.supplier WHERE id = p_supplier_id;

  INSERT INTO public.nota_vendor (supplier_id, periode_mulai, periode_akhir, tanggal_tagihan,
      total_kg_nota, total_rupiah_nota, foto_nota_url, disahkan_oleh, catatan_selisih)
  VALUES (p_supplier_id, p.mulai, p.akhir, p.tanggal_tagihan, p_total_kg, p_total_rupiah,
      btrim(p_foto_nota_url), v_staff, NULLIF(btrim(p_catatan_selisih), ''))
  RETURNING id INTO v_nota;       -- unique index nota_vendor_unik_periode menolak nota ganda

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rincian, '[]'::jsonb)) LOOP
    INSERT INTO public.nota_vendor_rincian (nota_vendor_id, outlet_id, tanggal_kirim, qty_kg)
    VALUES (v_nota, (r->>'outlet_id')::uuid, NULLIF(r->>'tanggal_kirim','')::date, (r->>'qty_kg')::numeric);
  END LOOP;

  -- Nomor sendiri, deterministik & unik per vendor per periode (bukan generate_nomor_po,
  -- yang selalu berawalan PO/KITCHEN/).
  v_nomor := 'NV/' || to_char(p.tanggal_tagihan, 'YYYYMMDD') || '/' || left(p_supplier_id::text, 8);

  INSERT INTO public.purchase_order (nomor_po, supplier_id, supplier_nama, tanggal_po, status, payment_status,
      jatuh_tempo, dibuat_oleh, diverifikasi_oleh, diverifikasi_at, invoice_urls, nota_vendor_id, catatan)
  VALUES (v_nomor, p_supplier_id, v_supplier_nama, p.tanggal_tagihan, 'diterima_lengkap', 'unpaid',
      p.tanggal_tagihan, v_staff, v_staff, now(), ARRAY[btrim(p_foto_nota_url)], v_nota,
      'Nota drop-ship periode ' || p.mulai || ' s/d ' || p.akhir)
  RETURNING id INTO v_po;

  INSERT INTO public.purchase_order_item (purchase_order_id, bahan_baku_id, qty_pesan, harga_pesan,
      qty_terima, harga_terima, kondisi, catatan)
  VALUES (v_po, v_bahan, p_total_kg, v_harga, p_total_kg, v_harga, 'baik', 'Dari nota drop-ship');

  UPDATE public.nota_vendor SET purchase_order_id = v_po WHERE id = v_nota;

  -- Kunci catatan crew. Trigger sinkron melihat target tak berubah -> nol baris ledger.
  UPDATE public.terima_vendor_outlet SET status = 'disahkan', nota_vendor_id = v_nota, updated_at = now()
   WHERE supplier_id = p_supplier_id AND status = 'dicatat' AND tanggal_terima BETWEEN p.mulai AND p.akhir;

  -- Harga master ikut nota (keputusan owner 2026-09-11) -- dengan penjaga rasio-faktor
  -- yang SAMA dengan verifikasi_terima_po: rasio harga baru/lama yang persis sama dengan
  -- salah satu faktor konversi bahan = sidik jari salah satuan.
  SELECT harga_beli INTO v_old FROM public.bahan_baku_harga WHERE bahan_baku_id = v_bahan;
  IF v_old IS NOT NULL AND v_old > 0 THEN
    v_rasio := v_harga / v_old; IF v_rasio < 1 THEN v_rasio := 1 / v_rasio; END IF;
    FOR v_faktor IN
      SELECT f FROM (
        SELECT b.faktor_tengah::numeric AS f FROM public.bahan_baku b WHERE b.id = v_bahan
        UNION ALL SELECT b.faktor_tampilan::numeric FROM public.bahan_baku b WHERE b.id = v_bahan
        UNION ALL SELECT b.faktor_konversi::numeric FROM public.bahan_baku b WHERE b.id = v_bahan
        UNION ALL SELECT b.faktor_tampilan::numeric / NULLIF(b.faktor_tengah, 0) FROM public.bahan_baku b WHERE b.id = v_bahan
      ) k WHERE f IS NOT NULL AND f >= 2
    LOOP
      IF abs(v_rasio - v_faktor) / v_faktor <= 0.01 THEN v_salah := true; EXIT; END IF;
    END LOOP;
  END IF;

  IF v_salah THEN
    INSERT INTO public.bahan_baku_harga_history (bahan_baku_id, harga_lama, harga_baru, ref_po_id, catatan, changed_by, changed_at)
    VALUES (v_bahan, v_old, v_old, v_po,
      'DITOLAK (dugaan salah satuan): nota ' || v_nomor || ' Rp ' || round(v_harga, 2) || ', rasio '
      || round(v_rasio, 2) || 'x terhadap master Rp ' || v_old || '. Harga master dipertahankan.', v_staff, now());
  ELSE
    INSERT INTO public.bahan_baku_harga (bahan_baku_id, harga_beli, harga_beli_display, harga_updated_at, updated_by)
    VALUES (v_bahan, v_harga, v_harga, now(), v_staff)
    ON CONFLICT (bahan_baku_id) DO UPDATE SET harga_beli = EXCLUDED.harga_beli, harga_beli_display = EXCLUDED.harga_beli_display,
      harga_updated_at = EXCLUDED.harga_updated_at, updated_by = EXCLUDED.updated_by;
    IF v_old IS DISTINCT FROM v_harga THEN
      INSERT INTO public.bahan_baku_harga_history (bahan_baku_id, harga_lama, harga_baru, ref_po_id, catatan, changed_by, changed_at)
      VALUES (v_bahan, v_old, v_harga, v_po, 'Update dari nota drop-ship ' || v_nomor, v_staff, now());
    END IF;
    UPDATE public.bahan_baku_supplier SET harga = v_harga, perlu_ditinjau = false, sumber = 'po', ref_po_id = v_po,
      harga_updated_at = now(), updated_by = v_staff
     WHERE supplier_id = p_supplier_id AND bahan_baku_id = v_bahan;
  END IF;

  RETURN v_nota;
END $$;

CREATE OR REPLACE FUNCTION public.tolak_terima_vendor(p_id uuid, p_alasan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.peran_saya() IS NULL OR public.peran_saya() NOT IN ('purchasing','kitchen','admin') THEN
    RAISE EXCEPTION 'Hanya purchasing, kitchen, atau admin yang boleh menolak' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_alasan IS NULL OR btrim(p_alasan) = '' THEN
    RAISE EXCEPTION 'Alasan penolakan wajib' USING ERRCODE = 'check_violation';
  END IF;
  -- Trigger sinkron membalik stok lewat 'rejected_kiriman' (lolos penjaga anti-minus).
  UPDATE public.terima_vendor_outlet
     SET status = 'ditolak', catatan = COALESCE(catatan || ' | ', '') || 'Ditolak: ' || btrim(p_alasan), updated_at = now()
   WHERE id = p_id AND status = 'dicatat';
  IF NOT FOUND THEN RAISE EXCEPTION 'Catatan tidak ditemukan atau sudah diproses' USING ERRCODE = 'no_data_found'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.ringkasan_nota_vendor(uuid,date),
  public.sahkan_nota_vendor(uuid,date,numeric,numeric,text,text,jsonb),
  public.tolak_terima_vendor(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ringkasan_nota_vendor(uuid,date),
  public.sahkan_nota_vendor(uuid,date,numeric,numeric,text,text,jsonb),
  public.tolak_terima_vendor(uuid,text) TO authenticated, service_role;

-- DOWN:
-- DROP FUNCTION IF EXISTS public.tolak_terima_vendor(uuid,text),
--   public.sahkan_nota_vendor(uuid,date,numeric,numeric,text,text,jsonb), public.ringkasan_nota_vendor(uuid,date);
