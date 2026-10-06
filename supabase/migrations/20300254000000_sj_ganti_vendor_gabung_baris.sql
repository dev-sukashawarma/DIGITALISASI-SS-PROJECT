-- =============================================================================
-- Ganti vendor item surat jalan: gabung baris, jangan bentrok
-- =============================================================================
-- Satu bahan boleh dikirim dari beberapa vendor dalam satu SJ (keputusan bisnis):
-- grain baris `surat_jalan_item` adalah (SJ, bahan, vendor), dijaga
-- `surat_jalan_item_sj_bahan_vendor_key`.
--
-- Versi lama hanya `UPDATE ... SET vendor_id` pada satu baris. Kalau bahan sudah
-- dipecah ke vendor A dan B lalu baris A diganti ke B, hasilnya dua baris
-- (SJ, bahan, B) -> 23505 dan pengguna hanya melihat galat mentah.
--
-- Sekarang: kalau sudah ada baris saudara dengan bahan & vendor tujuan yang sama,
-- qty digabung ke baris itu dan baris asal dihapus. Satu (bahan, vendor) = satu
-- baris, selalu. Klien web & native sudah memuat ulang detail setelah RPC ini,
-- jadi baris yang hilang karena digabung langsung tercermin.
--
-- Konkurensi: header SJ dikunci (FOR UPDATE) sebelum baris item disentuh, dengan
-- urutan kunci yang sama seperti finalize_surat_jalan_and_ledger (SJ -> item),
-- sehingga dua penggantian vendor serentak pada SJ yang sama berjalan berurutan.
--
-- Kontrak balikan tetap kompatibel ({success, item_id, vendor_id}) + dua kunci
-- baru: `digabung` dan `item_dihapus`.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_surat_jalan_item_vendor(p_item_id uuid, p_vendor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sj_id        uuid;
  v_sj_status    text;
  v_bahan_id     uuid;
  v_qty          numeric;
  v_catatan      text;
  v_vendor_induk uuid;
  v_harga        numeric;
  v_saudara      uuid;
BEGIN
  IF auth.role() != 'service_role' AND NOT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND status = 'active'
      AND role IN ('kitchen', 'admin', 'owner', 'purchasing', 'spv', 'regional_manager')
  ) THEN
    RAISE EXCEPTION 'Forbidden: tidak memiliki izin mengubah vendor surat jalan';
  END IF;

  SELECT sji.surat_jalan_id INTO v_sj_id
    FROM surat_jalan_item sji
   WHERE sji.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item surat jalan tidak ditemukan';
  END IF;

  -- Kunci header dulu: semua perubahan baris SJ ini berjalan berurutan.
  SELECT sj.status INTO v_sj_status
    FROM surat_jalan sj
   WHERE sj.id = v_sj_id
     FOR UPDATE;

  IF v_sj_status <> 'draft' THEN
    RAISE EXCEPTION 'Hanya surat jalan berstatus draft yang dapat diubah vendornya';
  END IF;

  -- Baca ulang setelah kunci: baris ini bisa saja baru digabung oleh panggilan lain.
  SELECT sji.bahan_baku_id, sji.qty_dikirim, sji.catatan
    INTO v_bahan_id, v_qty, v_catatan
    FROM surat_jalan_item sji
   WHERE sji.id = p_item_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item surat jalan sudah digabung dengan baris lain, muat ulang halaman';
  END IF;

  v_vendor_induk := public.vendor_induk(p_vendor_id);

  SELECT bs.harga INTO v_harga
    FROM public.bahan_baku_supplier bs
    JOIN public.supplier s ON s.id = bs.supplier_id
   WHERE bs.bahan_baku_id = v_bahan_id
     AND bs.is_active AND bs.harga > 0
     AND COALESCE(s.vendor_induk_id, s.id) = v_vendor_induk
   ORDER BY bs.harga_updated_at DESC NULLS LAST, bs.id
   LIMIT 1;

  SELECT sji.id INTO v_saudara
    FROM surat_jalan_item sji
   WHERE sji.surat_jalan_id = v_sj_id
     AND sji.bahan_baku_id  = v_bahan_id
     AND sji.vendor_id IS NOT DISTINCT FROM v_vendor_induk
     AND sji.id <> p_item_id
     FOR UPDATE;

  IF v_saudara IS NULL THEN
    UPDATE surat_jalan_item
       SET vendor_id      = v_vendor_induk,
           harga_snapshot = COALESCE(v_harga, harga_snapshot)
     WHERE id = p_item_id;

    RETURN jsonb_build_object(
      'success', true, 'item_id', p_item_id, 'vendor_id', v_vendor_induk, 'digabung', false);
  END IF;

  -- Bahan & vendor yang sama sudah punya baris: gabungkan, jangan gandakan.
  UPDATE surat_jalan_item
     SET qty_dikirim    = COALESCE(qty_dikirim, 0) + COALESCE(v_qty, 0),
         harga_snapshot = COALESCE(v_harga, harga_snapshot),
         catatan        = NULLIF(concat_ws('; ', NULLIF(btrim(catatan), ''), NULLIF(btrim(v_catatan), '')), '')
   WHERE id = v_saudara;

  DELETE FROM surat_jalan_item WHERE id = p_item_id;

  RETURN jsonb_build_object(
    'success', true, 'item_id', v_saudara, 'vendor_id', v_vendor_induk,
    'digabung', true, 'item_dihapus', p_item_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_surat_jalan_item_vendor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_surat_jalan_item_vendor(uuid, uuid) TO authenticated;
