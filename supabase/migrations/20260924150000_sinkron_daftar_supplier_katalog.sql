-- Sinkron dua arah: centang bahan di Master Supplier (supplier.bahan_baku_ids) <-> katalog harga
-- vendor (bahan_baku_supplier, dibaca tab Vendor /dashboard/bahan-baku?tab=vendor).
--
-- Sebelumnya dua daftar ini berdiri sendiri: uncheck bahan di modal Master Supplier hanya mengubah
-- bahan_baku_ids, jadi tab Vendor tetap menampilkan vendor itu (diukur 24 Sep 2026: 25 pasangan
-- aktif di katalog tanpa centang, 13 di antaranya berharga; 9 centang tanpa baris katalog).
--
-- Aturan (keputusan owner 24 Sep 2026, "sinkron otomatis"):
--   simpan_supplier — hanya SELISIH daftar lama vs baru yang disinkronkan:
--     * dilepas centangnya  -> baris katalog pasangan itu dinonaktifkan (riwayat tetap, bisa aktif lagi)
--     * baru dicentang      -> baris lama diaktifkan kembali apa adanya (harga & status tinjau utuh)
--     * dicentang, belum ada baris sama sekali -> baris placeholder harga 0 + perlu_ditinjau
--       (placeholder TIDAK memengaruhi harga master: harga_vendor_terpercaya melewati perlu_ditinjau)
--     Drift lama (baris katalog aktif yang tak pernah dicentang) SENGAJA tidak disentuh: menyamakan
--     paksa akan menonaktifkan 13 baris berharga sekaligus dan menggeser harga master diam-diam.
--   nonaktifkan_harga_vendor — lepas centang bahan itu di supplier.
--   simpan_harga_vendor      — centang bahan itu di supplier.
-- Menonaktifkan baris BERHARGA memang bisa menggeser harga master (trigger turunan) — itu benar:
-- vendor tersebut tak lagi memasok bahan itu.
--
-- Badan fungsi disalin dari definisi LIVE (pg_get_functiondef, 24 Sep 2026), bukan dari berkas lama;
-- tambahan ditandai "-- SINKRON".

