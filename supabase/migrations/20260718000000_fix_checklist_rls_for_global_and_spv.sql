-- Drop old policies
DROP POLICY IF EXISTS "Staff can read categories in their outlet" ON checklist_categories;
DROP POLICY IF EXISTS "SPV can manage categories in their outlet" ON checklist_categories;

DROP POLICY IF EXISTS "Staff can read items in their outlet" ON checklist_items;
DROP POLICY IF EXISTS "SPV can manage items in their outlet" ON checklist_items;

DROP POLICY IF EXISTS "SPV can read all records" ON daily_checklist_records;
DROP POLICY IF EXISTS "SPV can manage all records" ON daily_checklist_records;
DROP POLICY IF EXISTS "SPV can read all ticks" ON daily_checklist_ticks;
DROP POLICY IF EXISTS "SPV can manage all ticks" ON daily_checklist_ticks;

-- RLS: checklist_categories
CREATE POLICY "Staff can read categories in their outlet or global" ON checklist_categories
  FOR SELECT TO authenticated
  USING (
    outlet_id = auth_outlet_id() OR 
    outlet_id = '00000000-0000-0000-0000-000000000000'
  );

CREATE POLICY "SPV can manage all categories" ON checklist_categories
  FOR ALL TO authenticated
  USING (auth_is_supervisor());

-- RLS: checklist_items
CREATE POLICY "Staff can read items in their outlet or global" ON checklist_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checklist_categories c
    WHERE c.id = checklist_items.category_id AND (
      c.outlet_id = auth_outlet_id() OR 
      c.outlet_id = '00000000-0000-0000-0000-000000000000'
    )
  ));

CREATE POLICY "SPV can manage all items" ON checklist_items
  FOR ALL TO authenticated
  USING (auth_is_supervisor());

-- Ensure SPV can read/manage daily records and ticks for all outlets
CREATE POLICY "SPV can manage all records" ON daily_checklist_records
  FOR ALL TO authenticated
  USING (auth_is_supervisor());

CREATE POLICY "SPV can manage all ticks" ON daily_checklist_ticks
  FOR ALL TO authenticated
  USING (auth_is_supervisor());
