# Code Audit Fixes — Implementation Notes

**Date:** 2026-06-17  
**Scope:** Fix 4 apps (stok, distribusi, owner-dashboard, portal); Document 2 apps for team (absensi, pos-kasir)

---

## PART A: FIXES FOR MAIN APPS (stok, distribusi, owner-dashboard, portal)

### App: `stok`

#### Issue 1: N+1 Query in `fetchOutletItemsDetail()`

**File:** `apps/stok/src/lib/queries/monitoring.ts` (lines 358-378)

**Problem:**
```typescript
// BEFORE: Creates N separate queries (1 per item for ledger history)
const enriched = await Promise.all(
  dedupedItems.map(async (it) => {
    const { data: ledger } = await supabase
      .from('ledger_feed_spv')
      .select(...)
      .eq('outlet_id', outletId)
      .eq('bahan_baku_id', it.bahan_baku_id)  // Individual query per item
      .limit(5);
```

**Fix:** Batch fetch all ledger entries, then map client-side

```typescript
// AFTER: 1 query for all items
const { data: allLedgers } = await supabase
  .from('ledger_feed_spv')
  .select('bahan_baku_id, tipe, qty, catatan, created_at')
  .eq('outlet_id', outletId)
  .in('bahan_baku_id', dedupedItems.map(i => i.bahan_baku_id))
  .order('created_at', { ascending: false });

// Group ledger by bahan_baku_id on client
const ledgerMap = new Map<string, typeof allLedgers>();
allLedgers?.forEach(l => {
  const key = l.bahan_baku_id;
  if (!ledgerMap.has(key)) ledgerMap.set(key, []);
  ledgerMap.get(key)!.push(l);
});

const enriched = dedupedItems.map((it): OutletDetailItem => ({
  ...it,
  ledger: ledgerMap.get(it.bahan_baku_id) || [],
}));
```

---

### App: `distribusi`

#### Issue 1: N+1 Query in `SuratJalanList.tsx`

**File:** `apps/distribusi/src/components/distribusi/SuratJalanList.tsx` (lines 50-59)

**Problem:**
```typescript
// BEFORE: N queries (1 per item)
const itemsWithBahan = await Promise.all(
  items.map(async (item) => {
    const { data: bahan } = await supabase
      .from('bahan_baku')
      .select('nama, satuan')
      .eq('id', item.bahan_baku_id)  // Individual query
      .single();
```

**Fix:** Batch fetch all bahan_baku, then map

```typescript
// AFTER: 1 query for all items
const bahanIds = [...new Set(items.map(i => i.bahan_baku_id))];
const { data: bahanBakuList } = await supabase
  .from('bahan_baku')
  .select('id, nama, satuan')
  .in('id', bahanIds);

const bahanMap = new Map(bahanBakuList?.map(b => [b.id, b]) ?? []);

const itemsWithBahan = items.map(item => ({
  ...item,
  bahan: bahanMap.get(item.bahan_baku_id),
}));
```

---

### App: `owner-dashboard`

**Status:** No HIGH severity issues found in audit.

**Action:** Just remove any stray `console.log()` calls before deployment.

**Command:**
```bash
cd apps/owner-dashboard
grep -r "console\." src/ | grep -v ".test\|.spec"
# If found, remove them
```

---

### App: `portal`

**Status:** No HIGH severity issues found in audit.

**Action:** Verify tsconfig `baseUrl` is present (should be based on earlier audit).

---

---

## PART B: DETAILED NOTES FOR YOUR FRIEND (absensi, pos-kasir)

### 📝 TEAM NOTES: `absensi` App

