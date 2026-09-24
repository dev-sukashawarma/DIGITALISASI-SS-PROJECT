-- supabase/migrations/20260923184500_rpc_master_bahan_data_perbaikan.sql
-- Perbaikan review Task 5 atas 20260923184000 (sudah applied & terstempel, tidak disunting).
-- Badan fungsi di bawah = versi live (md5 prosrc dicocokkan dengan berkas 20260923184000)
-- ditambah dua perubahan:
--  1. simpan_bahan_baku: setelah satuan berubah, baris bahan_baku_harga disamakan dulu
--     (kemasan_qty/kemasan_satuan lewat trg_bbh_00_samakan_kemasan) sebelum
--     turunkan_harga_master. Sebelumnya kemasan_qty basi bila tak ada katalog terpercaya
--     atau harga turunan tak bergeser — invarian K4 patah, valuasi meleset sebesar rasio isi.
--  2. simpan_sku: tolak p_data bukan objek; validasi nama_kemasan/qty_isi/harga_beli juga
--     berlaku saat UPDATE (dulu hanya INSERT).
-- CREATE OR REPLACE mempertahankan GRANT/REVOKE dari 20260923184000.

CREATE OR REPLACE FUNCTION public.simpan_bahan_baku(p_id uuid, p_data jsonb, p_alasan text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_boleh  constant text[] := ARRAY['nama','merek','kategori','peruntukan','is_opname','default_reorder_point',
    'satuan','satuan_tengah','faktor_tengah','satuan_kecil','isi_kecil_per_tengah','satuan_po','satuan_distribusi',
    'image_url','image_url_tengah','image_url_kecil','image_urls'];
  c_satuan constant text[] := ARRAY['satuan','satuan_tengah','faktor_tengah','satuan_kecil','isi_kecil_per_tengah'];
  v_kunci    text;
  v_lama     public.bahan_baku%ROWTYPE;
  v_id       uuid;
  v_nama     text;
  v_satuan   text;
  v_tengah   text;
  v_ft       numeric;
  v_kecil    text;
  v_isi      numeric;
  v_tampilan numeric;
BEGIN
  PERFORM public._peran_master('data');
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'p_data harus objek JSON' USING ERRCODE = '22023';
  END IF;
  FOR v_kunci IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak boleh diubah lewat simpan_bahan_baku', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;
  PERFORM set_config('app.alasan', COALESCE(p_alasan, ''), true);

  IF p_id IS NOT NULL THEN
    SELECT * INTO v_lama FROM public.bahan_baku WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  END IF;

  -- Nama unik di antara bahan aktif (beda huruf/spasi dianggap sama).
  v_nama := btrim(COALESCE(p_data ->> 'nama', v_lama.nama));
  IF COALESCE(v_nama, '') = '' THEN RAISE EXCEPTION 'Nama bahan wajib diisi' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.bahan_baku
              WHERE is_active AND lower(btrim(nama)) = lower(v_nama)
                AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Sudah ada bahan aktif bernama "%"', v_nama USING ERRCODE = '23505';
  END IF;

  -- Satuan dikirim sebagai satu set; semantik = turunkanFaktorSatuan() (satuanBahan.ts).
  IF p_data ?| c_satuan OR p_id IS NULL THEN
    IF NOT (p_data ? 'satuan' AND p_data ? 'isi_kecil_per_tengah') THEN
      RAISE EXCEPTION 'Satuan dikirim sebagai satu set: satuan dan isi_kecil_per_tengah wajib ada' USING ERRCODE = '22023';
    END IF;
    v_satuan := btrim(p_data ->> 'satuan');
    v_tengah := NULLIF(btrim(p_data ->> 'satuan_tengah'), '');
    v_ft     := NULLIF(p_data ->> 'faktor_tengah', '')::numeric;
    v_kecil  := NULLIF(btrim(p_data ->> 'satuan_kecil'), '');
    v_isi    := NULLIF(p_data ->> 'isi_kecil_per_tengah', '')::numeric;
    IF COALESCE(v_satuan, '') = '' THEN RAISE EXCEPTION 'Satuan besar wajib diisi' USING ERRCODE = '22023'; END IF;

    IF v_tengah IS NULL OR (lower(v_tengah) = lower(v_satuan) AND COALESCE(v_ft, 1) = 1) THEN
      v_tengah := NULL; v_ft := NULL; v_tampilan := v_isi;
    ELSE
      v_tampilan := v_ft * v_isi;
    END IF;
    IF v_kecil IS NULL THEN
      v_tampilan := NULL;
    END IF;

    IF p_id IS NOT NULL AND public._bahan_punya_riwayat_stok(p_id) AND (
         v_satuan   IS DISTINCT FROM v_lama.satuan
      OR v_tengah   IS DISTINCT FROM v_lama.satuan_tengah
      OR v_ft       IS DISTINCT FROM v_lama.faktor_tengah
      OR v_kecil    IS DISTINCT FROM v_lama.satuan_kecil
      OR v_tampilan IS DISTINCT FROM v_lama.faktor_tampilan) THEN
      RAISE EXCEPTION 'Bahan "%" sudah punya riwayat stok; satuannya hanya bisa diubah lewat Ganti Satuan', v_lama.nama;
    END IF;
  ELSE
    v_satuan := v_lama.satuan; v_tengah := v_lama.satuan_tengah; v_ft := v_lama.faktor_tengah;
    v_kecil := v_lama.satuan_kecil; v_tampilan := v_lama.faktor_tampilan;
  END IF;

  IF p_id IS NULL THEN
    IF COALESCE(btrim(p_data ->> 'kategori'), '') = '' THEN
      RAISE EXCEPTION 'Kategori wajib diisi' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.bahan_baku (
      nama, merek, kategori, peruntukan, is_opname, default_reorder_point,
      satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan,
      satuan_po, satuan_distribusi, image_url, image_url_tengah, image_url_kecil, image_urls,
      is_active, is_fisik_checked)
    VALUES (
      v_nama, p_data ->> 'merek', btrim(p_data ->> 'kategori'),
      COALESCE(p_data ->> 'peruntukan', 'outlet'),
      COALESCE((p_data ->> 'is_opname')::boolean, true),
      COALESCE((p_data ->> 'default_reorder_point')::numeric, 0),
      v_satuan, v_tengah, v_ft, v_kecil, v_tampilan,
      p_data ->> 'satuan_po', p_data ->> 'satuan_distribusi',
      p_data ->> 'image_url', p_data ->> 'image_url_tengah', p_data ->> 'image_url_kecil',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_data -> 'image_urls')), '{}'::text[]),
      true, false)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.bahan_baku SET
    nama                  = v_nama,
    merek                 = CASE WHEN p_data ? 'merek' THEN p_data ->> 'merek' ELSE merek END,
    kategori              = CASE WHEN p_data ? 'kategori' THEN btrim(p_data ->> 'kategori') ELSE kategori END,
    peruntukan            = CASE WHEN p_data ? 'peruntukan' THEN p_data ->> 'peruntukan' ELSE peruntukan END,
    is_opname             = CASE WHEN p_data ? 'is_opname' THEN (p_data ->> 'is_opname')::boolean ELSE is_opname END,
    default_reorder_point = CASE WHEN p_data ? 'default_reorder_point'
                                 THEN (p_data ->> 'default_reorder_point')::numeric ELSE default_reorder_point END,
    satuan = v_satuan, satuan_tengah = v_tengah, faktor_tengah = v_ft,
    satuan_kecil = v_kecil, faktor_tampilan = v_tampilan,
    satuan_po             = CASE WHEN p_data ? 'satuan_po' THEN p_data ->> 'satuan_po' ELSE satuan_po END,
    satuan_distribusi     = CASE WHEN p_data ? 'satuan_distribusi' THEN p_data ->> 'satuan_distribusi' ELSE satuan_distribusi END,
    image_url             = CASE WHEN p_data ? 'image_url' THEN p_data ->> 'image_url' ELSE image_url END,
    image_url_tengah      = CASE WHEN p_data ? 'image_url_tengah' THEN p_data ->> 'image_url_tengah' ELSE image_url_tengah END,
    image_url_kecil       = CASE WHEN p_data ? 'image_url_kecil' THEN p_data ->> 'image_url_kecil' ELSE image_url_kecil END,
    image_urls            = CASE WHEN p_data ? 'image_urls'
                                 THEN COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_data -> 'image_urls')), '{}'::text[])
                                 ELSE image_urls END
  WHERE id = p_id;
  -- Satuan berubah (hanya mungkin untuk bahan tanpa riwayat stok): samakan dulu baris harga
  -- master — trg_bbh_00_samakan_kemasan menulis ulang kemasan_qty/kemasan_satuan dari bahan
  -- (invarian K4: kemasan_qty = COALESCE(faktor_tampilan, 1)) — baru turunkan ulang harga dari
  -- katalog terpercaya, karena turunannya bergantung faktor_tampilan.
  IF v_satuan   IS DISTINCT FROM v_lama.satuan
     OR v_tengah   IS DISTINCT FROM v_lama.satuan_tengah
     OR v_ft       IS DISTINCT FROM v_lama.faktor_tengah
     OR v_kecil    IS DISTINCT FROM v_lama.satuan_kecil
     OR v_tampilan IS DISTINCT FROM v_lama.faktor_tampilan THEN
    UPDATE public.bahan_baku_harga SET kemasan_qty = kemasan_qty WHERE bahan_baku_id = p_id;
    PERFORM public.turunkan_harga_master(p_id);
  END IF;
  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.simpan_sku(p_id uuid, p_bahan_baku_id uuid, p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_boleh constant text[] := ARRAY['nama_kemasan','qty_isi','harga_beli','tingkatan_satuan','image_url',
                                   'satuan_tengah','faktor_tengah','is_active'];
  v_kunci text;
  v_id    uuid;
  v_num   numeric;
BEGIN
  PERFORM public._peran_master('data');
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'p_data harus objek JSON' USING ERRCODE = '22023';
  END IF;
  FOR v_kunci IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak boleh diubah lewat simpan_sku', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Nilai yang dikirim divalidasi untuk INSERT maupun UPDATE (NaN lolos '> 0' di Postgres).
  IF p_data ? 'nama_kemasan' AND COALESCE(btrim(p_data ->> 'nama_kemasan'), '') = '' THEN
    RAISE EXCEPTION 'nama_kemasan tidak boleh kosong' USING ERRCODE = '22023';
  END IF;
  IF p_data ? 'qty_isi' THEN
    v_num := NULLIF(p_data ->> 'qty_isi', '')::numeric;
    IF v_num IS NULL OR v_num <= 0 OR v_num = 'NaN'::numeric THEN
      RAISE EXCEPTION 'qty_isi harus > 0' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_data ? 'harga_beli' THEN
    v_num := NULLIF(p_data ->> 'harga_beli', '')::numeric;
    IF v_num IS NULL OR v_num < 0 OR v_num = 'NaN'::numeric THEN
      RAISE EXCEPTION 'harga_beli harus >= 0' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_id IS NULL THEN
    IF COALESCE(btrim(p_data ->> 'nama_kemasan'), '') = '' OR COALESCE((p_data ->> 'qty_isi')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'nama_kemasan dan qty_isi (> 0) wajib diisi' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.bahan_baku_sku (bahan_baku_id, nama_kemasan, qty_isi, harga_beli, tingkatan_satuan,
                                       image_url, satuan_tengah, faktor_tengah, is_active, is_default)
    VALUES (p_bahan_baku_id, btrim(p_data ->> 'nama_kemasan'), (p_data ->> 'qty_isi')::numeric,
            COALESCE((p_data ->> 'harga_beli')::numeric, 0), p_data ->> 'tingkatan_satuan',
            p_data ->> 'image_url', p_data ->> 'satuan_tengah', (p_data ->> 'faktor_tengah')::numeric,
            COALESCE((p_data ->> 'is_active')::boolean, true), false)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.bahan_baku_sku SET
    nama_kemasan     = CASE WHEN p_data ? 'nama_kemasan' THEN btrim(p_data ->> 'nama_kemasan') ELSE nama_kemasan END,
    qty_isi          = CASE WHEN p_data ? 'qty_isi' THEN (p_data ->> 'qty_isi')::numeric ELSE qty_isi END,
    harga_beli       = CASE WHEN p_data ? 'harga_beli' THEN (p_data ->> 'harga_beli')::numeric ELSE harga_beli END,
    tingkatan_satuan = CASE WHEN p_data ? 'tingkatan_satuan' THEN p_data ->> 'tingkatan_satuan' ELSE tingkatan_satuan END,
    image_url        = CASE WHEN p_data ? 'image_url' THEN p_data ->> 'image_url' ELSE image_url END,
    satuan_tengah    = CASE WHEN p_data ? 'satuan_tengah' THEN p_data ->> 'satuan_tengah' ELSE satuan_tengah END,
    faktor_tengah    = CASE WHEN p_data ? 'faktor_tengah' THEN (p_data ->> 'faktor_tengah')::numeric ELSE faktor_tengah END,
    is_active        = CASE WHEN p_data ? 'is_active' THEN (p_data ->> 'is_active')::boolean ELSE is_active END
  WHERE id = p_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'SKU % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  RETURN v_id;
END;
$$;
