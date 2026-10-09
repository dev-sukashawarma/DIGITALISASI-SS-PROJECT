-- Migration: 20300254000600_restrict_mutasi_approval_to_kitchen.sql
-- Restrict mutasi approval & rejection to Central Kitchen (role 'kitchen') and admin/owner/developer
-- Ensure rejection requires a reason (catatan_penolakan)

CREATE OR REPLACE FUNCTION public.can_approve_mutasi()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt()->>'role' = 'service_role', false)
      OR EXISTS (
        SELECT 1 FROM public.outlet_staff
        WHERE id = auth.uid()
          AND role IN ('kitchen', 'admin', 'owner', 'developer')
          AND (status = 'active' OR is_active IS TRUE)
      );
$$;

CREATE OR REPLACE FUNCTION public.approve_mutasi(
  p_mutasi_id UUID,
  p_is_approved BOOLEAN,
  p_catatan_penolakan TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status mutasi_status;
BEGIN
  -- Hanya Admin Kitchen (kitchen) atau Admin/Owner/Developer yang berhak menyetujui atau menolak mutasi
  IF NOT public.can_approve_mutasi() THEN
    RAISE EXCEPTION 'Not authorized to approve or reject mutasi. Hanya Admin Kitchen yang berhak.'
      USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM mutasi_antar_outlet WHERE id = p_mutasi_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Mutasi not found';
  END IF;

  IF v_status != 'menunggu_persetujuan' THEN
    RAISE EXCEPTION 'Mutasi is not waiting for approval';
  END IF;

  IF p_is_approved THEN
    UPDATE mutasi_antar_outlet 
    SET status = 'menunggu_pengiriman', 
        approved_by = auth.uid(), 
        approved_at = NOW(),
        catatan_penolakan = NULL,
        updated_at = NOW()
    WHERE id = p_mutasi_id;
  ELSE
    IF p_catatan_penolakan IS NULL OR trim(p_catatan_penolakan) = '' THEN
      RAISE EXCEPTION 'Alasan penolakan mutasi wajib diisi' USING ERRCODE = '22023';
    END IF;

    UPDATE mutasi_antar_outlet 
    SET status = 'ditolak', 
        approved_by = auth.uid(), 
        approved_at = NOW(),
        catatan_penolakan = trim(p_catatan_penolakan), 
        updated_at = NOW()
    WHERE id = p_mutasi_id;
  END IF;
END;
$$;