**Assignee:** [Your friend's name]  
**Deadline:** Before deployment to `absensi.sukashawarma.com`

#### Issue 1: Missing Auth Check in API Route
**File:** `apps/absensi/src/app/api/checklist/categories/route.ts`

**Problem:** API returns ANY outlet's checklist data without verifying user belongs to that outlet.

```typescript
// INSECURE: No RLS verification
export async function POST(req: Request) {
  const { outlet_id } = await req.json();
  // User can guess outlet_id and fetch ANY outlet's data
  const { data } = await supabaseAdmin
    .from('checklist_categories')
    .select(...)
    .eq('outlet_id', outlet_id)  // ❌ No permission check!
```

**Fix:** Add user session check before querying

```typescript
// SECURE: Verify user belongs to outlet
export async function POST(req: Request) {
  const { data: { user } } = await supabase.auth.getUser();
  const { outlet_id } = await req.json();
  
  // Verify user's outlet matches request
  const { data: staff } = await supabaseAdmin
    .from('outlet_staff')
    .select('outlet_id')
    .eq('id', user.id)
    .single();
  
  if (staff?.outlet_id !== outlet_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Now safe to query
  const { data } = await supabaseAdmin...
```

**Locations to fix:**
- `api/checklist/categories/route.ts`
- Any other API routes in `api/` folder (check all POST/GET/PUT endpoints)

---

#### Issue 2: Missing Input Validation in `submit-attendance/route.ts`
**File:** `apps/absensi/src/app/api/submit-attendance/route.ts` (lines 32-49)

**Problem:** Crashes if `cfg.jam_masuk` is null

```typescript
// UNSAFE: cfg.jam_masuk could be null
const [h, m] = cfg.jam_masuk.split(":").map(Number);
// Crashes: "Cannot read property 'split' of null"
```

**Fix:** Add defensive null check

```typescript
// SAFE: Handle null/undefined
const jam_masuk = cfg.jam_masuk || "08:00";
const jam_keluar = cfg.jam_keluar || "17:00";
const [h, m] = jam_masuk.split(":").map(Number);
const [hOut, mOut] = jam_keluar.split(":").map(Number);
```

---

#### Issue 3: Console.error Calls in Components
**Files:**
- `src/app/dashboard/kru-checklist/page.tsx` (lines 109, 126, 142)
- `src/features/clock/useClockKiosk.ts` (line 195)

**Problem:** Debug console.error visible in production logs

**Fix:** Remove or gate behind dev-only check

```typescript
// Option 1: Remove entirely
// console.error('Error:', err);  // ❌ DELETE THIS

// Option 2: Dev-only logging
if (process.env.NODE_ENV === 'development') {
  console.error('Error:', err);
}
```

**Quick fix command:**
```bash
cd apps/absensi
grep -n "console\.error\|console\.log" src/**/*.ts* src/**/*.tsx
# Delete all found lines (unless you need dev logging)
```

---

#### Issue 4: Missing Error Boundaries

**Action:** Wrap data-fetching pages with error boundary

```typescript
// app/dashboard/page.tsx or other data-fetching pages
import { ErrorBoundary } from '@/components/error-boundary';

export default function Page() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <DashboardContent />
    </ErrorBoundary>
  );
}
```

---

### 📝 TEAM NOTES: `pos-kasir` App

**Assignee:** [Your friend's name]  
**Deadline:** Before deployment to `pos-kasir.sukashawarma.com`

#### Issue 1: Console.error in Production API Routes
**Files:**
- `app/api/checkout/route.ts` (line 156, +2 more)
- `app/api/zip-upload/route.ts` (multiple)
- Other API routes

**Problem:** Debug error logs visible in production

```typescript
// UNSAFE: Logs to stdout/stderr
if (orderError || !order) {
  console.error('Order creation error:', orderError);  // ❌ Remove
```

**Fix:**
```typescript
// Option 1: Remove
// No console.error

// Option 2: Use structured error logging
if (process.env.NODE_ENV === 'development') {
  console.error('Order creation error:', orderError);
}

// Option 3: Send to error tracking service
logError('Order creation failed', { orderError });
```

**Quick audit:**
```bash
cd apps/pos-kasir
grep -rn "console\." app/api/
# Remove all found (or gate with NODE_ENV check)
```

---

#### Issue 2: Empty Catch Blocks (Silent Failures)
**File:** `app/api/checkout/route.ts` (lines 69-72, etc.)

**Problem:** Errors silently ignored, no user feedback

```typescript
// UNSAFE: Silent failure
try {
  await supabase.storage.from(BUCKET).remove([path])
} catch {
  // ❌ Error silently ignored, image not deleted
}
```

**Fix:**
```typescript
// SAFE: Handle error explicitly
try {
  await supabase.storage.from(BUCKET).remove([path])
} catch (error) {
  console.error('Failed to delete image:', error);
  // Retry logic or return error to client
  return NextResponse.json(
    { error: 'Gagal menghapus gambar, coba lagi' },
    { status: 500 }
  );
}
```

**Locations:**
- Search all `app/api/` routes for empty `catch {}`
- Replace with proper error handling or logging

---

#### Issue 3: Race Condition in Order Status Updates
**File:** `app/kasir/page.tsx` (lines 141-160)

**Problem:** Optimistic UI update without rollback on failure

```typescript
// UNSAFE: UI shows "preparing" even if DB fails
async function markAsPreparing(id: string) {
  setOrders(prev => prev.map(o => 
    o.id === id ? { ...o, status: 'preparing' } : o
  ));  // UI updated immediately
  
  const { error } = await supabase
    .from('orders')
    .update({ status: 'preparing' })
    .eq('id', id);
  
  if (error) {
    // ❌ Doesn't rollback UI!
    return;
  }
}
```

**Fix:**
```typescript
// SAFE: Rollback on failure
async function markAsPreparing(id: string) {
  const previousOrders = orders;
  
  // Optimistic update
  setOrders(prev => prev.map(o => 
    o.id === id ? { ...o, status: 'preparing' } : o
  ));
  
  const { error } = await supabase
    .from('orders')
    .update({ status: 'preparing' })
    .eq('id', id);
  
  if (error) {
    // Rollback on error
    setOrders(previousOrders);
    toast.error('Gagal mengubah status pesanan');
    return;
  }
}
```

---

#### Issue 4: Unvalidated JSON.parse() (7+ locations)
**Files:**
- `app/kasir/menu/page.tsx` (lines 66-69)
- `app/admin/menu/page.tsx` (lines 73, 79)
- `app/page.tsx` (lines 52, 64)
- `app/menu/[id]/page.tsx` (lines 66, 69)

**Problem:** No validation of parsed JSON structure

```typescript
// UNSAFE: No schema validation
try {
  setBestsellers(b?.value ? JSON.parse(b.value) : [])
} catch {
  setBestsellers([])
}
// If b.value is { foo: "bar" } (not array), setBestsellers gets object not array
```

**Fix:** Use Zod validation

```typescript
// Install Zod (if not already): npm install zod
import { z } from 'zod';

const bestsellersSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  count: z.number(),
}));

try {
  const parsed = JSON.parse(b?.value || '[]');
  const validated = bestsellersSchema.parse(parsed);
  setBestsellers(validated);
} catch (error) {
  console.error('Invalid bestsellers data:', error);
  setBestsellers([]);
}
```

---

#### Issue 5: Missing Menu Item Validation
**File:** `app/api/checkout/route.ts` (lines 69-72)

**Problem:** Orders created with non-existent menu_item_ids

```typescript
// UNSAFE: Doesn't verify menu items exist
const menuItemIds = payload.items.map(i => i.menu_item_id);
const { data: menuItems } = await supabase
  .from('menu_items')
  .select('id, price')
  .in('id', menuItemIds);
// If menuItems is empty but code proceeds, creates orphaned order items

// Then proceeds to create order without checking count matches
```

**Fix:**
```typescript
// SAFE: Verify items exist
const menuItemIds = payload.items.map(i => i.menu_item_id);
const { data: menuItems } = await supabase
  .from('menu_items')
  .select('id, price')
  .in('id', menuItemIds);

// Verify count matches
if (!menuItems || menuItems.length !== menuItemIds.length) {
  return NextResponse.json(
    { error: 'Beberapa item menu tidak ditemukan' },
    { status: 400 }
  );
}

// Now safe to create order
```

---

#### Issue 6: Audio Error Not Handled
**File:** `app/kasir/page.tsx` (line 55)

**Problem:** Audio playback fails silently

```typescript
// UNSAFE: Silent failure
a.play().then(() => { a.pause(); a.currentTime = 0 }).catch(() => {})
```

**Fix:**
```typescript
// SAFE: Log and handle
a.play()
  .then(() => { a.pause(); a.currentTime = 0 })
  .catch((error) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Audio playback failed:', error);
    }
    // Optionally notify user that notification didn't play
  });
```

---

#### Checklist for pos-kasir Fixes

- [ ] Remove all `console.error()` / `console.log()` from `app/api/` routes
- [ ] Add error handling to all empty `catch {}` blocks
- [ ] Fix race condition in `markAsPreparing()` with rollback
- [ ] Add Zod validation for all `JSON.parse()` calls
- [ ] Add menu item validation in `/api/checkout`
- [ ] Add audio error logging
- [ ] Test checkout flow end-to-end
- [ ] Test menu updates with various data types
- [ ] Verify no console errors in production build

---

## Deployment Checklist After Fixes

**For main team (4 apps):** stok, distribusi, owner-dashboard, portal
- [ ] Run `yarn type-check` per app — must pass
- [ ] Run `yarn build` per app — must succeed
- [ ] Commit all fixes
- [ ] Ready for deployment

**For your friend (2 apps):** absensi, pos-kasir
- [ ] Complete all fixes listed above
- [ ] Run `yarn type-check` — must pass
- [ ] Run `yarn build` — must succeed
- [ ] Push fixes to repo
- [ ] Notify main team when ready for deployment

---

**Notes:**
- All fixes should be committed to `main` branch
- Type-check must pass before deployment
- Build must succeed without errors
- No breaking changes to routes or APIs

Last updated: 2026-06-17
