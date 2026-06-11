-- 1. checklist_categories
CREATE TABLE checklist_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. checklist_items
CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES checklist_categories(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. daily_checklist_records
CREATE TABLE daily_checklist_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(outlet_id, date)
);

-- 4. daily_checklist_ticks
CREATE TABLE daily_checklist_ticks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES daily_checklist_records(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  ticked_by UUID REFERENCES outlet_staff(id) ON DELETE SET NULL,
  ticked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(record_id, item_id)
);

-- Indexes
CREATE INDEX idx_checklist_categories_outlet_id ON checklist_categories(outlet_id);
CREATE INDEX idx_checklist_items_category_id ON checklist_items(category_id);
-- No redundant index on daily_checklist_records(outlet_id, date)
CREATE INDEX idx_daily_checklist_ticks_record_id ON daily_checklist_ticks(record_id);
CREATE INDEX idx_daily_checklist_ticks_item_id ON daily_checklist_ticks(item_id);

-- Enable RLS
ALTER TABLE checklist_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checklist_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checklist_ticks ENABLE ROW LEVEL SECURITY;

-- RLS: checklist_categories
CREATE POLICY "Staff can read categories in their outlet" ON checklist_categories
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE outlet_staff.id = auth.uid() AND outlet_staff.outlet_id = checklist_categories.outlet_id
  ));

CREATE POLICY "SPV can manage categories in their outlet" ON checklist_categories
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE outlet_staff.id = auth.uid() 
      AND outlet_staff.outlet_id = checklist_categories.outlet_id
      AND outlet_staff.role IN ('spv', 'kepala_outlet')
  ));

-- RLS: checklist_items
CREATE POLICY "Staff can read items in their outlet" ON checklist_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checklist_categories c
    JOIN outlet_staff s ON s.outlet_id = c.outlet_id
    WHERE c.id = checklist_items.category_id AND s.id = auth.uid()
  ));

CREATE POLICY "SPV can manage items in their outlet" ON checklist_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checklist_categories c
    JOIN outlet_staff s ON s.outlet_id = c.outlet_id
    WHERE c.id = checklist_items.category_id 
      AND s.id = auth.uid() 
      AND s.role IN ('spv', 'kepala_outlet')
  ));

-- RLS: daily_checklist_records
CREATE POLICY "Staff can read records in their outlet" ON daily_checklist_records
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE outlet_staff.id = auth.uid() AND outlet_staff.outlet_id = daily_checklist_records.outlet_id
  ));

CREATE POLICY "Staff can manage records in their outlet" ON daily_checklist_records
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE outlet_staff.id = auth.uid() AND outlet_staff.outlet_id = daily_checklist_records.outlet_id
  ));

-- RLS: daily_checklist_ticks
CREATE POLICY "Staff can read ticks in their outlet" ON daily_checklist_ticks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_checklist_records r
      JOIN outlet_staff s ON s.outlet_id = r.outlet_id
      WHERE r.id = daily_checklist_ticks.record_id AND s.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM checklist_items i
      JOIN checklist_categories c ON c.id = i.category_id
      JOIN daily_checklist_records r ON r.outlet_id = c.outlet_id
      WHERE i.id = daily_checklist_ticks.item_id AND r.id = daily_checklist_ticks.record_id
    )
  );

CREATE POLICY "Staff can insert ticks in their outlet" ON daily_checklist_ticks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_checklist_records r
      JOIN outlet_staff s ON s.outlet_id = r.outlet_id
      WHERE r.id = daily_checklist_ticks.record_id AND s.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM checklist_items i
      JOIN checklist_categories c ON c.id = i.category_id
      JOIN daily_checklist_records r ON r.outlet_id = c.outlet_id
      WHERE i.id = daily_checklist_ticks.item_id AND r.id = daily_checklist_ticks.record_id
    )
    AND ticked_by = auth.uid()
  );

CREATE POLICY "Staff can update ticks in their outlet" ON daily_checklist_ticks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_checklist_records r
      JOIN outlet_staff s ON s.outlet_id = r.outlet_id
      WHERE r.id = daily_checklist_ticks.record_id AND s.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM checklist_items i
      JOIN checklist_categories c ON c.id = i.category_id
      JOIN daily_checklist_records r ON r.outlet_id = c.outlet_id
      WHERE i.id = daily_checklist_ticks.item_id AND r.id = daily_checklist_ticks.record_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_checklist_records r
      JOIN outlet_staff s ON s.outlet_id = r.outlet_id
      WHERE r.id = daily_checklist_ticks.record_id AND s.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM checklist_items i
      JOIN checklist_categories c ON c.id = i.category_id
      JOIN daily_checklist_records r ON r.outlet_id = c.outlet_id
      WHERE i.id = daily_checklist_ticks.item_id AND r.id = daily_checklist_ticks.record_id
    )
    AND ticked_by = auth.uid()
  );

CREATE POLICY "Staff can delete ticks in their outlet" ON daily_checklist_ticks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_checklist_records r
      JOIN outlet_staff s ON s.outlet_id = r.outlet_id
      WHERE r.id = daily_checklist_ticks.record_id AND s.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM checklist_items i
      JOIN checklist_categories c ON c.id = i.category_id
      JOIN daily_checklist_records r ON r.outlet_id = c.outlet_id
      WHERE i.id = daily_checklist_ticks.item_id AND r.id = daily_checklist_ticks.record_id
    )
  );

-- Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE daily_checklist_ticks;
