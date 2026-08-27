# Spec: Transfer HR Data on Outlet Change

## Objective
When an admin edits a user's assigned branch (outlet) in the `admin-dashboard`, the user's HR/Attendance data must be automatically migrated to the new branch. This ensures that the user can seamlessly clock in, clock out, and open cash registers at their new outlet without being blocked by records stuck at the old outlet. Financial and operational data (e.g., shifts, cash transactions, orders, petty cash) must NOT be moved to maintain accurate historical accounting for the old branch.

## Tech Stack
Next.js (App Router), Supabase (PostgreSQL), TypeScript.

## Commands
Build: `npm run build`
Dev: `npm run dev`

## Project Structure
`apps/admin-dashboard/src/app/api/users/[id]/route.ts` → The API endpoint handling user profile updates.

## Boundaries
- **Always:** Use `supabaseService` (Service Role Key) for these updates as they require bypassing RLS to update records across different outlets.
- **Always:** Wrap the updates in a sequential logic or transaction (if possible via RPC, but here we can just execute sequentially with `supabaseService`).
- **Never:** Modify financial tables like `shifts`, `cash_transaction`, `orders`, or `petty_cash_expenses`.
- **Ask first:** If there are active (open) `shifts` at the old branch, should we auto-close them? (For now, we leave them as is per instructions to only touch HR data).

## Success Criteria
- [ ] Admin changes user's outlet via `pos-admin/users` page.
- [ ] The `outlet_id` in `outlet_staff` is updated.
- [ ] The `outlet_id` in `attendance_logs` where `staff_id = userId` is updated to the new `outlet_id`.
- [ ] The `outlet_id` in `staff_outlets` where `staff_id = userId` is updated to the new `outlet_id` (so they can access the new branch on POS).

---

# Implementation Plan

## Goal
Automate the migration of HR & Attendance data to a new branch when an admin edits a user's assigned outlet, preventing blocks in clocking in or opening shifts at the new branch.

## Tasks
- [x] Task 1: Open `apps/admin-dashboard/src/app/api/users/[id]/route.ts`
  - Acceptance: File is ready for editing.
  - Verify: File exists.
- [x] Task 2: Add logic to update `attendance_logs` 
  - Acceptance: After updating `outlet_staff`, execute `supabaseService.from('attendance_logs').update({ outlet_id }).eq('staff_id', userId)`.
  - Verify: Code compiles and logs any errors without crashing the whole request if minor.
- [x] Task 3: Add logic to update `staff_outlets`
  - Acceptance: Execute `supabaseService.from('staff_outlets').update({ outlet_id }).eq('staff_id', userId)`. (If no existing record, we might need to upsert, but update is safer first. Actually, `staff_outlets` has `staff_id` and `outlet_id` as composite primary key. We should delete the old and insert the new to avoid conflict).
  - Verify: Code uses `.delete()` and `.insert()` or handles the composite key correctly.

## Done When
- [x] User's `attendance_logs` reflect the new `outlet_id`.
- [x] User's `staff_outlets` mappings reflect the new `outlet_id`.
- [x] User can successfully login and open kasir at the new outlet.
