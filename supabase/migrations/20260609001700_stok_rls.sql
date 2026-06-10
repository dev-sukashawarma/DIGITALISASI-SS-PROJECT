ALTER TABLE bahan_baku ENABLE ROW LEVEL SECURITY;
ALTER TABLE resep ENABLE ROW LEVEL SECURITY;
ALTER TABLE resep_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE opname ENABLE ROW LEVEL SECURITY;
ALTER TABLE opname_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_stok ENABLE ROW LEVEL SECURITY;
ALTER TABLE stok_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY bahan_baku_read ON bahan_baku FOR SELECT TO authenticated USING (true);
CREATE POLICY resep_read ON resep FOR SELECT TO authenticated USING (true);
CREATE POLICY resep_item_read ON resep_item FOR SELECT TO authenticated USING (true);

CREATE POLICY bahan_baku_write ON bahan_baku FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'kepala_outlet'))
  WITH CHECK (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'kepala_outlet'));

CREATE POLICY opname_read ON opname FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid()));
CREATE POLICY opname_insert ON opname FOR INSERT TO authenticated
  WITH CHECK (outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid()));
CREATE POLICY opname_update ON opname FOR UPDATE TO authenticated
  USING (outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid()) AND status = 'draft');

CREATE POLICY opname_item_read ON opname_item FOR SELECT TO authenticated
  USING (opname_id IN (SELECT id FROM opname WHERE outlet_id IN
    (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())));
CREATE POLICY opname_item_write ON opname_item FOR ALL TO authenticated
  USING (opname_id IN (SELECT id FROM opname WHERE status='draft' AND outlet_id IN
    (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())))
  WITH CHECK (opname_id IN (SELECT id FROM opname WHERE status='draft' AND outlet_id IN
    (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())));

CREATE POLICY ledger_read ON ledger_stok FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid()));
CREATE POLICY ledger_insert ON ledger_stok FOR INSERT TO authenticated
  WITH CHECK (outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid()));
CREATE POLICY ledger_service_insert ON ledger_stok FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY stok_balance_read ON stok_balance FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid()));
