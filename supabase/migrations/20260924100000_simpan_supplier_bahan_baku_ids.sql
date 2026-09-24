-- Tahap 2 master bahan baku (spec 2026-09-23 K2/K3):
-- 1. simpan_supplier menerima bahan_baku_ids — halaman Master Supplier menyimpannya dan
--    form PO (pembelian/new) memakainya untuk mengisi item otomatis. Tiap id wajib ada.
-- 2. View bahan_baku_harga_asal: riwayat harga master terbaru per bahan, untuk kolom
--    "asal harga" di tab Harga. security_invoker supaya RLS bbhh_select berlaku.

CREATE OR REPLACE FUNCTION public.simpan_supplier(p_id uuid, p_data jsonb, p_alasan text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_boleh constant text[] := ARRAY['nama','kontak','alamat','kategori','catatan','termin_hari','vendor_induk_id',
                                   'bahan_baku_ids'];                                  -- BARU
  v_uid   uuid := public._peran_master('harga');
  v_kunci text;
  v_nama  text;
  v_id    uuid;
  v_ids   uuid[];                                                                     -- BARU
BEGIN
  FOR v_kunci IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak boleh diubah lewat simpan_supplier', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- BARU: validasi bahan_baku_ids
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
                                 bahan_baku_ids)                                       -- BARU
    VALUES (v_nama, p_data ->> 'kontak', p_data ->> 'alamat', p_data ->> 'kategori', p_data ->> 'catatan',
            (p_data ->> 'termin_hari')::int, (p_data ->> 'vendor_induk_id')::uuid, v_uid, true,
            COALESCE(v_ids, '{}'::uuid[]))                                             -- BARU
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
    vendor_induk_id = CASE WHEN p_data ? 'vendor_induk_id' THEN (p_data ->> 'vendor_induk_id')::uuid ELSE vendor_induk_id END,
    bahan_baku_ids  = CASE WHEN p_data ? 'bahan_baku_ids' THEN v_ids ELSE bahan_baku_ids END   -- BARU
  WHERE id = p_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Supplier % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW public.bahan_baku_harga_asal WITH (security_invoker = true) AS
SELECT DISTINCT ON (h.bahan_baku_id)
       h.bahan_baku_id, h.changed_at, h.changed_by, h.catatan, h.ref_po_id, h.harga_lama, h.harga_baru
  FROM public.bahan_baku_harga_history h
 ORDER BY h.bahan_baku_id, h.changed_at DESC, h.id DESC;

REVOKE ALL ON public.bahan_baku_harga_asal FROM anon, authenticated;
GRANT SELECT ON public.bahan_baku_harga_asal TO authenticated;
