# M2 Iteration 2 Fix Strategy Handoff

## Observation
I investigated `src/app/dashboard/layout.tsx` and `src/app/dashboard/checklist/page.tsx` against the Iteration 1 feedback and the Challenger addendum.

1. **`layout.tsx` (Lines 30-34)**: The route protection `if (outletStaff && !isSPV && pathname === "/dashboard")` only redirects exact matches. It also does not extract or use `loading` from `useAuth()`.
2. **`checklist/page.tsx` (Lines 30, 48-62)**: `loading` is set to `true` globally. `loadChecklists` calls `setLoading(true)` on every invocation, causing full-page flicker on mutations. `loadChecklists` is missing from `useEffect` dependencies (Line 43).
3. **`checklist/page.tsx` (Lines 50-54)**: The supabase query fetches `checklist_items` but does not order them, causing random jumping in UI.
4. **`checklist/page.tsx` (Line 44)**: `if (!outletStaff?.outlet_id) return;` leaves `loading` as `true` indefinitely if a user lacks an outlet or if `outletStaff` is null.
5. **Addendum**: `CASCADE` delete is verified to be present in the DB, so explicit deletion of `checklist_items` is unnecessary.

## Logic Chain
1. **Fixing Security Guard**: Non-SPV (crew) should only access `/dashboard/kru` and `/dashboard/profil`. The condition should check: `if (!loading && outletStaff && !isSPV)`. If `pathname` doesn't start with `/dashboard/kru` and doesn't start with `/dashboard/profil`, redirect to `/dashboard/kru`.
2. **Fixing Layout Flicker**: Extract `loading` from `useAuth()` in `layout.tsx`. If `loading` is true, return a fallback spinner view before rendering the layout structure or evaluating the route protection guard.
3. **Fixing Checklist Flicker**: In `page.tsx`, modify `loadChecklists(showLoading = false)`. Only pass `true` on the initial mount in `useEffect`. Mutations (create, edit, delete) will call `loadChecklists(false)`, avoiding the full-page spinner.
4. **Fixing Hooks Dependency**: Wrap `loadChecklists` in `useCallback` with `[outletStaff, supabase, toast]` dependencies, and include it in the `useEffect` array.
5. **Fixing Nested Ordering**: Append `.order('created_at', { foreignTable: 'checklist_items', ascending: true })` to the Supabase query in `loadChecklists`.
6. **Fixing Infinite Loading**: In `page.tsx`'s `useEffect`, if `outletStaff` is resolved as falsy or lacks an `outlet_id`, immediately call `setLoading(false)` to prevent the UI from hanging.
7. **Updating Timestamps**: In `handleSaveCategory` and `handleSaveItem`, append `updated_at: new Date().toISOString()` to the `.update()` payloads.
8. **Deletion**: Keep `handleDeleteCategory` as is. The addendum confirmed `CASCADE` delete handles the child items.
9. **Database Synchronization**: Before testing, the implementer MUST apply DB migrations to the local Supabase instance using `npx supabase db push` from the monorepo root or database directory, to avoid `PGRST205` errors caused by unapplied M1 migrations.

## Caveats
- `useAuth()` in `layout.tsx` is assumed to return a `loading` state.
- Since `@suka/design-system`'s `Spinner` is not imported in `layout.tsx`, the implementer should use a simple inline Tailwind spinner or import it from the design system if available.

## Conclusion
The bugs stem from missing route guard prefixes, unhandled loading states in both context and data fetching, and missing order clauses. The fix strategy fully covers all Iteration 1 feedback and the Challenger addendum without requiring manual deletion logic for checklist items.

## Verification Method
- **Layout Guard**: Sign in as crew, manually navigate to `/dashboard/checklist`. Must be redirected to `/dashboard/kru`.
- **Layout Flicker**: Refresh `/dashboard`. No flash of "Beranda Saya" before switching to SPV view.
- **Checklist Flicker**: Add a new checklist category. The items should update instantly without replacing the page with a spinner.
- **Checklist Order**: Edit an item. It must remain in the same position in the list.
- **Infinite Loading**: Sign out or remove `outletStaff` access; the checklist page must not hang on a spinner indefinitely.
