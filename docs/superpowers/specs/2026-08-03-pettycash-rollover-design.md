# Petty Cash Rollover Design Spec

## Context
Petty Cash top-ups completed after a shift is closed but before the next shift is opened are currently lost. The `open_shift` RPC strictly uses the previous shift's `actual_ending_petty_cash` and ignores any interim transactions, despite the frontend Kasir calculating them correctly.

## Architecture & Approach
We will use a **Database-Driven** approach. The `open_shift` RPC in Supabase will be modified to autonomously calculate interim transactions rather than blindly trusting the client or purely falling back to the previous shift's ending balance.

### Data Flow
1. **Kasir App:** User clicks "Buka Shift". App calls `rpc('open_shift')` passing `p_starting_petty_cash` (as a fallback).
2. **RPC Execution:**
   - Queries the last closed shift for `p_outlet_id`.
   - Records `v_last_ending` and `v_ref_time` (`end_time` or `updated_at`).
   - Queries `SUM(amount)` from `petty_cash_topups` where `completed_at > v_ref_time`.
   - Queries `SUM(amount)` from `petty_cash_expenses` where `created_at > v_ref_time`.
   - Calculates new starting balance: `v_last_ending + interim_topups - interim_expenses`.
3. **Database State:** The exact calculated balance is inserted into the new `shifts` row.

## Error Handling
- If no previous shift exists, fallback to the frontend-provided `p_starting_petty_cash`.
- Coalesce SUM queries to `0` to handle nulls when no interim transactions exist.
- Ensure amounts do not drop below `0`.

## Testing & Verification
- Apply the SQL migration.
- Manually correct the Cicurug `4be92cf8-b037-4f1b-a838-164395c0bff7` shift to `403500` via SQL.
- Future shift openings will correctly absorb any top-ups approved outside of business hours.
