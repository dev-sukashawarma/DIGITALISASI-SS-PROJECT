# Handoff Report: M1 Database Schema Iteration 3

## 1. Observation
In `C:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\supabase\migrations\20260611000000_m1_absensi_checklist.sql`, the RLS policy for `UPDATE` on `daily_checklist_ticks` (lines 130-148) is currently defined as:

```sql
CREATE POLICY "Staff can update ticks in their outlet" ON daily_checklist_ticks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_checklist_records r
      JOIN outlet_staff s ON s.outlet_id = r.outlet_id
      WHERE r.id = daily_checklist_ticks.record_id AND s.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM checklist_items i
      JOIN checklist_categories c ON c.id = i.category_id
      JOIN daily_checklist_records r ON r.outlet_id = c.outlet_id
      WHERE i.id = daily_checklist_ticks.item_id AND r.id = daily_checklist_ticks.record_id
    )
    AND ticked_by = auth.uid()
  );
```

The `WITH CHECK` clause ensures the `item_id` and `record_id` exist and belong to the same outlet, but it omits the check that the user (`auth.uid()`) is actually staff at that outlet.

## 2. Logic Chain
- The `USING` clause correctly filters rows the user is allowed to *find* for updating (checks if the existing `record_id` is in their outlet).
- The `WITH CHECK` clause runs *after* the update to validate the new row data.
- Because `WITH CHECK` doesn't enforce the `outlet_staff` relationship on the new `record_id`, a malicious or misconfigured update could change the `record_id` to point to a valid record from *another* outlet, effectively transferring the tick across outlets.
- To prevent this, the `WITH CHECK` clause must include the exact same `outlet_staff` validation used in the `INSERT` policy.

## 3. Caveats
- No caveats. The missing clause is clear and the requested fix is direct.

## 4. Conclusion
The `UPDATE` policy on `daily_checklist_ticks` must be updated to mirror the `INSERT` policy's `WITH CHECK` clause.

### Proposed Code Changes

Modify `C:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\supabase\migrations\20260611000000_m1_absensi_checklist.sql` (lines 130-148) to match the following snippet:

```sql
CREATE POLICY "Staff can update ticks in their outlet" ON daily_checklist_ticks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_checklist_records r
      JOIN outlet_staff s ON s.outlet_id = r.outlet_id
      WHERE r.id = daily_checklist_ticks.record_id AND s.id = auth.uid()
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
```

## 5. Verification Method
- Ensure the `WITH CHECK` block has the `EXISTS` check on `daily_checklist_records` joined with `outlet_staff` where `s.id = auth.uid()`.
- Validate this fix by applying the migration to a local or staging Supabase instance and attempting to issue an `UPDATE` on a tick, setting `record_id` to a valid record in a different outlet. The database should reject the `UPDATE` with a row-level security policy violation.
