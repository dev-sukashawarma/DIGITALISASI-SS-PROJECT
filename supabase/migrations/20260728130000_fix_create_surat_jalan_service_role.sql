-- Fix create_surat_jalan & create_surat_jalan_with_number to allow execution by service_role.
-- Server Actions (such as approvePermintaan via approve_permintaan_svc) run using service_role
-- after validating staff authorization on the server side (requirePermintaanApprover).
-- When executed as service_role, auth.uid() is NULL, which previously caused create_surat_jalan
-- to throw "Forbidden: hanya Gudang Pusat (kitchen) atau admin/owner..."

CREATE OR REPLACE FUNCTION create_surat_jalan(
  p_outlet_id UUID,
  p_items JSONB
)
RETURNS surat_jalan
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj surat_jalan;
  v_item JSONB;
BEGIN
  IF auth.role() != 'service_role' AND NOT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen', 'admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Forbidden: hanya Gudang Pusat (kitchen) atau admin/owner yang boleh menerbitkan surat jalan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM outlets WHERE id = p_outlet_id) THEN
    RAISE EXCEPTION 'outlet % not found', p_outlet_id;
  END IF;

  INSERT INTO surat_jalan (outlet_id, created_by)
  VALUES (p_outlet_id, auth.uid())
  RETURNING * INTO v_sj;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim)
    VALUES (v_sj.id, (v_item->>'bahan_baku_id')::UUID, (v_item->>'qty_dikirim')::NUMERIC);
  END LOOP;

  RETURN v_sj;
END;
$$;

CREATE OR REPLACE FUNCTION create_surat_jalan_with_number(
  p_outlet_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj_id uuid;
  v_document_number text;
  v_verification_code text;
BEGIN
  IF auth.role() != 'service_role' AND NOT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen', 'admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Forbidden: hanya Gudang Pusat (kitchen) atau admin/owner yang boleh menerbitkan surat jalan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM outlets WHERE id = p_outlet_id) THEN
    RAISE EXCEPTION 'outlet % not found', p_outlet_id;
  END IF;

  v_document_number := generate_surat_jalan_number(p_outlet_id);

  INSERT INTO surat_jalan (outlet_id, status, document_number, signatures)
  VALUES (p_outlet_id, 'draft', v_document_number, '[]'::jsonb)
  RETURNING id, verification_code INTO v_sj_id, v_verification_code;

  RETURN jsonb_build_object(
    'id', v_sj_id,
    'document_number', v_document_number,
    'verification_code', v_verification_code
  );
END;
$$;
