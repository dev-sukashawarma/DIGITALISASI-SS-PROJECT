-- FIX: accessible_outlet_ids() mengembalikan SETOF uuid (bukan uuid[]),
-- jadi `= ANY(accessible_outlet_ids())` gagal dengan
-- ERROR 42809: op ANY/ALL (array) requires array on right side.
--
-- Solusi: pakai `IN (SELECT accessible_outlet_ids())` — pola yang benar
-- untuk fungsi SETOF (4 policy lain di permintaan_bahan_rls sudah pakai ini).
--
-- Memperbaiki 2 lokasi:
--   1. is_kitchen_staff()  -> dipanggil semua RLS policy permintaan_bahan
--   2. buat_permintaan RPC -> guard akses outlet

-- 1. is_kitchen_staff
CREATE OR REPLACE FUNCTION is_kitchen_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT '550e8400-e29b-41d4-a716-446655440001'::uuid
         IN (SELECT accessible_outlet_ids());
$$;

-- 2. buat_permintaan: ganti guard `= ANY` -> `IN (SELECT ...)`
CREATE OR REPLACE FUNCTION buat_permintaan(
  p_outlet_id UUID,
  p_items JSONB
)
RETURNS permintaan_bahan
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p permintaan_bahan;
  v_item JSONB;
BEGIN
  IF NOT (p_outlet_id IN (SELECT accessible_outlet_ids())) THEN
    RAISE EXCEPTION 'tidak punya akses ke outlet %', p_outlet_id;
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'permintaan harus berisi minimal 1 item';
  END IF;

  INSERT INTO permintaan_bahan (outlet_id, dibuat_oleh)
  VALUES (p_outlet_id, auth.uid())
  RETURNING * INTO v_p;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    INSERT INTO permintaan_bahan_item (permintaan_id, bahan_baku_id, qty_diminta)
    VALUES (v_p.id, (v_item->>'bahan_baku_id')::UUID, (v_item->>'qty_diminta')::NUMERIC);
  END LOOP;

  RETURN v_p;
END;
$$;
