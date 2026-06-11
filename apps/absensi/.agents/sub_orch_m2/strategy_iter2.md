## Synthesized Implementation Strategy for M2 (Iter 2)

### Action Plan for `src/app/dashboard/layout.tsx`
1. **Auth Loading State**: Extract `loading` from `useAuth()`. If `loading` is true, return a full-screen loading spinner fallback before rendering the sidebar or evaluating route guards.
2. **Route Protection Bug**: Update the redirect logic for crew members. If `!loading && outletStaff && !isSPV`, check if the `pathname` is attempting to access restricted routes. If `pathname !== "/dashboard/kru" && pathname !== "/dashboard/profil"`, replace the route with `/dashboard/kru`.

### Action Plan for `src/app/dashboard/checklist/page.tsx`
1. **Infinite Spinner on Null Outlet**: In the `useEffect`, if `!outletStaff?.outlet_id`, immediately call `setLoading(false)` and return to prevent hanging on a spinner.
2. **UI Flicker on Mutation**: Modify `loadChecklists(showLoading = false)`. Only call `setLoading(true)` when `showLoading` is true (e.g. initial mount). Mutations (create, edit, delete) should call `loadChecklists(false)`.
3. **Missing Dependency**: Wrap `loadChecklists` in `useCallback` and add it to the `useEffect` dependency array.
4. **Nested Ordering**: Update the Supabase query to `.order('created_at', { foreignTable: 'checklist_items', ascending: true })` to prevent items from jumping.
5. **Timestamps**: Add `updated_at: new Date().toISOString()` to `.update()` payloads for categories and items.

### Pre-requisites (Important)
- A Challenger discovered that the `supabase/migrations/20260611000000_m1_absensi_checklist.sql` migration might not be applied to the running local Supabase instance.
- **Before running tests/builds**, run `npx supabase db push` (or `npm run supabase:push`, or `npx supabase migration up`) to ensure the DB schema is up-to-date and avoid `PGRST205` errors.

### Constraints
- Ensure no mock or dummy data is used. Code must genuinely interact with Supabase.
