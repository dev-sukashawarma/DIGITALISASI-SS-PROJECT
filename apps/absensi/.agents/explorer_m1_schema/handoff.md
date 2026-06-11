# M1 Database Schema Migration Plan

## 1. Observation
- `SCOPE.md` requires tables: `checklist_categories`, `checklist_items`, `daily_checklist_records`, `daily_checklist_ticks`.
- `ORIGINAL_REQUEST.md` requires SPV to manage checklist templates and crew to submit ticks, which should be synchronized via Supabase Realtime.
- `outlets` table has `id` (UUID).
- `outlet_staff` table has `id` (UUID), `outlet_id`, `role`, and is linked to `auth.uid()`.
- Realtime publication `supabase_realtime` is used in Supabase to stream changes.

## 2. Logic Chain
- **Categories & Items (Templates)**: Need per-outlet isolation. `checklist_categories` belongs to an outlet (`outlet_id`). `checklist_items` belong to categories. RLS: SPVs (`role IN ('spv', 'kepala_outlet')`) can perform ALL operations. All authenticated staff in the same outlet can SELECT.
- **Daily Records**: Grouping of ticks for a given day in an outlet. RLS: Staff can SELECT and ALL records for their outlet to allow creation when a day starts.
- **Ticks**: Records the action of checking an item. `ticked_by` references `outlet_staff.id`. RLS: Staff can SELECT, INSERT, UPDATE, DELETE (for unticking) ticks in their outlet.
- **Realtime**: `daily_checklist_ticks` must be added to `supabase_realtime` publication so kiosks receive immediate updates.

## 3. Caveats
- Unticking a checklist item can be handled either by DELETING the tick row or by having a status column. Standard practice for "ticks" is deleting the row. RLS allows DELETE.
- `auth.uid()` corresponds to `outlet_staff.id` per previous migrations (e.g. `outlet_staff_rls.sql`).

## 4. Conclusion
We will create `20260611000000_m1_absensi_checklist.sql` containing the schema and RLS policies below. Note: the actual migration file creation is left to the implementer.

Proposed SQL Content:
```sql
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
CREATE INDEX idx_daily_checklist_records_outlet_date ON daily_checklist_records(outlet_id, date);
CREATE INDEX idx_daily_checklist_ticks_record_id ON daily_checklist_ticks(record_id);

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
  USING (EXISTS (
    SELECT 1 FROM daily_checklist_records r
    JOIN outlet_staff s ON s.outlet_id = r.outlet_id
    WHERE r.id = daily_checklist_ticks.record_id AND s.id = auth.uid()
  ));

CREATE POLICY "Staff can manage ticks in their outlet" ON daily_checklist_ticks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM daily_checklist_records r
    JOIN outlet_staff s ON s.outlet_id = r.outlet_id
    WHERE r.id = daily_checklist_ticks.record_id AND s.id = auth.uid()
  ));

-- Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE daily_checklist_ticks;
```

## 5. Verification Method
- Use `supabase db reset` locally to verify tables and policies are created without syntax errors.
- Ensure that the tests for Supabase realtime and RLS pass successfully.
