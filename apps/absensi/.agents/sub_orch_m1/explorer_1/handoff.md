# Handoff: M1 Database Schema (Iteration 2)

## 1. Observation
- The previous implementation in `supabase/migrations/20260611000000_m1_absensi_checklist.sql` lacked comprehensive RLS checks for `daily_checklist_ticks` preventing cross-outlet data anomalies on `SELECT`, `UPDATE` (USING), and `DELETE` (USING).
- It also did not enforce accountability `WITH CHECK (ticked_by = auth.uid())` universally if `UPDATE` was used.
- The user requested omitting a redundant index (`UNIQUE(outlet_id, date)` naturally creates one) and including a cascade-delete index on `item_id`.

## 2. Logic Chain
1. To address the cross-outlet anomaly comprehensively, `daily_checklist_ticks` RLS policies must verify that BOTH `record_id` and `item_id` belong to the same outlet, and the user must belong to that outlet.
2. By adding `AND EXISTS (SELECT 1 FROM checklist_items i JOIN checklist_categories c ... WHERE i.id = item_id AND r.id = record_id)` to the `USING` and `WITH CHECK` clauses across `SELECT`, `INSERT`, `UPDATE`, and `DELETE`, we ensure no data leakage or malicious edits across outlets.
3. Adding `AND ticked_by = auth.uid()` to `WITH CHECK` on both `INSERT` and `UPDATE` prevents users from impersonating another user when creating or modifying a tick.
4. Omitting the explicit index on `(outlet_id, date)` and adding one on `item_id` solves the index redundancy and full-table scan problems respectively.

## 3. Caveats
- `daily_checklist_records` RLS currently allows any staff to manage records in their outlet. The requirement doesn't specify limiting it to SPV, so it's left as is.
- The `item_id` and `record_id` cross-outlet validation assumes `checklist_categories` and `daily_checklist_records` are strictly bound to `outlet_id`. The schema enforces this.
- If an item's category is moved to a different outlet (which shouldn't happen normally), historical ticks might be affected.

## 4. Conclusion
The proposed schema fully resolves the previous iteration's feedback, securely tying both `item_id` and `record_id` to the user's outlet, enforcing `ticked_by = auth.uid()`, and ensuring optimal indexing. 

## 5. Verification Method
- Code is available in `C:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\absensi\.agents\sub_orch_m1\explorer_1\proposed_migration.sql`.
- The Implementer should copy this proposed content into the target migration file: `C:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\supabase\migrations\20260611000000_m1_absensi_checklist.sql`.
- Run `npx supabase migration up` to test the application locally and check for warnings.
