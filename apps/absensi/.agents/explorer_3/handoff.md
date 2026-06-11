# Handoff Report

## Observation
I examined the `C:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\supabase\migrations\20260611000000_m1_absensi_checklist.sql` file.

The `UPDATE` policy for `daily_checklist_ticks` is defined as:
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

The `INSERT` policy for the same table is:
```sql
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
```

The feedback notes that the `UPDATE` policy's `WITH CHECK` clause verifies that the new `record_id` and `item_id` share the same outlet, but it omits the check to ensure that the user updating the record actually belongs to the outlet of the new `record_id`.

## Logic Chain
1. In Postgres RLS `UPDATE` policies, the `USING` clause checks the existing row, and the `WITH CHECK` clause validates the new row resulting from the update.
2. If `WITH CHECK` doesn't verify the user's membership in the new `record_id`'s outlet, a user could maliciously update a row to point to a valid `record_id` and `item_id` in a different outlet, even though they wouldn't be able to query it afterwards.
3. The `INSERT` policy's `WITH CHECK` already contains the correct verification: `EXISTS (SELECT 1 FROM daily_checklist_records r JOIN outlet_staff s ON s.outlet_id = r.outlet_id WHERE r.id = daily_checklist_ticks.record_id AND s.id = auth.uid())`.
4. We need to copy this condition into the `WITH CHECK` clause of the `UPDATE` policy.

## Caveats
No caveats. The required fix is straightforward and aligns precisely with the provided feedback.

## Conclusion
The `UPDATE` policy for `daily_checklist_ticks` must be modified so that its `WITH CHECK` clause includes the validation of the user's `outlet_staff` record against the `record_id`. 

Here is the proposed revised SQL for the `UPDATE` policy:

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

## Verification Method
After applying the change, test the RLS by attempting to update an existing `daily_checklist_ticks` record to point to a `record_id` that belongs to an outlet where the authenticated user is not a staff member. The operation should be rejected by the RLS policy.
