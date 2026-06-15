-- Enable RLS on permintaan_bahan and permintaan_bahan_item tables
-- Kitchen staff (outlet 550e8400-e29b-41d4-a716-446655440001) can approve all requests.
-- Outlet staff can view/create requests for their outlets only.

-- Enable RLS
ALTER TABLE permintaan_bahan ENABLE ROW LEVEL SECURITY;
ALTER TABLE permintaan_bahan_item ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is kitchen staff
CREATE OR REPLACE FUNCTION is_kitchen_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT '550e8400-e29b-41d4-a716-446655440001'::uuid IN (
    SELECT accessible_outlet_ids()
  );
$$;

-- RLS policies for permintaan_bahan

-- SELECT: outlet staff see their outlets, kitchen staff see all
CREATE POLICY "select_permintaan_bahan_accessible_outlets"
  ON permintaan_bahan
  FOR SELECT
  TO authenticated
  USING (
    outlet_id IN (SELECT accessible_outlet_ids())
    OR is_kitchen_staff()
  );

-- INSERT: only outlet staff can create for their outlets, must be the requester
CREATE POLICY "insert_permintaan_bahan_own_outlet"
  ON permintaan_bahan
  FOR INSERT
  TO authenticated
  WITH CHECK (
    outlet_id IN (SELECT accessible_outlet_ids())
    AND dibuat_oleh = auth.uid()
  );

-- UPDATE: only kitchen staff can update status
CREATE POLICY "update_permintaan_bahan_kitchen_only"
  ON permintaan_bahan
  FOR UPDATE
  TO authenticated
  USING (is_kitchen_staff());

-- DELETE: only kitchen staff can delete
CREATE POLICY "delete_permintaan_bahan_kitchen_only"
  ON permintaan_bahan
  FOR DELETE
  TO authenticated
  USING (is_kitchen_staff());

-- RLS policies for permintaan_bahan_item

-- SELECT: visible if parent permintaan_bahan is accessible
CREATE POLICY "select_permintaan_bahan_item_via_parent"
  ON permintaan_bahan_item
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM permintaan_bahan pb
      WHERE pb.id = permintaan_bahan_item.permintaan_id
        AND (
          pb.outlet_id IN (SELECT accessible_outlet_ids())
          OR is_kitchen_staff()
        )
    )
  );

-- INSERT: only if parent permintaan is in accessible outlets
CREATE POLICY "insert_permintaan_bahan_item_accessible_parent"
  ON permintaan_bahan_item
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permintaan_bahan pb
      WHERE pb.id = permintaan_bahan_item.permintaan_id
        AND pb.outlet_id IN (SELECT accessible_outlet_ids())
    )
  );

-- UPDATE: only kitchen staff can update (approve qty)
CREATE POLICY "update_permintaan_bahan_item_kitchen_only"
  ON permintaan_bahan_item
  FOR UPDATE
  TO authenticated
  USING (is_kitchen_staff());

-- DELETE: only kitchen staff can delete
CREATE POLICY "delete_permintaan_bahan_item_kitchen_only"
  ON permintaan_bahan_item
  FOR DELETE
  TO authenticated
  USING (is_kitchen_staff());
