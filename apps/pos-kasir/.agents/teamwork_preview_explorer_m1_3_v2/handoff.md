# Handoff Report: Milestone 1 Implementation Plan

## 1. Observation
- The milestone scope in `SCOPE.md` outlines creating an attendance wait screen at `app/attendance/page.tsx` that listens to `attendance_events` via Supabase Realtime Broadcast.
- `app/api/attendance/webhook/route.ts` is implemented and broadcasts the payload: `{ email, password, outlet_id, branch_name, cashier_name }` to the `attendance_events` channel.
- `app/login/page.tsx` uses `supabase.auth.signInWithPassword({ email, password })` to authenticate users.
- The dashboard navigation (`components/KasirNav.tsx`) currently displays the `brandName` and an `outletName` fetched via the `useMyOutlet` hook.
- The `app/attendance/` directory does not currently exist.

## 2. Logic Chain
1. The wait screen (`app/attendance/page.tsx`) needs to be created as a client component to listen for realtime events.
2. It can subscribe to the `attendance_events` channel using `supabase.channel('attendance_events')` and listen for the `attendance_login` broadcast event.
3. Upon receiving the payload, it must extract the credentials and call `supabase.auth.signInWithPassword({ email, password })`.
4. Since the payload includes `cashier_name` and `branch_name` which must be displayed in the dashboard, the easiest way to persist this state across the redirect to `/kasir` is by saving them to `localStorage` (e.g., `localStorage.setItem('cashier_name', cashier_name)`).
5. The `components/KasirNav.tsx` file is the optimal place to display this information on the dashboard. We can use a `useEffect` hook to read `cashier_name` (and potentially `branch_name`) from `localStorage` and display it in the sidebar alongside the existing outlet details.

## 3. Caveats
- Passing credentials via Supabase Broadcast is a security risk if RLS is not properly configured (as already noted in the webhook code), but this is acceptable for the prototype scope.
- Relying on `localStorage` means the cashier name might persist even if a different user logs in manually, so `localStorage` should ideally be cleared upon explicit logout (in `KasirNav.tsx` `handleLogout()`).

## 4. Conclusion
**Implementation Plan**:
1. **Create `app/attendance/page.tsx`**:
   - `use client` component.
   - Initialize `supabase = createClient()`.
   - Setup a `useEffect` with `supabase.channel('attendance_events').on('broadcast', { event: 'attendance_login' }, async (payload) => { ... }).subscribe()`.
   - In the callback, perform `await supabase.auth.signInWithPassword({ email, password })`.
   - Save `cashier_name` and `branch_name` to `localStorage`.
   - Call `router.push('/kasir')` on success.
2. **Update `components/KasirNav.tsx`**:
   - Add state: `const [cashierName, setCashierName] = useState<string | null>(null)`.
   - Read from `localStorage` in `useEffect`: `setCashierName(localStorage.getItem('cashier_name'))`.
   - Render `{cashierName}` below the existing `{outletName}` text in the sidebar and mobile header.
   - Update `handleLogout` to call `localStorage.removeItem('cashier_name')` and `localStorage.removeItem('branch_name')`.

## 5. Verification Method
- **Run the development server** (`npm run dev`).
- **Open `/attendance`** in the browser.
- **Send a mock webhook** via `curl` or Postman to `/api/attendance/webhook` with the JSON payload.
- **Observe** the `/attendance` page redirecting to `/kasir`.
- **Inspect** the dashboard sidebar to confirm that the `cashier_name` and `branch_name` are displayed correctly.
