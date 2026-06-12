ALTER TABLE surat_jalan ENABLE ROW LEVEL SECURITY;
ALTER TABLE surat_jalan_item ENABLE ROW LEVEL SECURITY;

-- surat_jalan: SPV (pusat) sees all; crew (outlet) sees only own outlet
CREATE POLICY surat_jalan_read_all ON surat_jalan FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'spv')
    OR outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
  );

CREATE POLICY surat_jalan_insert ON surat_jalan FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'spv')
  );

CREATE POLICY surat_jalan_update ON surat_jalan FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND status = 'draft'
    AND EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'spv')
  );

-- surat_jalan_item: via parent surat_jalan access
CREATE POLICY sj_item_read ON surat_jalan_item FOR SELECT TO authenticated
  USING (
    surat_jalan_id IN (
      SELECT id FROM surat_jalan
      WHERE EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'spv')
        OR outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
    )
  );

CREATE POLICY sj_item_update ON surat_jalan_item FOR UPDATE TO authenticated
  USING (
    surat_jalan_id IN (
      SELECT id FROM surat_jalan
      WHERE status = 'dikirim'
        AND outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    surat_jalan_id IN (
      SELECT id FROM surat_jalan
      WHERE status = 'dikirim'
        AND outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
    )
  );
