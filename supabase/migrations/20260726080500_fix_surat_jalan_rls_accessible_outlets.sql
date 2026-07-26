-- Migration: Restrict surat_jalan and surat_jalan_item SELECT access by accessible_outlet_ids()
-- Ensures Leaders only see Surat Jalan for their assigned outlets (staff_outlets / home outlet)
-- while Pusat roles (kitchen, admin, spv, owner) continue to see all outlets.

DROP POLICY IF EXISTS surat_jalan_select ON surat_jalan;
CREATE POLICY surat_jalan_select
  ON surat_jalan
  FOR SELECT
  TO authenticated
  USING (
    outlet_id IN (SELECT accessible_outlet_ids())
  );

DROP POLICY IF EXISTS surat_jalan_item_select ON surat_jalan_item;
CREATE POLICY surat_jalan_item_select
  ON surat_jalan_item
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM surat_jalan sj
      WHERE sj.id = surat_jalan_item.surat_jalan_id
        AND sj.outlet_id IN (SELECT accessible_outlet_ids())
    )
  );
