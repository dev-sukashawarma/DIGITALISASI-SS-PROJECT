# M2 Iteration 2 - Explorer Handoff Report (Updated with Challenger Feedback)

## 1. Observation
I reviewed `iteration_1_feedback.md`, the Challenger addendum, and the files: `src/app/dashboard/layout.tsx` and `src/app/dashboard/checklist/page.tsx`.
- **Layout Route Protection**: `layout.tsx:31` uses a strict equality check `pathname === "/dashboard"` which allows crew to bypass and access `/dashboard/checklist` or `/dashboard/pengaturan`.
- **Layout Loading State**: `layout.tsx:10` extracts `outletStaff` but ignores the `loading` state from `useAuth()`.
- **Checklist UI Flicker**: `checklist/page.tsx:49` explicitly calls `setLoading(true)` on every refetch, replacing the whole UI with a spinner during mutations.
- **Checklist Hooks Dependency**: `checklist/page.tsx:43-46` `useEffect` calls `loadChecklists` but omits it from the dependency array.
- **Null Staff Infinite Load**: `checklist/page.tsx:44` returns early if `!outletStaff?.outlet_id` but leaves `loading` as `true` forever.
- **Nested Items Order**: The `supabase` query in `loadChecklists` does not order `checklist_items`, causing them to jump around visually after mutations.
- **Cascade Deletion**: The database DOES support `ON DELETE CASCADE`. Manual deletion of child items is not needed, contrary to earlier feedback.

## 2. Logic Chain
1. **Route Protection**: Use `pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/kru') && !pathname.startsWith('/dashboard/profil')` to redirect non-SPVs securely.
2. **Loading State**: Import `Spinner` in `layout.tsx`, extract `loading` from `useAuth()`, and block rendering until `loading === false` to prevent UI flicker.
3. **UI Flicker**: Refactor `loadChecklists` to accept a boolean `showSpinner` flag. Pass `true` during the initial `useEffect` load, and `false` during mutations (create/edit/delete).
4. **Hooks Dependency**: Wrap `loadChecklists` in `useCallback` with dependencies (`outletStaff?.outlet_id`, `supabase`, `toast`).
5. **Null Staff Infinite Load**: Update `useEffect` to `setLoading(false)` if `!outletStaff?.outlet_id` before returning, preventing infinite hanging.
6. **Nested Items Order**: Add `.order('id', { foreignTable: 'checklist_items', ascending: true })` (or `created_at`) to the Supabase fetch query to ensure consistent task ordering.
7. **Cascade Deletion**: Leave the `handleDeleteCategory` code largely as-is regarding deletion (no explicit child deletion query), relying on DB cascade.

## 3. Caveats
- Supabase v2 uses `foreignTable` for ordering nested items (or `referencedTable` in some beta versions). Ensure the exact argument works; usually, `.order('id', { foreignTable: 'checklist_items', ascending: true })` works perfectly.
- Ensure `Spinner` import path from `@suka/design-system` is valid in `layout.tsx`.

## 4. Conclusion
The initial iteration left functional and UX bugs. By fixing route checks in `layout.tsx`, managing `loading` states correctly across layout and page levels, adding stable ordering for nested SQL joins, and handling missing outlet ID edges, the app will become stable.

## 5. Verification Method
- **Routing**: Log in as a crew user, manually navigate to `/dashboard/checklist`. Must redirect to `/dashboard/kru`.
- **Flicker**: Edit a checklist item. The UI should stay stable without replacing the page with a spinner.
- **Ordering**: Add two tasks, edit the first one. It should remain at the top of the list.
- **Hanging UI**: Nullify the user's `outlet_id` in the DB and load the page. It should not spin infinitely.
- **Database**: Delete a category with items. It should successfully cascade and remove the category.
- **Pre-Test Step**: The DB migration for M1 might not have been applied to the local Supabase instance. Instruct the Worker to run `npx supabase db push` to ensure tables and cascade rules are properly synced before executing these tests.
