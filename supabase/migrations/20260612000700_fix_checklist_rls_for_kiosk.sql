-- Fix checklist RLS to support Kiosk accounts
-- Kiosk accounts (in profiles) don't have a row in outlet_staff with their auth.uid().
-- We must use the auth_outlet_id() helper function to verify outlet access.

-- Drop old policies
DROP POLICY IF EXISTS "Staff can read categories in their outlet" ON checklist_categories;
DROP POLICY IF EXISTS "SPV can manage categories in their outlet" ON checklist_categories;

DROP POLICY IF EXISTS "Staff can read items in their outlet" ON checklist_items;
DROP POLICY IF EXISTS "SPV can manage items in their outlet" ON checklist_items;

DROP POLICY IF EXISTS "Staff can read records in their outlet" ON daily_checklist_records;
DROP POLICY IF EXISTS "Staff can manage records in their outlet" ON daily_checklist_records;

DROP POLICY IF EXISTS "Staff can read ticks in their outlet" ON daily_checklist_ticks;
DROP POLICY IF EXISTS "Staff can insert ticks in their outlet" ON daily_checklist_ticks;
DROP POLICY IF EXISTS "Staff can update ticks in their outlet" ON daily_checklist_ticks;
DROP POLICY IF EXISTS "Staff can delete ticks in their outlet" ON daily_checklist_ticks;

-- RLS: checklist_categories
CREATE POLICY "Staff can read categories in their outlet" ON checklist_categories
  FOR SELECT TO authenticated
  USING (outlet_id = auth_outlet_id());

CREATE POLICY "SPV can manage categories in their outlet" ON checklist_categories
  FOR ALL TO authenticated
  USING (outlet_id = auth_outlet_id() AND auth_is_supervisor());

-- RLS: checklist_items
CREATE POLICY "Staff can read items in their outlet" ON checklist_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checklist_categories c
    WHERE c.id = checklist_items.category_id AND c.outlet_id = auth_outlet_id()
  ));

CREATE POLICY "SPV can manage items in their outlet" ON checklist_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checklist_categories c
    WHERE c.id = checklist_items.category_id AND c.outlet_id = auth_outlet_id()
  ) AND auth_is_supervisor());

-- RLS: daily_checklist_records
CREATE POLICY "Staff can read records in their outlet" ON daily_checklist_records
  FOR SELECT TO authenticated
  USING (outlet_id = auth_outlet_id());

CREATE POLICY "Staff can manage records in their outlet" ON daily_checklist_records
  FOR ALL TO authenticated
  USING (outlet_id = auth_outlet_id());

-- RLS: daily_checklist_ticks
CREATE POLICY "Staff can read ticks in their outlet" ON daily_checklist_ticks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM daily_checklist_records r
    WHERE r.id = daily_checklist_ticks.record_id AND r.outlet_id = auth_outlet_id()
  ));

CREATE POLICY "Staff can insert ticks in their outlet" ON daily_checklist_ticks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_checklist_records r
      WHERE r.id = daily_checklist_ticks.record_id AND r.outlet_id = auth_outlet_id()
    )
    AND EXISTS (
      SELECT 1 FROM checklist_items i
      WHERE i.id = daily_checklist_ticks.item_id
    )
    -- The staff ticking must belong to the same outlet
    AND EXISTS (
      SELECT 1 FROM outlet_staff s
      WHERE s.id = daily_checklist_ticks.ticked_by AND s.outlet_id = auth_outlet_id()
    )
  );

CREATE POLICY "Staff can update ticks in their outlet" ON daily_checklist_ticks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_checklist_records r
      WHERE r.id = daily_checklist_ticks.record_id AND r.outlet_id = auth_outlet_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_checklist_records r
      WHERE r.id = daily_checklist_ticks.record_id AND r.outlet_id = auth_outlet_id()
    )
    AND EXISTS (
      SELECT 1 FROM outlet_staff s
      WHERE s.id = daily_checklist_ticks.ticked_by AND s.outlet_id = auth_outlet_id()
    )
  );

CREATE POLICY "Staff can delete ticks in their outlet" ON daily_checklist_ticks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_checklist_records r
      WHERE r.id = daily_checklist_ticks.record_id AND r.outlet_id = auth_outlet_id()
    )
  );
