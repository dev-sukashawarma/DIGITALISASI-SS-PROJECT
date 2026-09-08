-- 20260908232000_bahan_baku_supplier.sql
-- Katalog harga vendor: satu baris per pasangan (bahan, vendor).
-- Lapisan REFERENSI PEMBELIAN. Tidak mengubah harga master, HPP, atau nilai
-- persediaan. Spec: docs/superpowers/specs/2026-09-08-katalog-harga-vendor-design.md

CREATE TABLE IF NOT EXISTS public.bahan_baku_supplier (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_baku_id          uuid NOT NULL REFERENCES public.bahan_baku(id) ON DELETE CASCADE,
  supplier_id            uuid NOT NULL REFERENCES public.supplier(id)   ON DELETE CASCADE,

  -- Harga apa adanya sesuai nota vendor
  satuan_beli            text    NOT NULL,
  isi_satuan_kecil       numeric NOT NULL CHECK (isi_satuan_kecil > 0),
  harga                  numeric NOT NULL DEFAULT 0 CHECK (harga >= 0),

  -- Satu-satunya angka yang boleh dibandingkan antar vendor
  harga_per_satuan_kecil numeric GENERATED ALWAYS AS (harga / isi_satuan_kecil) STORED,

  kode_vendor            text,
  is_preferred           boolean NOT NULL DEFAULT false,
  is_active              boolean NOT NULL DEFAULT true,
  sumber                 text    NOT NULL DEFAULT 'manual'
                                 CHECK (sumber IN ('po', 'manual')),
  perlu_ditinjau         boolean NOT NULL DEFAULT false,

  ref_po_id              uuid REFERENCES public.purchase_order(id) ON DELETE SET NULL,
  harga_updated_at       timestamptz,
  updated_by             uuid REFERENCES public.outlet_staff(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bbs_unik_pasangan UNIQUE (bahan_baku_id, supplier_id)
);

COMMENT ON COLUMN public.bahan_baku_supplier.isi_satuan_kecil IS
  'Jumlah satuan KECIL bahan dalam 1 satuan_beli. Dijangkar ke satuan kecil, '
  'bukan satuan besar, supaya baris tetap benar saat satuan besar bahan '
  'berubah (FOIL Roll->Dus, 8 Sep 2026).';

COMMENT ON COLUMN public.bahan_baku_supplier.perlu_ditinjau IS
  'true = angka berasal dari periode sebelum guard salah-satuan 4 Sep 2026, '
  'atau belum pernah diverifikasi. Tidak boleh dipakai prefill PO.';

CREATE INDEX IF NOT EXISTS idx_bbs_bahan    ON public.bahan_baku_supplier(bahan_baku_id);
CREATE INDEX IF NOT EXISTS idx_bbs_supplier ON public.bahan_baku_supplier(supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bbs_satu_preferred
  ON public.bahan_baku_supplier(bahan_baku_id) WHERE is_preferred;

-- ── Riwayat ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bahan_baku_supplier_history (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_baku_supplier_id  uuid REFERENCES public.bahan_baku_supplier(id) ON DELETE SET NULL,
  bahan_baku_id           uuid NOT NULL,
  supplier_id             uuid NOT NULL,
  harga_lama              numeric,
  harga_baru              numeric NOT NULL,
  satuan_beli             text,
  isi_satuan_kecil        numeric,
  sumber                  text,
  ref_po_id               uuid REFERENCES public.purchase_order(id) ON DELETE SET NULL,
  catatan                 text,
  changed_by              uuid REFERENCES public.outlet_staff(id),
  changed_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bbsh_bahan
  ON public.bahan_baku_supplier_history(bahan_baku_id, changed_at DESC);

-- ── Trigger: updated_at + tulis riwayat ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bbs_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_bbs_updated_at ON public.bahan_baku_supplier;
CREATE TRIGGER trg_bbs_updated_at
  BEFORE UPDATE ON public.bahan_baku_supplier
  FOR EACH ROW EXECUTE FUNCTION public.bbs_set_updated_at();

CREATE OR REPLACE FUNCTION public.bbs_tulis_riwayat()
RETURNS trigger LANGUAGE plpgsql AS $$
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
    sumber, ref_po_id, changed_by
  ) VALUES (
    NEW.id, NEW.bahan_baku_id, NEW.supplier_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.harga ELSE NULL END,
    NEW.harga, NEW.satuan_beli, NEW.isi_satuan_kecil,
    NEW.sumber, NEW.ref_po_id, NEW.updated_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bbs_riwayat ON public.bahan_baku_supplier;
CREATE TRIGGER trg_bbs_riwayat
  AFTER INSERT OR UPDATE ON public.bahan_baku_supplier
  FOR EACH ROW EXECUTE FUNCTION public.bbs_tulis_riwayat();

-- ── RLS: cermin kebijakan supplier (20260814110000) ───────────────────────
ALTER TABLE public.bahan_baku_supplier         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bahan_baku_supplier_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bbs_select ON public.bahan_baku_supplier;
CREATE POLICY bbs_select ON public.bahan_baku_supplier
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid()
                   AND role IN ('admin','kitchen','purchase','purchasing',
                                'admin_finance','finance','owner','developer')));

DROP POLICY IF EXISTS bbs_write ON public.bahan_baku_supplier;
CREATE POLICY bbs_write ON public.bahan_baku_supplier
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid()
                   AND role IN ('admin','kitchen','purchase','purchasing',
                                'admin_finance','finance','owner','developer')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid()
                   AND role IN ('admin','kitchen','purchase','purchasing',
                                'admin_finance','finance','owner','developer')));

DROP POLICY IF EXISTS bbsh_select ON public.bahan_baku_supplier_history;
CREATE POLICY bbsh_select ON public.bahan_baku_supplier_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid()
                   AND role IN ('admin','kitchen','purchase','purchasing',
                                'admin_finance','finance','owner','developer')));

-- Riwayat hanya ditulis trigger; tidak ada policy INSERT untuk klien.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bahan_baku_supplier         TO authenticated;
GRANT SELECT                         ON public.bahan_baku_supplier_history TO authenticated;

-- DOWN:
-- DROP TABLE IF EXISTS public.bahan_baku_supplier_history CASCADE;
-- DROP TABLE IF EXISTS public.bahan_baku_supplier CASCADE;
-- DROP FUNCTION IF EXISTS public.bbs_tulis_riwayat();
-- DROP FUNCTION IF EXISTS public.bbs_set_updated_at();
