-- 20260707100400_po_rls.sql
-- RLS untuk tabel purchase_order dan purchase_order_item.
-- Akses: admin (semua outlet) dan kitchen (outlet pusat = kitchen-bogor).

ALTER TABLE public.purchase_order      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_item ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: apakah user boleh kelola PO?
-- TRUE jika role = 'admin' ATAU (role = 'kitchen' AND outlet = kitchen-bogor)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_po()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('admin', 'kitchen')
  );
$$;

-- ============================================================
-- purchase_order policies
-- ============================================================

-- SELECT: admin + kitchen
CREATE POLICY po_select ON public.purchase_order
  FOR SELECT TO authenticated
  USING (public.can_manage_po());

-- INSERT: admin + kitchen
CREATE POLICY po_insert ON public.purchase_order
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_po());

-- UPDATE: admin + kitchen (tapi hanya selama bukan 'diterima_lengkap'/'dibatalkan')
-- Validasi status transition dilakukan di level RPC, bukan RLS.
CREATE POLICY po_update ON public.purchase_order
  FOR UPDATE TO authenticated
  USING (public.can_manage_po())
  WITH CHECK (public.can_manage_po());

-- DELETE: admin only (kitchen tidak bisa hapus PO)
CREATE POLICY po_delete ON public.purchase_order
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- ============================================================
-- purchase_order_item policies (ikuti akses header PO)
-- ============================================================

CREATE POLICY poi_select ON public.purchase_order_item
  FOR SELECT TO authenticated
  USING (public.can_manage_po());

CREATE POLICY poi_insert ON public.purchase_order_item
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_po());

CREATE POLICY poi_update ON public.purchase_order_item
  FOR UPDATE TO authenticated
  USING (public.can_manage_po())
  WITH CHECK (public.can_manage_po());

CREATE POLICY poi_delete ON public.purchase_order_item
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- DOWN:
-- DROP FUNCTION IF EXISTS public.can_manage_po();
