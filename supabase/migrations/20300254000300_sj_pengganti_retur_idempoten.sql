-- =============================================================================
-- verifikasi_kitchen_dan_buat_sj: idempoten, terkunci, dan sadar multi-baris
-- =============================================================================
-- Masalah versi live:
--   1. Tanpa penjaga status dan tanpa kunci baris. Setiap panggilan dengan
--      p_terbitkan_sj_sekarang=true menerbitkan SJ pengganti BARU berstatus
--      'dikirim'. Dua jalur memanggilnya (layar Retur dan modal persetujuan
--      Permintaan, di web maupun native); klik ganda, retry setelah timeout, atau
--      dua orang di dua layar -> outlet menerima dua SJ pengganti.
--   2. Item SJ diisi satu baris per retur_stok_item dengan vendor NULL. Dua item
--      retur dengan bahan yang sama akan bentrok di
--      surat_jalan_item_sj_bahan_vendor_key (NULLS NOT DISTINCT).
--
-- Perbaikan:
--   * Tiket dikunci (FOR UPDATE) sehingga panggilan serentak berjalan berurutan.
--   * Kalau SJ pengganti sudah terbit, panggilan berikutnya mengembalikan SJ yang
--     sama dengan success=true dan `sudah_diterbitkan=true` (idempoten: retry
--     aman, klien lama tetap menganggapnya berhasil).
--   * Status yang boleh diverifikasi: dalam_pengiriman, diterima_kitchen,
--     menunggu_stok (sama dengan antrean kitchen di web & native). Status lain
--     ditolak dengan pesan jelas.
--   * Item SJ diagregasi per bahan.
--   * Overload 3-argumen (lama) kini mendelegasikan ke versi 4-argumen supaya
--     tidak ada dua implementasi yang bisa menyimpang.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.verifikasi_kitchen_dan_buat_sj(
  p_retur_id uuid,
  p_items_verified jsonb,
  p_catatan text DEFAULT NULL::text,
  p_terbitkan_sj_sekarang boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role     TEXT;
  v_retur    public.retur_stok%ROWTYPE;
  v_vitem    JSONB;
  v_sj_id    UUID;
  v_sj_nomor TEXT;
BEGIN
  -- Periksa role kitchen/admin
  SELECT role INTO v_role
  FROM public.outlet_staff
  WHERE id = auth.uid();

  IF NOT (v_role IN ('kitchen', 'admin', 'owner', 'purchasing', 'admin_finance', 'developer')) THEN
    RAISE EXCEPTION 'Hanya tim Gudang Pusat (Kitchen) yang dapat memverifikasi fisik retur'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Kunci tiket: verifikasi serentak atas tiket yang sama berjalan berurutan.
  SELECT * INTO v_retur
  FROM public.retur_stok
  WHERE id = p_retur_id
  FOR UPDATE;

  IF v_retur.id IS NULL THEN
    RAISE EXCEPTION 'Tiket retur tidak ditemukan' USING ERRCODE = 'data_exception';
  END IF;

  -- Idempoten: SJ pengganti sudah terbit -> kembalikan yang sama, jangan buat lagi.
  IF v_retur.ref_surat_jalan_pengganti_id IS NOT NULL THEN
    SELECT sj.document_number INTO v_sj_nomor
    FROM public.surat_jalan sj
    WHERE sj.id = v_retur.ref_surat_jalan_pengganti_id;

    RETURN jsonb_build_object(
      'success', true,
      'retur_id', p_retur_id,
      'status', v_retur.status,
      'surat_jalan_id', v_retur.ref_surat_jalan_pengganti_id,
      'nomor_surat_jalan', v_sj_nomor,
      'sudah_diterbitkan', true
    );
  END IF;

  IF v_retur.status NOT IN ('dalam_pengiriman', 'diterima_kitchen', 'menunggu_stok') THEN
    RAISE EXCEPTION 'Retur % berstatus %, tidak bisa diverifikasi Gudang Pusat',
      v_retur.nomor_retur, v_retur.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Update kuantitas verifikasi timbang kitchen jika ada payload
  IF p_items_verified IS NOT NULL AND jsonb_array_length(p_items_verified) > 0 THEN
    FOR v_vitem IN SELECT * FROM jsonb_array_elements(p_items_verified)
    LOOP
      UPDATE public.retur_stok_item
      SET qty_diterima_kitchen = (v_vitem->>'qty_diterima_kitchen')::NUMERIC
      WHERE id = (v_vitem->>'id')::UUID AND retur_stok_id = p_retur_id;
    END LOOP;
  END IF;

  -- OPSI 2: Simpan Verifikasi Fisik Saja (Kirim nanti / gabung jadwal berikutnya)
  IF p_terbitkan_sj_sekarang IS NOT TRUE THEN
    UPDATE public.retur_stok
    SET
      status = 'diterima_kitchen',
      verified_by_kitchen = auth.uid(),
      verified_kitchen_at = NOW(),
      catatan_kitchen = p_catatan,
      updated_at = NOW()
    WHERE id = p_retur_id;

    RETURN jsonb_build_object(
      'success', true,
      'retur_id', p_retur_id,
      'status', 'diterima_kitchen'
    );
  END IF;

  -- OPSI 1: Terbitkan SJ Pengganti Sekarang
  v_sj_nomor := public.generate_surat_jalan_number(v_retur.outlet_id);

  INSERT INTO public.surat_jalan (
    document_number,
    outlet_id,
    created_by,
    status,
    notes,
    signatures,
    is_retur_replacement,
    ref_retur_id
  ) VALUES (
    v_sj_nomor,
    v_retur.outlet_id,
    COALESCE(auth.uid(), v_retur.created_by),
    'dikirim',
    'Surat Jalan Pengganti Retur ' || v_retur.nomor_retur || COALESCE(' — ' || p_catatan, ''),
    '[]'::jsonb,
    TRUE,
    p_retur_id
  ) RETURNING id INTO v_sj_id;

  -- Satu baris per bahan (grain surat_jalan_item = SJ, bahan, vendor; vendor NULL).
  INSERT INTO public.surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim, qty_terima)
  SELECT v_sj_id,
         i.bahan_baku_id,
         SUM(COALESCE(i.qty_diterima_kitchen, i.qty_klaim)),
         NULL
  FROM public.retur_stok_item i
  WHERE i.retur_stok_id = p_retur_id
  GROUP BY i.bahan_baku_id;

  UPDATE public.retur_stok
  SET
    status = 'dikirim_pengganti',
    verified_by_kitchen = auth.uid(),
    verified_kitchen_at = NOW(),
    catatan_kitchen = p_catatan,
    ref_surat_jalan_pengganti_id = v_sj_id,
    updated_at = NOW()
  WHERE id = p_retur_id;

  RETURN jsonb_build_object(
    'success', true,
    'retur_id', p_retur_id,
    'status', 'dikirim_pengganti',
    'surat_jalan_id', v_sj_id,
    'nomor_surat_jalan', v_sj_nomor
  );
END;
$function$;

-- Overload lama (3 argumen) = selalu terbitkan sekarang. Didelegasikan agar satu sumber logika.
CREATE OR REPLACE FUNCTION public.verifikasi_kitchen_dan_buat_sj(
  p_retur_id uuid,
  p_items_verified jsonb,
  p_catatan text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.verifikasi_kitchen_dan_buat_sj(p_retur_id, p_items_verified, p_catatan, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.verifikasi_kitchen_dan_buat_sj(uuid, jsonb, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verifikasi_kitchen_dan_buat_sj(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verifikasi_kitchen_dan_buat_sj(uuid, jsonb, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verifikasi_kitchen_dan_buat_sj(uuid, jsonb, text) TO authenticated, service_role;
