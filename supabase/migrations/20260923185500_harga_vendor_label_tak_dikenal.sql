-- Fix round 1/5, Task 6 review (controller ruling, IMPORTANT/plan-mandated):
-- simpan_harga_vendor() skipped the isi-mismatch guard entirely whenever
-- hitung_faktor_po() returned NULL for p_satuan_beli (unmapped label: typos
-- like 'rol', or 'kg' on a gram-scale bahan). The master price was then
-- derived straight from the typed isi (harga/isi×faktor_tampilan) with no
-- check at all — e.g. 'kg' typed with isi=1 instead of 1000 moves the master
-- price ~1000x, and the existing ratio guard only catches that by
-- coincidence (it only runs when a prior price already exists).
--
-- Ruling:
--  (a) If the label is unmapped AND _kanon_satuan(p_satuan_beli) = 'kg' AND
--      _kanon_satuan(b.satuan_kecil) = 'gram', treat the master isi as 1000
--      so the normal isi-mismatch guard applies (kg is a common real-world
--      label that hitung_faktor_po() has no rule for, unlike bks->bungkus).
--  (b) Otherwise, if the label is still unmapped and NOT p_paksa, RAISE
--      (22023) with a message naming the label and the bahan's unit tiers,
--      instead of silently proceeding.
-- Everything else in the live function is preserved verbatim (confirmed via
-- pg_get_functiondef before writing this CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.simpan_harga_vendor(
  p_bahan uuid, p_supplier uuid, p_harga numeric, p_satuan_beli text,
  p_isi_satuan_kecil numeric, p_alasan text, p_paksa boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := public._peran_master('harga');
  b           public.bahan_baku%ROWTYPE;
  v_isi_mstr  numeric;
  v_baru      numeric;
  v_lama      numeric;
  v_rasio     numeric;
  v_faktor    numeric;
  v_id        uuid;
  v_tingkat   text;
BEGIN
  IF COALESCE(btrim(p_alasan), '') = '' THEN
    RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023';
  END IF;
  IF p_harga IS NULL OR p_harga <= 0 OR p_harga = 'NaN'::numeric
     OR p_isi_satuan_kecil IS NULL OR p_isi_satuan_kecil <= 0 OR p_isi_satuan_kecil = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Harga dan isi satuan beli wajib angka > 0' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(btrim(p_satuan_beli), '') = '' THEN
    RAISE EXCEPTION 'Satuan beli wajib diisi' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO b FROM public.bahan_baku WHERE id = p_bahan AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bahan aktif % tidak ditemukan', p_bahan USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.supplier WHERE id = p_supplier AND is_active) THEN
    RAISE EXCEPTION 'Supplier aktif % tidak ditemukan', p_supplier USING ERRCODE = 'P0002';
  END IF;

  v_isi_mstr := public.hitung_faktor_po(b.satuan, p_satuan_beli, b.satuan_tengah, b.faktor_tengah,
                                        b.satuan_kecil, b.faktor_tampilan);

  IF v_isi_mstr IS NULL
     AND public._kanon_satuan(p_satuan_beli) = 'kg'
     AND public._kanon_satuan(b.satuan_kecil) = 'gram' THEN
    v_isi_mstr := 1000;
  ELSIF v_isi_mstr IS NULL AND NOT p_paksa THEN
    v_tingkat := b.satuan || COALESCE('/' || b.satuan_tengah, '') || COALESCE('/' || b.satuan_kecil, '');
    RAISE EXCEPTION 'Satuan beli "%" tidak dikenali untuk bahan ini (tingkat: %); periksa ejaan atau simpan dengan paksa bila memang benar.',
      p_satuan_beli, v_tingkat USING ERRCODE = '22023';
  END IF;

  IF v_isi_mstr IS NOT NULL AND abs(p_isi_satuan_kecil - v_isi_mstr) / v_isi_mstr > 0.001 THEN
    RAISE EXCEPTION 'Isi 1 % dari vendor ini (%) berbeda dengan master (%). Bahan harus dipecah per spesifikasi dulu sebelum harga ini dicatat.',
      p_satuan_beli, p_isi_satuan_kecil, v_isi_mstr;
  END IF;

  v_baru := p_harga / p_isi_satuan_kecil * COALESCE(b.faktor_tampilan, 1);
  SELECT harga_beli INTO v_lama FROM public.bahan_baku_harga WHERE bahan_baku_id = p_bahan;
  IF NOT p_paksa AND v_lama IS NOT NULL AND v_lama > 0 THEN
    v_rasio := GREATEST(v_baru / v_lama, v_lama / v_baru);
    FOR v_faktor IN
      SELECT f FROM (VALUES (b.faktor_tengah), (b.faktor_tampilan), (b.faktor_konversi)) k(f)
       WHERE f IS NOT NULL AND f >= 2
    LOOP
      IF abs(v_rasio - v_faktor) / v_faktor <= 0.01 THEN
        RAISE EXCEPTION 'Harga ini %x harga master (Rp %), pas dengan faktor satuan % — kemungkinan salah satuan. Periksa lagi, atau simpan dengan paksa bila memang benar.',
          round(v_rasio, 2), round(v_lama, 2), v_faktor;
      END IF;
    END LOOP;
  END IF;

  PERFORM set_config('app.alasan', p_alasan, true);
  INSERT INTO public.bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga,
                                          sumber, perlu_ditinjau, is_active, updated_by, ref_po_id, harga_updated_at)
  VALUES (p_bahan, p_supplier, p_satuan_beli, p_isi_satuan_kecil, p_harga, 'manual', false, true, v_uid, NULL, now())
  ON CONFLICT (bahan_baku_id, supplier_id) DO UPDATE
     SET satuan_beli = EXCLUDED.satuan_beli,
         isi_satuan_kecil = EXCLUDED.isi_satuan_kecil,
         harga = EXCLUDED.harga,
         sumber = 'manual',
         perlu_ditinjau = false,
         is_active = true,
         updated_by = EXCLUDED.updated_by,
         ref_po_id = NULL,
         harga_updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_harga_vendor(uuid, uuid, numeric, text, numeric, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simpan_harga_vendor(uuid, uuid, numeric, text, numeric, text, boolean) TO authenticated;
