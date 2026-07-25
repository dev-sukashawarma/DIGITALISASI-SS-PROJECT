-- 20260723100400_po_status_transition_guard.sql
-- FIX Critical (final review): gerbang approval/terima sebelumnya HANYA di UI.
-- Jalur tulis status PO adalah UPDATE tabel langsung (useUpdatePOStatus) di bawah
-- RLS po_update = can_manage_po() (kini termasuk 'purchase') TANPA validasi transisi.
-- Akibatnya user 'purchase' bisa UPDATE status='dikirim_ke_supplier' langsung
-- (lewati approval finance) atau 'diterima_lengkap' (memicu po_on_verified,
-- melewati guard can_verify_po_receipt). Ini persis pelanggaran pemisahan tugas
-- yang jadi tujuan fitur ini (lihat insiden 2026-07-20).
--
-- RLS WITH CHECK tak bisa membandingkan OLD vs NEW → gerbang transisi WAJIB trigger.
-- Dua barrier ditegakkan untuk user login nyata (auth.uid() NOT NULL):
--   • → 'dikirim_ke_supplier'          hanya can_approve_po()       (finance/owner/admin)
--   • → 'sebagian_diterima'/'diterima_lengkap' hanya can_verify_po_receipt() (kitchen/admin/owner)
-- Jalur sah tetap lolos: approve_po_finance() (dipanggil finance → auth.uid finance →
-- can_approve_po true) & verifikasi_terima_po() (dipanggil kitchen → can_verify true).
-- auth.uid() IS NULL (service_role/backend tepercaya, mis. seeding) DILEWATKAN agar
-- otomasi tak rusak — anon tak relevan karena tak lolos RLS po_update.

CREATE OR REPLACE FUNCTION public.po_status_transition_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND auth.uid() IS NOT NULL THEN
    IF NEW.status = 'dikirim_ke_supplier' AND NOT public.can_approve_po() THEN
      RAISE EXCEPTION 'Hanya finance/owner/admin yang dapat menyetujui & mengirim PO ke supplier'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.status IN ('sebagian_diterima', 'diterima_lengkap')
       AND NOT public.can_verify_po_receipt() THEN
      RAISE EXCEPTION 'Hanya kitchen/admin/owner yang dapat menandai PO diterima'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_status_transition_guard ON public.purchase_order;
CREATE TRIGGER trg_po_status_transition_guard
  BEFORE UPDATE ON public.purchase_order
  FOR EACH ROW EXECUTE FUNCTION public.po_status_transition_guard();
