-- Saldo per vendor Gudang Pusat — skema. Spec: docs/superpowers/specs/2026-09-11-saldo-vendor-gudang-design.md
SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.gudang_pusat_id() RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'::uuid $$;

ALTER TABLE public.supplier ADD COLUMN IF NOT EXISTS vendor_induk_id uuid REFERENCES public.supplier(id);

CREATE OR REPLACE FUNCTION public.vendor_induk(p_supplier uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(s.vendor_induk_id, s.id) FROM public.supplier s WHERE s.id = p_supplier
$$;

CREATE OR REPLACE FUNCTION public.vendor_bahan(p_bahan uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT COALESCE(s.vendor_induk_id, s.id)
    FROM public.bahan_baku_supplier bs JOIN public.supplier s ON s.id = bs.supplier_id
   WHERE bs.bahan_baku_id = p_bahan AND bs.is_active AND COALESCE(s.is_active, true)
$$;

CREATE OR REPLACE FUNCTION public.bahan_multi_vendor(p_bahan uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.vendor_bahan(p_bahan)) >= 2
$$;

CREATE TABLE IF NOT EXISTS public.stok_vendor_gudang_mutasi (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_baku_id            uuid NOT NULL REFERENCES public.bahan_baku(id),
  vendor_id                uuid NOT NULL REFERENCES public.supplier(id),
  qty                      numeric NOT NULL,           -- skala stok Gudang Pusat, bertanda
  sumber                   text NOT NULL CHECK (sumber IN ('po','sj_kirim','hitung_fisik','koreksi')),
  ref_ledger_id            uuid,
  ref_surat_jalan_item_id  uuid REFERENCES public.surat_jalan_item(id),
  ref_opname_id            uuid REFERENCES public.opname(id),
  catatan                  text,
  dibuat_oleh              uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (sumber <> 'koreksi' OR length(btrim(coalesce(catatan,''))) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS svgm_po_unik ON public.stok_vendor_gudang_mutasi (ref_ledger_id) WHERE sumber = 'po';
CREATE UNIQUE INDEX IF NOT EXISTS svgm_sj_unik ON public.stok_vendor_gudang_mutasi (ref_surat_jalan_item_id) WHERE sumber = 'sj_kirim';
CREATE UNIQUE INDEX IF NOT EXISTS svgm_opname_unik ON public.stok_vendor_gudang_mutasi (ref_opname_id, bahan_baku_id, vendor_id) WHERE sumber = 'hitung_fisik';
CREATE INDEX IF NOT EXISTS svgm_bahan_vendor ON public.stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id);

ALTER TABLE public.stok_vendor_gudang_mutasi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS svgm_select ON public.stok_vendor_gudang_mutasi;
CREATE POLICY svgm_select ON public.stok_vendor_gudang_mutasi FOR SELECT TO authenticated
  USING (public.peran_saya() IN ('kitchen','purchasing','admin','owner','spv','regional_manager','admin_finance'));
REVOKE ALL ON public.stok_vendor_gudang_mutasi FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stok_vendor_gudang_mutasi TO authenticated;

CREATE OR REPLACE FUNCTION public.bahan_vendor_aktif(p_bahan uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stok_vendor_gudang_mutasi m WHERE m.bahan_baku_id = p_bahan AND m.sumber = 'hitung_fisik')
$$;

CREATE OR REPLACE FUNCTION public.sisa_vendor_gudang(p_bahan uuid, p_vendor uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(m.qty), 0) FROM public.stok_vendor_gudang_mutasi m
   WHERE m.bahan_baku_id = p_bahan AND m.vendor_id = p_vendor
$$;

-- Nama tampil: buang akhiran " - Tempo N" (grup Pak Aziz).
CREATE OR REPLACE FUNCTION public.saldo_vendor_gudang(p_bahan_ids uuid[])
RETURNS TABLE(bahan_baku_id uuid, vendor_id uuid, vendor_nama text, sisa numeric, multi boolean, aktif boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role','') <> 'service_role' AND current_user NOT IN ('postgres','service_role')
     AND COALESCE(public.peran_saya(),'') NOT IN ('kitchen','purchasing','admin','owner','spv','regional_manager','admin_finance') THEN
    RAISE EXCEPTION 'Tidak berhak melihat saldo vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
    SELECT b.id, v.vid, regexp_replace(s.nama, '\s*-\s*Tempo\s*\d+\s*$', '', 'i'),
           public.sisa_vendor_gudang(b.id, v.vid) / NULLIF(public.to_ledger_scale(public.gudang_pusat_id(), b.id, 1), 0),
           public.bahan_multi_vendor(b.id), public.bahan_vendor_aktif(b.id)
      FROM unnest(p_bahan_ids) AS b(id)
      CROSS JOIN LATERAL public.vendor_bahan(b.id) AS v(vid)
      JOIN public.supplier s ON s.id = v.vid
     ORDER BY b.id, s.nama;
END $$;

CREATE OR REPLACE FUNCTION public.koreksi_saldo_vendor(p_bahan uuid, p_vendor uuid, p_qty_besar numeric, p_catatan text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF COALESCE(public.peran_saya(),'') NOT IN ('kitchen','admin','owner') THEN
    RAISE EXCEPTION 'Hanya kitchen/admin/owner yang boleh mengoreksi saldo vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_catatan IS NULL OR btrim(p_catatan) = '' THEN
    RAISE EXCEPTION 'Catatan koreksi wajib' USING ERRCODE = 'check_violation';
  END IF;
  IF p_qty_besar IS NULL OR p_qty_besar = 0 THEN
    RAISE EXCEPTION 'Qty koreksi tidak boleh 0' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendor_bahan(p_bahan) v WHERE v = p_vendor) THEN
    RAISE EXCEPTION 'Vendor bukan vendor aktif bahan ini' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, catatan, dibuat_oleh)
  VALUES (p_bahan, p_vendor, public.to_ledger_scale(public.gudang_pusat_id(), p_bahan, p_qty_besar), 'koreksi', btrim(p_catatan), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.vendor_induk(uuid), public.vendor_bahan(uuid), public.bahan_multi_vendor(uuid),
  public.bahan_vendor_aktif(uuid), public.sisa_vendor_gudang(uuid,uuid), public.saldo_vendor_gudang(uuid[]),
  public.koreksi_saldo_vendor(uuid,uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_vendor_gudang(uuid[]), public.koreksi_saldo_vendor(uuid,uuid,numeric,text)
  TO authenticated, service_role;

-- Bersih-bersih data (keputusan owner K4, K7).
UPDATE public.supplier c SET vendor_induk_id = p.id
  FROM public.supplier p
 WHERE p.nama = 'Lettuce (Pak Aziz) - Tempo 10'
   AND c.nama IN ('Lettuce (Pak Aziz) - Tempo 15', 'Lettuce (Pak Aziz) - Tempo 30')
   AND c.vendor_induk_id IS DISTINCT FROM p.id;

UPDATE public.bahan_baku_supplier bs SET is_active = false
  FROM public.bahan_baku b, public.supplier s
 WHERE bs.bahan_baku_id = b.id AND bs.supplier_id = s.id
   AND b.nama = 'AYAM' AND s.nama = 'Dunia Plastik Depok' AND bs.is_active;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.supplier WHERE vendor_induk_id IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'Grup Pak Aziz tidak terbentuk tepat 2 anak';
  END IF;
END $$;
