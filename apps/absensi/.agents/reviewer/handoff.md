# Handoff Report: Review M2 (SPV Dashboard)

## Observation
1. In `src/app/dashboard/layout.tsx`, lines 30-34, the redirection logic for non-SPV users is:
   `if (outletStaff && !isSPV && pathname === "/dashboard") { router.replace("/dashboard/kru"); }`
2. In `src/app/dashboard/checklist/page.tsx`, lines 48-62, `loadChecklists()` calls `setLoading(true)` at the start and `setLoading(false)` at the end. This function is called not only on initial load (via `useEffect`), but also sequentially at the end of every mutation function (`handleSaveCategory`, `handleDeleteCategory`, `handleSaveItem`, `handleDeleteItem`).
3. In `checklist/page.tsx`, `loading` dictates the entire page render: `if (loading) return <div className="p-8 flex justify-center"><Spinner /></div>;`.
4. In `checklist/page.tsx`, `loadChecklists` is omitted from the `useEffect` dependency array on line 46.
5. Build commands `npm run build` and `npx next lint` failed due to corrupted `node_modules` caches (multiple lockfiles / missing Next.js binaries) on the host environment, rather than actual code errors.

## Logic Chain
1. The layout routing restriction strictly matches `pathname === "/dashboard"`. If a non-SPV (crew) user visits `/dashboard/checklist` directly, the condition evaluates to false, and the layout renders the page. `checklist/page.tsx` does not implement its own role-based guard, meaning crew members have unauthorized access to SPV operations.
2. Because `setLoading(true)` is invoked on every data refresh, any UI action (creating, editing, or deleting a category or item) replaces the entire dashboard view with a spinner. This causes a jarring screen flicker and interrupts the user experience.
3. The omission of `loadChecklists` in the `useEffect` dependencies violates `react-hooks/exhaustive-deps`. While it functions safely due to React's behavior without `useCallback`, it is a code-quality issue.
4. If a category is deleted without `ON DELETE CASCADE` configured in Supabase, the deletion will fail. The frontend code gracefully catches this (`if (error) toast.show("err")`), so this is safe assuming correct DB policies.

## Caveats
- I could not verify types via `tsc` or Next.js build due to host environment NPM/TypeScript resolution corruption. Code was reviewed statically.
- I am assuming `ON DELETE CASCADE` is set up on the Supabase database for `checklist_items.category_id`. If not, users cannot delete categories that contain items.

## Conclusion
**Verdict: REQUEST_CHANGES**
1. **[Critical Security] Incomplete Route Protection**: `layout.tsx` must guard all SPV paths (e.g., `pathname !== "/dashboard/kru" && pathname !== "/dashboard/profil"`), not just the root `/dashboard`.
2. **[Major UX] Full-page Reload on Mutations**: `checklist/page.tsx` should separate initial loading state from background refreshing state to prevent the entire UI from disappearing into a `<Spinner />` on every save/delete.

## Verification Method
1. Log in as a `kru` role and manually navigate to `http://localhost:3000/dashboard/checklist`. The app must redirect you away.
2. Log in as `spv`, go to Checklist Management, and add a new category. The page should not flash entirely blank/spinner during the operation.
