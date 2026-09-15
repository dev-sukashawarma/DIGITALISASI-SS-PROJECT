-- RPC untuk mengubah vendor pada item Surat Jalan berstatus draft dan backfill draft pagi
SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.update_surat_jalan_item_vendor(
  p_item_id uuid,
  p_vendor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj_id uuid;
  v_sj_status text;
  v_bahan_id uuid;
  v_vendor_induk uuid;
  v_harga numeric;
BEGIN
  IF auth.role() != 'service_role' AND NOT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND status = 'active'
      AND role IN ('kitchen', 'admin', 'owner', 'purchasing', 'spv', 'regional_manager')
  ) THEN
    RAISE EXCEPTION 'Forbidden: tidak memiliki izin mengubah vendor surat jalan';
  END IF;

  SELECT sj.id, sj.status, sji.bahan_baku_id
    INTO v_sj_id, v_sj_status, v_bahan_id
    FROM surat_jalan_item sji
    JOIN surat_jalan sj ON sj.id = sji.surat_jalan_id
   WHERE sji.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item surat jalan tidak ditemukan';
  END IF;

  IF v_sj_status <> 'draft' THEN
    RAISE EXCEPTION 'Hanya surat jalan berstatus draft yang dapat diubah vendornya';
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

  UPDATE surat_jalan_item
     SET vendor_id = v_vendor_induk,
         harga_snapshot = COALESCE(v_harga, harga_snapshot)
   WHERE id = p_item_id;

  RETURN jsonb_build_object('success', true, 'item_id', p_item_id, 'vendor_id', v_vendor_induk);
END;
$$;

REVOKE ALL ON FUNCTION public.update_surat_jalan_item_vendor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_surat_jalan_item_vendor(uuid, uuid) TO authenticated;

-- Backfill single-vendor items pada surat jalan draft yang masih NULL
UPDATE public.surat_jalan_item sji
   SET vendor_id = (SELECT min(x::text)::uuid FROM public.vendor_bahan(sji.bahan_baku_id) x)
 WHERE sji.vendor_id IS NULL
   AND (SELECT count(*) FROM public.vendor_bahan(sji.bahan_baku_id)) = 1
   AND sji.surat_jalan_id IN (SELECT id FROM public.surat_jalan WHERE status = 'draft');

-- Backfill multi-vendor items pada 6 draft pagi (12 September 2026) dengan vendor aktif
-- 1. SAOS TOMAT POUCH -> Toko Zein
UPDATE public.surat_jalan_item sji
   SET vendor_id = 'f1e841c2-fc7f-468f-8bc9-0bb066c3a94b'
 WHERE sji.vendor_id IS NULL
   AND sji.bahan_baku_id = '08a79492-e78e-42d7-aac5-2961cd53876d'
   AND sji.surat_jalan_id IN (SELECT id FROM public.surat_jalan WHERE status = 'draft');

-- 2. SAOS SAMYANG -> Toko Zein
UPDATE public.surat_jalan_item sji
   SET vendor_id = 'f1e841c2-fc7f-468f-8bc9-0bb066c3a94b'
 WHERE sji.vendor_id IS NULL
   AND sji.bahan_baku_id = '0b03221b-d1a7-47e2-8c3f-2d2b514d1273'
   AND sji.surat_jalan_id IN (SELECT id FROM public.surat_jalan WHERE status = 'draft');

-- 3. MAYONAISE -> Toko Zein
UPDATE public.surat_jalan_item sji
   SET vendor_id = 'f1e841c2-fc7f-468f-8bc9-0bb066c3a94b'
 WHERE sji.vendor_id IS NULL
   AND sji.bahan_baku_id = 'a1c77e74-3856-405a-aea0-68cf0e5f0e91'
   AND sji.surat_jalan_id IN (SELECT id FROM public.surat_jalan WHERE status = 'draft');

-- 4. KENTANG -> PT Agro Boga Utama
UPDATE public.surat_jalan_item sji
   SET vendor_id = 'b9afa83d-3e66-4732-89a2-10999896c762'
 WHERE sji.vendor_id IS NULL
   AND sji.bahan_baku_id = 'a606d977-266a-4526-8ba6-a92b3760aff2'
   AND sji.surat_jalan_id IN (SELECT id FROM public.surat_jalan WHERE status = 'draft');

-- 5. MINYAK -> Family Suplayer
UPDATE public.surat_jalan_item sji
   SET vendor_id = '62b99037-afc7-4f0d-b54c-7593070c06b0'
 WHERE sji.vendor_id IS NULL
   AND sji.bahan_baku_id = '99483bfb-4ab0-4828-90ae-349b65999950'
   AND sji.surat_jalan_id IN (SELECT id FROM public.surat_jalan WHERE status = 'draft');

-- 6. SAPI -> Lettuce (Pak Aziz)
UPDATE public.surat_jalan_item sji
   SET vendor_id = '6645d9b3-f3e9-45d6-a95b-a01de2941807'
 WHERE sji.vendor_id IS NULL
   AND sji.bahan_baku_id = 'ea22c9f6-dd51-4965-b6b5-b67507cfd2ef'
   AND sji.surat_jalan_id IN (SELECT id FROM public.surat_jalan WHERE status = 'draft');

-- 7. FOIL -> Ekadharma International
UPDATE public.surat_jalan_item sji
   SET vendor_id = '94ccc4a9-700d-404b-a7e8-f103a382bc24'
 WHERE sji.vendor_id IS NULL
   AND sji.bahan_baku_id = '4804d1fc-f06c-4306-adfd-a798bda1275a'
   AND sji.surat_jalan_id IN (SELECT id FROM public.surat_jalan WHERE status = 'draft');

-- 8. POLYBAG -> Dunia Plastik Depok
UPDATE public.surat_jalan_item sji
   SET vendor_id = 'be0f46da-d463-449b-9a00-803de009b842'
 WHERE sji.vendor_id IS NULL
   AND sji.bahan_baku_id = '42381bbb-7edb-4327-a191-272a589316f9'
   AND sji.surat_jalan_id IN (SELECT id FROM public.surat_jalan WHERE status = 'draft');
