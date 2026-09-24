-- supabase/migrations/20260923183000_harga_master_turunan.sql
-- Spec 2026-09-23 K5/K6: harga hanya diketik per vendor; harga master dihitung =
-- harga vendor TERPERCAYA yang paling baru diperbarui, dikonversi ke satuan besar.
-- Bila tak ada vendor terpercaya, master DIBEKUKAN di nilai terakhirnya.
-- bahan_baku_harga tetap tabel sungguhan (16 pembaca tak diubah); kini ditulis sistem.
-- Jalur lama (verifikasi_terima_po, sahkan_nota_vendor) tetap menulis master
-- langsung; nilainya sama dengan turunan karena keduanya juga menulis katalog.
-- Migration ini TIDAK menulis ulang harga master yang sudah ada: trigger hanya
-- menyala saat katalog/supplier berubah.

CREATE OR REPLACE FUNCTION public.bbs_isi_harga_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.harga_updated_at := COALESCE(NEW.harga_updated_at, now());
  ELSIF NEW.harga IS DISTINCT FROM OLD.harga
        AND NEW.harga_updated_at IS NOT DISTINCT FROM OLD.harga_updated_at THEN
    NEW.harga_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bbs_00_harga_updated_at ON public.bahan_baku_supplier;
CREATE TRIGGER trg_bbs_00_harga_updated_at BEFORE INSERT OR UPDATE ON public.bahan_baku_supplier
  FOR EACH ROW EXECUTE FUNCTION public.bbs_isi_harga_updated_at();

-- INVOKER: RLS katalog vendor berlaku bagi pemanggil (crew tak boleh melihat harga vendor).
CREATE OR REPLACE FUNCTION public.harga_vendor_terpercaya(p_bahan uuid)
RETURNS TABLE (supplier_id uuid, harga_per_besar numeric, harga_updated_at timestamptz, sumber text, ref_po_id uuid)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.supplier_id,
         s.harga / s.isi_satuan_kecil * COALESCE(b.faktor_tampilan, 1),
         s.harga_updated_at, s.sumber, s.ref_po_id
    FROM public.bahan_baku_supplier s
    JOIN public.bahan_baku b ON b.id = s.bahan_baku_id
    JOIN public.supplier  sp ON sp.id = s.supplier_id
   WHERE s.bahan_baku_id = p_bahan
     AND s.is_active AND sp.is_active
     AND NOT s.perlu_ditinjau
     AND s.harga > 0 AND s.harga <> 'NaN'::numeric
     AND s.isi_satuan_kecil > 0 AND s.isi_satuan_kecil <> 'NaN'::numeric
   ORDER BY s.harga_updated_at DESC NULLS LAST, s.updated_at DESC, s.id DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.harga_vendor_terpercaya(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.harga_vendor_terpercaya(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.turunkan_harga_master(p_bahan uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       record;
  v_lama  numeric;
  v_baru  numeric;
  v_nama  text;
BEGIN
  SELECT * INTO r FROM public.harga_vendor_terpercaya(p_bahan);
  IF NOT FOUND THEN
    RETURN NULL;   -- K6: dibekukan
  END IF;

  v_baru := round(r.harga_per_besar, 4);
  SELECT harga_beli INTO v_lama FROM public.bahan_baku_harga WHERE bahan_baku_id = p_bahan;
  IF v_lama IS NOT NULL AND abs(v_lama - v_baru) < 0.01 THEN
    RETURN v_lama;
  END IF;

  SELECT nama INTO v_nama FROM public.supplier WHERE id = r.supplier_id;
  INSERT INTO public.bahan_baku_harga (bahan_baku_id, harga_beli, harga_updated_at, updated_by)
  VALUES (p_bahan, v_baru, now(), auth.uid())
  ON CONFLICT (bahan_baku_id) DO UPDATE
     SET harga_beli = EXCLUDED.harga_beli,
         harga_updated_at = EXCLUDED.harga_updated_at,
         updated_by = EXCLUDED.updated_by;

  INSERT INTO public.bahan_baku_harga_history (bahan_baku_id, harga_lama, harga_baru, ref_po_id, catatan, changed_by)
  VALUES (p_bahan, v_lama, v_baru, r.ref_po_id,
          'Turunan harga vendor ' || COALESCE(v_nama, '?') || ' (sumber ' || COALESCE(r.sumber, '?') || ')'
            || COALESCE(' — ' || NULLIF(current_setting('app.alasan', true), ''), ''),
          auth.uid());
  RETURN v_baru;
END;
$$;
REVOKE ALL ON FUNCTION public.turunkan_harga_master(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bbs_picu_turunan_harga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.turunkan_harga_master(COALESCE(NEW.bahan_baku_id, OLD.bahan_baku_id));
  IF TG_OP = 'UPDATE' AND NEW.bahan_baku_id IS DISTINCT FROM OLD.bahan_baku_id THEN
    PERFORM public.turunkan_harga_master(OLD.bahan_baku_id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.bbs_picu_turunan_harga() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bbs_turunkan_harga_master ON public.bahan_baku_supplier;
CREATE TRIGGER trg_bbs_turunkan_harga_master AFTER INSERT OR UPDATE OR DELETE ON public.bahan_baku_supplier
  FOR EACH ROW EXECUTE FUNCTION public.bbs_picu_turunan_harga();

-- Supplier aktif/nonaktif mengubah siapa yang terpercaya.
CREATE OR REPLACE FUNCTION public.supplier_picu_turunan_harga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    PERFORM public.turunkan_harga_master(s.bahan_baku_id)
       FROM public.bahan_baku_supplier s WHERE s.supplier_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_picu_turunan_harga() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_supplier_turunkan_harga_master ON public.supplier;
CREATE TRIGGER trg_supplier_turunkan_harga_master AFTER UPDATE OF is_active ON public.supplier
  FOR EACH ROW EXECUTE FUNCTION public.supplier_picu_turunan_harga();

-- K5: tempat harga untuk bahan tanpa vendor / dibeli tunai.
-- kategori 'lainnya' (bukan 'internal' seperti draf plan): supplier_kategori_check
-- hanya mengizinkan protein/sayur/bumbu/saus/kemasan/minuman/gas/lainnya.
INSERT INTO public.supplier (nama, kategori, catatan, termin_hari, is_active)
SELECT 'Beli Tunai / Tanpa Vendor', 'lainnya',
       'Harga bahan yang dibeli tunai atau belum punya vendor tetap (spec 2026-09-23 K5).', 0, true
 WHERE NOT EXISTS (SELECT 1 FROM public.supplier WHERE nama = 'Beli Tunai / Tanpa Vendor');

CREATE OR REPLACE VIEW public.bahan_baku_status_harga WITH (security_invoker = true) AS
SELECT b.id AS bahan_baku_id,
       b.nama,
       h.harga_beli AS harga_master,
       h.harga_updated_at AS harga_master_updated_at,
       CASE WHEN t.supplier_id IS NULL THEN 'belum_dikonfirmasi' ELSE 'terkonfirmasi' END AS status,
       t.supplier_id AS vendor_terbaru_id,
       t.harga_per_besar AS harga_vendor_per_besar
  FROM public.bahan_baku b
  LEFT JOIN public.bahan_baku_harga h ON h.bahan_baku_id = b.id
  LEFT JOIN LATERAL public.harga_vendor_terpercaya(b.id) t ON true
 WHERE b.is_active;
REVOKE ALL ON public.bahan_baku_status_harga FROM anon, authenticated;
GRANT SELECT ON public.bahan_baku_status_harga TO authenticated;
