-- 20300109000004_grant_purchasing_kitchen_stok_access.sql
-- Penyetaraan kewenangan role 'purchasing' di modul stok agar setara dengan 'kitchen'.
-- Memberikan hak akses seluruh outlet (accessible_outlet_ids), penerbitan surat jalan (create_surat_jalan),
-- serta RLS kebijakan pada tabel surat_jalan, surat_jalan_item, dan bahan_baku_substitusi.

-- 1. Perbarui accessible_outlet_ids() menyertakan 'purchasing' di privileged all-outlets
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id FROM public.outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv', 'regional_manager', 'kitchen', 'admin_finance', 'purchasing')
  UNION
  SELECT so.outlet_id FROM public.staff_outlets so, me
    WHERE me.role IN ('leader', 'korlap', 'area_manager') AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('crew', 'kiosk', 'mitra', 'staff_pusat');
$function$;

-- 2. Perbarui RPC create_surat_jalan & create_surat_jalan_with_number
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
    WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen', 'admin', 'owner', 'purchasing')
  ) THEN
    RAISE EXCEPTION 'Forbidden: hanya Gudang Pusat (kitchen), purchasing, atau admin/owner yang boleh menerbitkan surat jalan';
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
    WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen', 'admin', 'owner', 'purchasing')
  ) THEN
    RAISE EXCEPTION 'Forbidden: hanya Gudang Pusat (kitchen), purchasing, atau admin/owner yang boleh menerbitkan surat jalan';
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

-- 3. Perbarui RLS Policy surat_jalan & surat_jalan_item
DROP POLICY IF EXISTS surat_jalan_insert_scoped ON surat_jalan;
CREATE POLICY surat_jalan_insert_scoped
  ON surat_jalan
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outlet_staff
      WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen', 'admin', 'owner', 'purchasing')
    )
  );

DROP POLICY IF EXISTS surat_jalan_item_insert_scoped ON surat_jalan_item;
CREATE POLICY surat_jalan_item_insert_scoped
  ON surat_jalan_item
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outlet_staff
      WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen', 'admin', 'owner', 'purchasing')
    )
  );

-- 4. Perbarui RLS policy bahan_baku_substitusi
DROP POLICY IF EXISTS bbs_write_admin ON public.bahan_baku_substitusi;
CREATE POLICY bbs_write_admin ON public.bahan_baku_substitusi
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'owner', 'kitchen', 'purchasing')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'owner', 'kitchen', 'purchasing')
  ));
