-- 20260723100300_po_select_for_approver.sql
-- FIX celah lintas-task: halaman "Approval PO" di apps/finance query purchase_order
-- lewat browser client (tunduk RLS), tapi policy SELECT existing hanya
-- can_manage_po() (admin/kitchen/purchase) + purchase. admin_finance & owner —
-- justru yang meng-approve — TAK punya jalur SELECT, jadi daftar approval kosong.
-- RPC approve/reject_po_finance sudah jalan (SECURITY DEFINER), tapi UI tak bisa
-- menampilkan PO tanpa SELECT. Tambah policy SELECT untuk approver (can_approve_po
-- = admin_finance/owner/admin). Additif & idempotent; policy permissive di-OR.

DROP POLICY IF EXISTS po_select_approver ON public.purchase_order;
CREATE POLICY po_select_approver ON public.purchase_order
  FOR SELECT TO authenticated
  USING (public.can_approve_po());

DROP POLICY IF EXISTS poi_select_approver ON public.purchase_order_item;
CREATE POLICY poi_select_approver ON public.purchase_order_item
  FOR SELECT TO authenticated
  USING (public.can_approve_po());
