-- Satu log perubahan untuk master bahan baku (spec 2026-09-23 K10.3).
-- Harga master & harga vendor sudah punya tabel riwayat sendiri
-- (bahan_baku_harga_history, bahan_baku_supplier_history); log ini menutup
-- sisanya: data bahan, SKU, supplier. View riwayat_master_bahan menyatukan ketiganya
-- untuk tab Riwayat.

CREATE TABLE IF NOT EXISTS public.master_bahan_audit (
  id            bigserial PRIMARY KEY,
  tabel         text NOT NULL,
  baris_id      uuid NOT NULL,
  bahan_baku_id uuid,               -- NULL untuk baris supplier; sengaja tanpa FK agar
                                    -- catatan DELETE tetap hidup setelah bahannya hilang
  aksi          text NOT NULL CHECK (aksi IN ('INSERT', 'UPDATE', 'DELETE')),
  perubahan     jsonb NOT NULL,     -- UPDATE: {kolom: {lama, baru}}; INSERT/DELETE: baris utuh
  alasan        text,
  changed_by    uuid,
  changed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mba_bahan ON public.master_bahan_audit (bahan_baku_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_mba_baris ON public.master_bahan_audit (tabel, baris_id, changed_at DESC);

ALTER TABLE public.master_bahan_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.master_bahan_audit FROM anon, authenticated;
GRANT SELECT ON public.master_bahan_audit TO authenticated;

DROP POLICY IF EXISTS mba_select ON public.master_bahan_audit;
CREATE POLICY mba_select ON public.master_bahan_audit FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff s
                  WHERE s.id = auth.uid() AND s.status = 'active'
                    AND s.role IN ('admin', 'owner', 'purchasing')));

CREATE OR REPLACE FUNCTION public.master_bahan_tulis_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old  jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_new  jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_diff jsonb := '{}'::jsonb;
  v_row  jsonb;
  k      text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      CONTINUE WHEN k IN ('updated_at', 'created_at');
      IF (v_old -> k) IS DISTINCT FROM (v_new -> k) THEN
        v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('lama', v_old -> k, 'baru', v_new -> k));
      END IF;
    END LOOP;
    IF v_diff = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSE
    v_diff := COALESCE(v_new, v_old);
  END IF;

  v_row := COALESCE(v_new, v_old);
  INSERT INTO public.master_bahan_audit (tabel, baris_id, bahan_baku_id, aksi, perubahan, alasan, changed_by)
  VALUES (
    TG_TABLE_NAME,
    (v_row ->> 'id')::uuid,
    CASE TG_TABLE_NAME
      WHEN 'bahan_baku'     THEN (v_row ->> 'id')::uuid
      WHEN 'bahan_baku_sku' THEN (v_row ->> 'bahan_baku_id')::uuid
      ELSE NULL
    END,
    TG_OP,
    v_diff,
    NULLIF(current_setting('app.alasan', true), ''),
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.master_bahan_tulis_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_bahan_baku ON public.bahan_baku;
CREATE TRIGGER trg_audit_bahan_baku AFTER INSERT OR UPDATE OR DELETE ON public.bahan_baku
  FOR EACH ROW EXECUTE FUNCTION public.master_bahan_tulis_audit();
DROP TRIGGER IF EXISTS trg_audit_bahan_baku_sku ON public.bahan_baku_sku;
CREATE TRIGGER trg_audit_bahan_baku_sku AFTER INSERT OR UPDATE OR DELETE ON public.bahan_baku_sku
  FOR EACH ROW EXECUTE FUNCTION public.master_bahan_tulis_audit();
DROP TRIGGER IF EXISTS trg_audit_supplier ON public.supplier;
CREATE TRIGGER trg_audit_supplier AFTER INSERT OR UPDATE OR DELETE ON public.supplier
  FOR EACH ROW EXECUTE FUNCTION public.master_bahan_tulis_audit();

-- Riwayat katalog kini membawa alasan RPC (Task 6). Badan lain identik dengan
-- definisi live 2026-09-23 (SECURITY DEFINER, pelaku = auth.uid() / updated_by).
CREATE OR REPLACE FUNCTION public.bbs_tulis_riwayat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.harga            IS NOT DISTINCT FROM OLD.harga
     AND NEW.satuan_beli      IS NOT DISTINCT FROM OLD.satuan_beli
     AND NEW.isi_satuan_kecil IS NOT DISTINCT FROM OLD.isi_satuan_kecil THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.bahan_baku_supplier_history (
    bahan_baku_supplier_id, bahan_baku_id, supplier_id,
    harga_lama, harga_baru, satuan_beli, isi_satuan_kecil,
    sumber, ref_po_id, changed_by, catatan
  ) VALUES (
    NEW.id, NEW.bahan_baku_id, NEW.supplier_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.harga ELSE NULL END,
    NEW.harga, NEW.satuan_beli, NEW.isi_satuan_kecil,
    NEW.sumber, NEW.ref_po_id, COALESCE(auth.uid(), NEW.updated_by),
    NULLIF(current_setting('app.alasan', true), '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE VIEW public.riwayat_master_bahan WITH (security_invoker = true) AS
SELECT a.bahan_baku_id, a.changed_at, a.changed_by, 'data'::text AS jenis,
       a.tabel, a.aksi, a.perubahan, a.alasan,
       NULL::numeric AS harga_lama, NULL::numeric AS harga_baru, NULL::uuid AS supplier_id
  FROM public.master_bahan_audit a
 WHERE a.bahan_baku_id IS NOT NULL
UNION ALL
SELECT h.bahan_baku_id, h.changed_at, h.changed_by, 'harga_master',
       'bahan_baku_harga', 'UPDATE', NULL::jsonb, h.catatan,
       h.harga_lama, h.harga_baru, NULL::uuid
  FROM public.bahan_baku_harga_history h
UNION ALL
SELECT v.bahan_baku_id, v.changed_at, v.changed_by, 'harga_vendor',
       'bahan_baku_supplier', 'UPDATE',
       jsonb_build_object('satuan_beli', v.satuan_beli, 'isi_satuan_kecil', v.isi_satuan_kecil,
                          'sumber', v.sumber, 'ref_po_id', v.ref_po_id),
       v.catatan, v.harga_lama, v.harga_baru, v.supplier_id
  FROM public.bahan_baku_supplier_history v;

REVOKE ALL ON public.riwayat_master_bahan FROM anon, authenticated;
GRANT SELECT ON public.riwayat_master_bahan TO authenticated;