CREATE OR REPLACE FUNCTION public.simpan_supplier(p_id uuid, p_data jsonb, p_alasan text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_boleh constant text[] := ARRAY['nama','kontak','alamat','kategori','catatan','termin_hari','vendor_induk_id',
                                   'bahan_baku_ids'];
  v_uid   uuid := public._peran_master('harga');
  v_kunci text;
  v_nama  text;
  v_id    uuid;
  v_ids   uuid[];
  v_lama  uuid[] := '{}'::uuid[];                                                     -- SINKRON
BEGIN
  FOR v_kunci IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak boleh diubah lewat simpan_supplier', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF p_data ? 'bahan_baku_ids' THEN
    IF jsonb_typeof(p_data -> 'bahan_baku_ids') <> 'array' THEN
      RAISE EXCEPTION 'bahan_baku_ids harus berupa daftar' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_ids := ARRAY(SELECT (x)::uuid FROM jsonb_array_elements_text(p_data -> 'bahan_baku_ids') x);
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'bahan_baku_ids berisi id yang tidak sah' USING ERRCODE = '22023';
    END;
    IF EXISTS (SELECT 1 FROM unnest(v_ids) i WHERE NOT EXISTS (SELECT 1 FROM public.bahan_baku b WHERE b.id = i)) THEN
      RAISE EXCEPTION 'bahan_baku_ids memuat bahan yang tidak ada' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_nama := btrim(COALESCE(p_data ->> 'nama', (SELECT nama FROM public.supplier WHERE id = p_id)));
  IF COALESCE(v_nama, '') = '' THEN RAISE EXCEPTION 'Nama supplier wajib diisi' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.supplier WHERE is_active AND lower(btrim(nama)) = lower(v_nama)
                AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Sudah ada supplier aktif bernama "%"', v_nama USING ERRCODE = '23505';
  END IF;
  PERFORM set_config('app.alasan', COALESCE(p_alasan, ''), true);

  IF p_id IS NULL THEN
    INSERT INTO public.supplier (nama, kontak, alamat, kategori, catatan, termin_hari, vendor_induk_id, created_by, is_active,
                                 bahan_baku_ids)
    VALUES (v_nama, p_data ->> 'kontak', p_data ->> 'alamat', p_data ->> 'kategori', p_data ->> 'catatan',
            (p_data ->> 'termin_hari')::int, (p_data ->> 'vendor_induk_id')::uuid, v_uid, true,
            COALESCE(v_ids, '{}'::uuid[]))
    RETURNING id INTO v_id;
  ELSE                                                                                -- SINKRON: tak lagi RETURN dini
    SELECT COALESCE(bahan_baku_ids, '{}'::uuid[]) INTO v_lama FROM public.supplier WHERE id = p_id;  -- SINKRON

    UPDATE public.supplier SET
      nama            = v_nama,
      kontak          = CASE WHEN p_data ? 'kontak' THEN p_data ->> 'kontak' ELSE kontak END,
      alamat          = CASE WHEN p_data ? 'alamat' THEN p_data ->> 'alamat' ELSE alamat END,
      kategori        = CASE WHEN p_data ? 'kategori' THEN p_data ->> 'kategori' ELSE kategori END,
      catatan         = CASE WHEN p_data ? 'catatan' THEN p_data ->> 'catatan' ELSE catatan END,
      termin_hari     = CASE WHEN p_data ? 'termin_hari' THEN (p_data ->> 'termin_hari')::int ELSE termin_hari END,
      vendor_induk_id = CASE WHEN p_data ? 'vendor_induk_id' THEN (p_data ->> 'vendor_induk_id')::uuid ELSE vendor_induk_id END,
      bahan_baku_ids  = CASE WHEN p_data ? 'bahan_baku_ids' THEN v_ids ELSE bahan_baku_ids END
    WHERE id = p_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Supplier % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  END IF;

  -- SINKRON: selisih centang -> katalog harga vendor
  IF p_data ? 'bahan_baku_ids' THEN
    v_ids  := COALESCE(v_ids, '{}'::uuid[]);
    v_lama := COALESCE(v_lama, '{}'::uuid[]);

    -- dilepas: nonaktifkan
    UPDATE public.bahan_baku_supplier
       SET is_active = false, is_preferred = false, updated_by = v_uid
     WHERE supplier_id = v_id AND is_active
       AND bahan_baku_id = ANY (v_lama) AND NOT (bahan_baku_id = ANY (v_ids));

    -- baru dicentang: aktifkan kembali baris lama apa adanya
    UPDATE public.bahan_baku_supplier
       SET is_active = true, updated_by = v_uid
     WHERE supplier_id = v_id AND NOT is_active
       AND bahan_baku_id = ANY (v_ids) AND NOT (bahan_baku_id = ANY (v_lama));

    -- dicentang tapi belum punya baris: placeholder (harga 0, perlu ditinjau), satuan beli = satuan besar
    INSERT INTO public.bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga,
                                            sumber, perlu_ditinjau, is_active, updated_by)
    SELECT b.id, v_id, b.satuan, COALESCE(NULLIF(b.faktor_tampilan, 0), 1), 0, 'manual', true, true, v_uid
      FROM public.bahan_baku b
     WHERE b.id = ANY (v_ids) AND b.is_active
    ON CONFLICT (bahan_baku_id, supplier_id) DO NOTHING;
  END IF;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.nonaktifkan_harga_vendor(p_id uuid, p_alasan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sup   uuid;                                                                       -- SINKRON
  v_bahan uuid;                                                                       -- SINKRON
BEGIN
  PERFORM public._peran_master('harga');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('app.alasan', p_alasan, true);
  UPDATE public.bahan_baku_supplier SET is_active = false, is_preferred = false, updated_by = auth.uid()
   WHERE id = p_id
  RETURNING supplier_id, bahan_baku_id INTO v_sup, v_bahan;                           -- SINKRON
  IF NOT FOUND THEN RAISE EXCEPTION 'Baris katalog % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;

  -- SINKRON: lepas centang bahan ini di Master Supplier
  UPDATE public.supplier SET bahan_baku_ids = array_remove(bahan_baku_ids, v_bahan)
   WHERE id = v_sup AND v_bahan = ANY (COALESCE(bahan_baku_ids, '{}'::uuid[]));
END;
$function$;

CREATE OR REPLACE FUNCTION public.simpan_harga_vendor(p_bahan uuid, p_supplier uuid, p_harga numeric, p_satuan_beli text, p_isi_satuan_kecil numeric, p_alasan text, p_paksa boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- SINKRON: centang bahan ini di Master Supplier
  UPDATE public.supplier SET bahan_baku_ids = array_append(COALESCE(bahan_baku_ids, '{}'::uuid[]), p_bahan)
   WHERE id = p_supplier AND NOT (p_bahan = ANY (COALESCE(bahan_baku_ids, '{}'::uuid[])));

  RETURN v_id;
END;
$function$;
