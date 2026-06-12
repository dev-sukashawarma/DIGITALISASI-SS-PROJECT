## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Major] Finding 1: Cross-Outlet Data Anomaly on `daily_checklist_ticks`
- **What**: The RLS policy "Staff can manage ticks in their outlet" does not restrict `item_id` to the user's outlet.
- **Where**: `supabase/migrations/20260611000000_m1_absensi_checklist.sql`, lines 112-118.
- **Why**: An authenticated staff member from Outlet A can forge an `INSERT` request to create a tick linking a `record_id` from Outlet A with an `item_id` from Outlet B. The `WITH CHECK` policy only validates their access to `record_id`.
- **Suggestion**: Update the RLS policy for `daily_checklist_ticks` to also verify that `item_id` belongs to the same outlet. Alternatively, use a database trigger to enforce `record.outlet_id = item.category.outlet_id`.

### [Medium] Finding 2: Lack of `ticked_by` accountability enforcement
- **What**: Any staff member can set `ticked_by` to the UUID of a different staff member in the same outlet when inserting a tick.
- **Where**: `supabase/migrations/20260611000000_m1_absensi_checklist.sql`, lines 112-118.
- **Why**: The RLS policy for `daily_checklist_ticks` does not enforce `ticked_by = auth.uid()`. Since the prompt specifies "Sistem harus mencatat ID/Nama staf yang mencentang setiap item untuk akuntabilitas", allowing users to spoof this undermines the accountability requirement.
- **Suggestion**: Separate the `INSERT` policy from `SELECT/UPDATE/DELETE`. In the `INSERT` policy, enforce `WITH CHECK (ticked_by = auth.uid() AND ...)`. Keep `FOR ALL` or `FOR SELECT, UPDATE, DELETE` without the `ticked_by` restriction so users can still untick others' ticks.

### [Minor] Finding 3: Missing Index on Foreign Key for Cascade Delete
- **What**: `item_id` in `daily_checklist_ticks` lacks an explicit index.
- **Where**: `supabase/migrations/20260611000000_m1_absensi_checklist.sql`, lines 40-44.
- **Why**: `item_id` is defined with `ON DELETE CASCADE`. When an SPV deletes a `checklist_item`, Postgres must scan all `daily_checklist_ticks` to find and delete related ticks. The `UNIQUE(record_id, item_id)` index is prefixed by `record_id`, so it cannot be used to look up by `item_id`.
- **Suggestion**: Add `CREATE INDEX idx_daily_checklist_ticks_item_id ON daily_checklist_ticks(item_id);`

## Challenge Summary

**Overall risk assessment**: MEDIUM

## Challenges

### [Major] Challenge 1: Cross-Tenant Relational Integrity
- **Assumption challenged**: A user will only insert ticks for items in their own outlet.
- **Attack scenario**: An attacker inspects the network, grabs an `item_id` from another outlet (if leaked, or guessed), and inserts a tick connecting their own outlet's record to the victim outlet's item.
- **Blast radius**: The victim's checklist items are now externally referenced. Depending on query structures, this could leak data across outlets or crash client apps that expect strict 1:1 outlet mapping in joins.
- **Mitigation**: Implement strict relationship validation in RLS or triggers.

## Verified Claims
- Realtime publication `supabase_realtime` includes `daily_checklist_ticks` → verified via reading SQL → pass
- SPV can manage templates for their outlet → verified via RLS logic tracing → pass

## Unverified Items
- `supabase db reset` → Docker desktop is not running, but SQL syntax looks correct.
