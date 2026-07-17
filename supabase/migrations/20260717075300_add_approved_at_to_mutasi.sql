ALTER TABLE mutasi_antar_outlet
ADD COLUMN approved_at TIMESTAMPTZ;

-- Update the approve_mutasi RPC to set approved_at
CREATE OR REPLACE FUNCTION approve_mutasi(
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
  IF NOT auth_is_supervisor() THEN
    RAISE EXCEPTION 'Not authorized to approve mutasi';
  END IF;

  SELECT status INTO v_status FROM mutasi_antar_outlet WHERE id = p_mutasi_id;
  IF v_status != 'menunggu_persetujuan' THEN
    RAISE EXCEPTION 'Mutasi is not waiting for approval';
  END IF;

  IF p_is_approved THEN
    UPDATE mutasi_antar_outlet 
    SET status = 'menunggu_pengiriman', 
        approved_by = auth.uid(), 
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_mutasi_id;
  ELSE
    UPDATE mutasi_antar_outlet 
    SET status = 'ditolak', 
        approved_by = auth.uid(), 
        approved_at = NOW(),
        catatan_penolakan = p_catatan_penolakan, 
        updated_at = NOW()
    WHERE id = p_mutasi_id;
  END IF;
END;
$$;
