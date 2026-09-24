-- Spec 2026-09-23 K1/K5: harga hanya diketik per vendor (lingkup 'harga':
-- admin/owner/purchasing). Dua penjaga, sama dengan jalur PO:
--   1. isi per satuan beli harus sama dengan turunan master (kalau berbeda, bahan
--      harus dipecah per spesifikasi dulu — aturan "vendor bukan identitas barang");
--   2. rasio harga baru : master yang pas dengan sebuah faktor satuan (>= 2x, toleransi
--      1%) = dugaan salah satuan, ditolak kecuali p_paksa.
--
-- Ruling controller (2026-09-23): harga_updated_at diset eksplisit ke now() di
-- INSERT maupun ON CONFLICT DO UPDATE SET, supaya konfirmasi ulang manual (walau
-- harga tak berubah) tetap menjadi sumber TERBARU untuk harga master — trigger
-- BEFORE bbs_isi_harga_updated_at() TIDAK membumbungkan harga_updated_at bila
-- harga tak berubah, jadi tanpa ini konfirmasi ulang tak pernah "menang" atas
-- vendor lain yang lebih baru.

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

CREATE OR REPLACE FUNCTION public.nonaktifkan_harga_vendor(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._peran_master('harga');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('app.alasan', p_alasan, true);
  UPDATE public.bahan_baku_supplier SET is_active = false, is_preferred = false, updated_by = auth.uid()
   WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baris katalog % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.simpan_supplier(p_id uuid, p_data jsonb, p_alasan text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_boleh constant text[] := ARRAY['nama','kontak','alamat','kategori','catatan','termin_hari','vendor_induk_id'];
  v_uid   uuid := public._peran_master('harga');
  v_kunci text;
  v_nama  text;
  v_id    uuid;
BEGIN
  FOR v_kunci IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak boleh diubah lewat simpan_supplier', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;
  v_nama := btrim(COALESCE(p_data ->> 'nama', (SELECT nama FROM public.supplier WHERE id = p_id)));
  IF COALESCE(v_nama, '') = '' THEN RAISE EXCEPTION 'Nama supplier wajib diisi' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.supplier WHERE is_active AND lower(btrim(nama)) = lower(v_nama)
                AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Sudah ada supplier aktif bernama "%"', v_nama USING ERRCODE = '23505';
  END IF;
  PERFORM set_config('app.alasan', COALESCE(p_alasan, ''), true);

  IF p_id IS NULL THEN
    INSERT INTO public.supplier (nama, kontak, alamat, kategori, catatan, termin_hari, vendor_induk_id, created_by, is_active)
    VALUES (v_nama, p_data ->> 'kontak', p_data ->> 'alamat', p_data ->> 'kategori', p_data ->> 'catatan',
            (p_data ->> 'termin_hari')::int, (p_data ->> 'vendor_induk_id')::uuid, v_uid, true)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.supplier SET
    nama            = v_nama,
    kontak          = CASE WHEN p_data ? 'kontak' THEN p_data ->> 'kontak' ELSE kontak END,
    alamat          = CASE WHEN p_data ? 'alamat' THEN p_data ->> 'alamat' ELSE alamat END,
    kategori        = CASE WHEN p_data ? 'kategori' THEN p_data ->> 'kategori' ELSE kategori END,
    catatan         = CASE WHEN p_data ? 'catatan' THEN p_data ->> 'catatan' ELSE catatan END,
    termin_hari     = CASE WHEN p_data ? 'termin_hari' THEN (p_data ->> 'termin_hari')::int ELSE termin_hari END,
    vendor_induk_id = CASE WHEN p_data ? 'vendor_induk_id' THEN (p_data ->> 'vendor_induk_id')::uuid ELSE vendor_induk_id END
  WHERE id = p_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Supplier % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.nonaktifkan_supplier(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int;
BEGIN
  PERFORM public._peran_master('harga');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  SELECT count(*) INTO v_n FROM public.purchase_order
   WHERE supplier_id = p_id AND status NOT IN ('diterima_lengkap', 'dibatalkan');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Supplier masih punya % PO terbuka; selesaikan dulu', v_n;
  END IF;
  PERFORM set_config('app.alasan', p_alasan, true);
  UPDATE public.supplier SET is_active = false WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_harga_vendor(uuid, uuid, numeric, text, numeric, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nonaktifkan_harga_vendor(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simpan_supplier(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nonaktifkan_supplier(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simpan_harga_vendor(uuid, uuid, numeric, text, numeric, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nonaktifkan_harga_vendor(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simpan_supplier(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nonaktifkan_supplier(uuid, text) TO authenticated;
