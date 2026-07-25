-- 20260723100000_purchase_role_and_procurement.sql
-- Spec 1: role purchase + skema pengadaan. Aditif & idempotent.

-- 1) Role purchase di CHECK constraint outlet_staff
DO $$
BEGIN
  ALTER TABLE public.outlet_staff DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
  ALTER TABLE public.outlet_staff ADD CONSTRAINT outlet_staff_role_check
    CHECK (role IN ('admin','owner','spv','leader','kasir','crew','kiosk','kitchen',
                    'mitra','staff_pusat','admin_finance','area_manager','korlap',
                    'admin_hr','purchase'));
END $$;

-- 2) Termin default per supplier
ALTER TABLE public.supplier
  ADD COLUMN IF NOT EXISTS termin_hari integer;
COMMENT ON COLUMN public.supplier.termin_hari IS 'Default termin pembayaran (hari) sejak barang diterima. NULL = belum ada kesepakatan.';

-- 3) Kolom purchase_order: gerbang approval finance + jatuh tempo
ALTER TABLE public.purchase_order
  ADD COLUMN IF NOT EXISTS jatuh_tempo date,
  ADD COLUMN IF NOT EXISTS disetujui_finance_oleh uuid REFERENCES public.outlet_staff(id),
  ADD COLUMN IF NOT EXISTS disetujui_finance_at timestamptz;

-- Perluas CHECK status PO (sisipkan menunggu_approval_finance)
DO $$
BEGIN
  ALTER TABLE public.purchase_order DROP CONSTRAINT IF EXISTS purchase_order_status_check;
  ALTER TABLE public.purchase_order ADD CONSTRAINT purchase_order_status_check
    CHECK (status IN ('draft','menunggu_approval_finance','dikirim_ke_supplier',
                      'sebagian_diterima','diterima_lengkap','dibatalkan'));
END $$;

-- 4) Riwayat harga master (jejak tiap penimpaan po_on_verified)
CREATE TABLE IF NOT EXISTS public.bahan_baku_harga_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_baku_id uuid NOT NULL REFERENCES public.bahan_baku(id) ON DELETE CASCADE,
  harga_lama    numeric,
  harga_baru    numeric NOT NULL,
  ref_po_id     uuid REFERENCES public.purchase_order(id) ON DELETE SET NULL,
  changed_by    uuid REFERENCES public.outlet_staff(id),
  changed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bbhh_bahan ON public.bahan_baku_harga_history(bahan_baku_id, changed_at DESC);
ALTER TABLE public.bahan_baku_harga_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bbhh_select ON public.bahan_baku_harga_history;
CREATE POLICY bbhh_select ON public.bahan_baku_harga_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('admin','owner','kitchen','purchase')));

-- 5) Permintaan Pembelian (PR)
CREATE TABLE IF NOT EXISTS public.purchase_request (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by  uuid REFERENCES public.outlet_staff(id),
  bahan_baku_id uuid REFERENCES public.bahan_baku(id),
  nama_bebas    text,
  qty           numeric NOT NULL CHECK (qty > 0),
  satuan        text,
  alasan        text,
  urgensi       text NOT NULL DEFAULT 'normal' CHECK (urgensi IN ('rendah','normal','mendesak')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','jadi_po','ditolak')),
  linked_po_id  uuid REFERENCES public.purchase_order(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pr_bahan_or_bebas CHECK (bahan_baku_id IS NOT NULL OR nama_bebas IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_pr_status ON public.purchase_request(status, created_at DESC);
ALTER TABLE public.purchase_request ENABLE ROW LEVEL SECURITY;

-- SELECT: pengaju (kitchen/spv), purchase, admin, owner
DROP POLICY IF EXISTS pr_select ON public.purchase_request;
CREATE POLICY pr_select ON public.purchase_request
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid()
                   AND role IN ('kitchen','spv','purchase','admin','owner')));

-- INSERT: hanya kitchen/spv yang mengajukan (requested_by wajib = auth.uid())
DROP POLICY IF EXISTS pr_insert ON public.purchase_request;
CREATE POLICY pr_insert ON public.purchase_request
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.outlet_staff
                WHERE id = auth.uid() AND role IN ('kitchen','spv')));

-- UPDATE: purchase (mengubah status jadi_po/ditolak + link PO), admin/owner
DROP POLICY IF EXISTS pr_update ON public.purchase_request;
CREATE POLICY pr_update ON public.purchase_request
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('purchase','admin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('purchase','admin','owner')));

CREATE OR REPLACE FUNCTION public.pr_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_pr_updated_at ON public.purchase_request;
CREATE TRIGGER trg_pr_updated_at BEFORE UPDATE ON public.purchase_request
  FOR EACH ROW EXECUTE FUNCTION public.pr_set_updated_at();
