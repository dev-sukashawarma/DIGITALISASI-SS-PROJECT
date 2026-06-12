# M2 Iteration 1 Failure Feedback

## Critical Issues (Must Fix)
1. **Security / Route Protection Bug (`src/app/dashboard/layout.tsx`)**:
   - The current check `if (outletStaff && !isSPV && pathname === "/dashboard")` only redirects exact matches for `/dashboard`. 
   - Non-SPV crew members can bypass this by navigating directly to `/dashboard/checklist` or `/dashboard/pengaturan` to access the SPV-only interface.
   - The guard must be updated to protect all SPV sub-routes (e.g., check `!pathname.startsWith('/dashboard/kru') && !pathname.startsWith('/dashboard/profil')`).
2. **Missing Auth Loading State (`src/app/dashboard/layout.tsx`)**:
   - `layout.tsx` doesn't utilize the `loading` state from `useAuth()`. This causes a flicker/flash where `outletStaff` is initially null, so the app briefly assumes the user is "crew" before the auth check completes.
   - Add a loading state (`if (loading) return <Spinner/>` or similar) before rendering the layout.
3. **Jarring UI Flicker on Mutation (`src/app/dashboard/checklist/page.tsx`)**:
   - `setLoading(true)` is tied to every refetch via `loadChecklists()`.
   - Since mutations (create, edit, delete) call `loadChecklists()`, the entire dashboard page is replaced by a `<Spinner />` during every action.
   - Separate the initial page load state (`loading`) from background refetching (perhaps don't set `loading` to true during `loadChecklists` if data already exists, or use a separate `isFetching` state).
4. **React Hooks Dependency (`src/app/dashboard/checklist/page.tsx`)**:
   - `loadChecklists` is omitted from the `useEffect` dependency array. Use `useCallback` or move the function inside `useEffect` if appropriate.
5. **Database Deletion Constraint (`src/app/dashboard/checklist/page.tsx`)**:
   - `handleDeleteCategory` assumes `ON DELETE CASCADE` exists for checklist items in the database. Ensure it handles deleting items first or verify if the database already cascades. (Hint: The DB schema does NOT cascade delete. You need to explicitly delete the child items before the category, or fix the migration). Wait, the M1 migration might not have `CASCADE`. The Worker should explicitly delete the child items first, just to be safe.

## Goal
Provide a comprehensive fix strategy addressing all the issues above. Do NOT write the code directly, output a strategy and handoff.
