-- supabase/migrations/20260923184000_rpc_master_bahan_data.sql
-- Spec 2026-09-23 K1/K4/K7/K8/K10: satu-satunya jalur tulis data bahan & SKU untuk layar
-- Tahap 2. Cek peran di DALAM fungsi (_peran_master), alasan dicatat ke audit.
--
-- Beda dari plan (dicatat di task-5-report.md):
--  1. nonaktifkan_bahan_baku: kolom nama outlet = outlets.name (outlets tidak punya kolom nama).
--  2. simpan_bahan_baku: bila isi satuan (faktor_tampilan) berubah — hanya mungkin untuk bahan
--     tanpa riwayat stok — harga master diturunkan ulang (turunkan_harga_master) karena
--     turunannya = harga / isi_satuan_kecil x faktor_tampilan (keputusan controller Task 4).

CREATE OR REPLACE FUNCTION public._bahan_punya_riwayat_stok(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.ledger_stok WHERE bahan_baku_id = p_id)
      OR EXISTS (SELECT 1 FROM public.stok_balance WHERE bahan_baku_id = p_id AND saldo <> 0);
$$;
REVOKE ALL ON FUNCTION public._bahan_punya_riwayat_stok(uuid) FROM PUBLIC, anon, authenticated;

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
  -- Turunan harga master bergantung faktor_tampilan; jangan biarkan basi setelah isi berubah.
  IF v_tampilan IS DISTINCT FROM v_lama.faktor_tampilan THEN
    PERFORM public.turunkan_harga_master(p_id);
  END IF;
  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.nonaktifkan_bahan_baku(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_halang text[] := '{}';
  v_teks   text;
  v_n      int;
BEGIN
  PERFORM public._peran_master('data');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.bahan_baku WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;

  -- trg_process_bom_stok tidak menyaring is_active: bahan di resep aktif tetap dipotong.
  SELECT string_agg(DISTINCT r.nama, ', ') INTO v_teks
    FROM public.resep_item ri JOIN public.resep r ON r.id = ri.resep_id
   WHERE ri.bahan_baku_id = p_id AND r.is_active;
  IF v_teks IS NOT NULL THEN v_halang := v_halang || ('masih dipakai resep aktif: ' || v_teks); END IF;

  SELECT count(*) INTO v_n FROM public.surat_jalan_item si JOIN public.surat_jalan s ON s.id = si.surat_jalan_id
   WHERE si.bahan_baku_id = p_id AND s.status IN ('draft', 'dikirim');
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris surat jalan draft/dikirim'); END IF;

  SELECT count(*) INTO v_n FROM public.purchase_order_item pi JOIN public.purchase_order p ON p.id = pi.purchase_order_id
   WHERE pi.bahan_baku_id = p_id AND p.status NOT IN ('diterima_lengkap', 'dibatalkan');
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris PO terbuka'); END IF;

  SELECT count(*) INTO v_n FROM public.permintaan_bahan_item pi JOIN public.permintaan_bahan p ON p.id = pi.permintaan_id
   WHERE pi.bahan_baku_id = p_id AND p.status = 'menunggu';
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris permintaan menunggu'); END IF;

  SELECT count(*) INTO v_n FROM public.opname_item oi JOIN public.opname o ON o.id = oi.opname_id
   WHERE oi.bahan_baku_id = p_id AND o.status = 'draft';
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris draft opname'); END IF;

  SELECT string_agg(o.name, ', ') INTO v_teks
    FROM public.stok_balance sb JOIN public.outlets o ON o.id = sb.outlet_id
   WHERE sb.bahan_baku_id = p_id AND sb.saldo <> 0;
  IF v_teks IS NOT NULL THEN v_halang := v_halang || ('saldo belum nol di: ' || v_teks); END IF;

  IF array_length(v_halang, 1) > 0 THEN
    RAISE EXCEPTION 'Tidak bisa dinonaktifkan — %', array_to_string(v_halang, '; ');
  END IF;

  PERFORM set_config('app.alasan', p_alasan, true);
  UPDATE public.bahan_baku SET is_active = false WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.aktifkan_bahan_baku(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_nama text;
BEGIN
  PERFORM public._peran_master('data');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  SELECT nama INTO v_nama FROM public.bahan_baku WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.bahan_baku WHERE is_active AND id <> p_id
                AND lower(btrim(nama)) = lower(btrim(v_nama))) THEN
    RAISE EXCEPTION 'Sudah ada bahan aktif bernama "%"', v_nama USING ERRCODE = '23505';
  END IF;
  PERFORM set_config('app.alasan', p_alasan, true);
  UPDATE public.bahan_baku SET is_active = true WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.hapus_bahan_baku(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        record;
  v_n      bigint;
  v_halang text[] := '{}';
BEGIN
  PERFORM public._peran_master('data');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.bahan_baku WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;

  -- Semua tabel yang merujuk bahan_baku, kecuali lampiran milik bahan itu sendiri.
  -- Dibaca dari katalog supaya tabel perujuk baru otomatis ikut dijaga.
  FOR r IN
    SELECT c.conrelid::regclass AS tabel, a.attname AS kolom
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.confrelid = 'public.bahan_baku'::regclass AND c.contype = 'f'
       AND c.conrelid NOT IN ('public.bahan_baku_harga'::regclass, 'public.bahan_baku_harga_history'::regclass,
                              'public.bahan_baku_sku'::regclass, 'public.stok_balance'::regclass,
                              'public.outlet_reorder_point'::regclass)
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tabel, r.kolom) INTO v_n USING p_id;
    IF v_n > 0 THEN v_halang := v_halang || format('%s (%s baris)', r.tabel, v_n); END IF;
  END LOOP;
  SELECT count(*) INTO v_n FROM public.stok_balance WHERE bahan_baku_id = p_id AND saldo <> 0;
  IF v_n > 0 THEN v_halang := v_halang || format('stok_balance bersaldo (%s baris)', v_n); END IF;

  IF array_length(v_halang, 1) > 0 THEN
    RAISE EXCEPTION 'Bahan sudah pernah dipakai, tidak bisa dihapus (nonaktifkan saja) — %', array_to_string(v_halang, '; ');
  END IF;

  PERFORM set_config('app.alasan', p_alasan, true);
  DELETE FROM public.bahan_baku WHERE id = p_id;
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
BEGIN
  PERFORM public._peran_master('data');
  FOR v_kunci IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak boleh diubah lewat simpan_sku', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;

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

CREATE OR REPLACE FUNCTION public.set_default_sku(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_bahan uuid;
BEGIN
  PERFORM public._peran_master('data');
  SELECT bahan_baku_id INTO v_bahan FROM public.bahan_baku_sku WHERE id = p_id;
  IF v_bahan IS NULL THEN RAISE EXCEPTION 'SKU % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  UPDATE public.bahan_baku_sku SET is_default = (id = p_id) WHERE bahan_baku_id = v_bahan;
END;
$$;

CREATE OR REPLACE FUNCTION public.hapus_sku(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._peran_master('data');
  DELETE FROM public.bahan_baku_sku WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SKU % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_bahan_baku(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nonaktifkan_bahan_baku(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aktifkan_bahan_baku(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hapus_bahan_baku(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simpan_sku(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_default_sku(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hapus_sku(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simpan_bahan_baku(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nonaktifkan_bahan_baku(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aktifkan_bahan_baku(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hapus_bahan_baku(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simpan_sku(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_sku(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hapus_sku(uuid) TO authenticated;
