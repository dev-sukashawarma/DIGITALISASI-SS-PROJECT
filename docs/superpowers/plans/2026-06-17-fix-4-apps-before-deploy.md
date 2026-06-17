# Fix 4 Apps Before Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix HIGH severity issues in stok, distribusi, owner-dashboard, portal before deploying to production.

**Issues to fix:**
1. **stok:** N+1 query in `fetchOutletItemsDetail()` (performance bottleneck)
2. **distribusi:** N+1 query in `SuratJalanList.tsx` (performance bottleneck)
3. **owner-dashboard:** Remove console.log calls
4. **portal:** Verify tsconfig baseUrl, remove console.logs

**Architecture:** Per-app fixes, sequential task execution. Each app has independent issues — can be parallelized if needed.

**Tech Stack:** Next.js 16, TypeScript, Supabase client.

---

## Task 1: Fix stok N+1 Query

**File:** `apps/stok/src/lib/queries/monitoring.ts`

- [ ] **Step 1: Read current fetchOutletItemsDetail function**

```bash
cd "D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT"
# Read the function to understand current structure
```

- [ ] **Step 2: Identify the N+1 pattern (lines 358-378)**

Current pattern uses `.map(async...)` which creates individual queries per item.

- [ ] **Step 3: Replace with batch fetch approach**

Replace the ledger fetching loop with:

```typescript
// First, batch fetch all ledger entries for all items
const bahanBakuIds = dedupedItems.map(it => it.bahan_baku_id);

const { data: allLedgers, error: ledgerError } = await supabase
  .from('ledger_feed_spv')
  .select('bahan_baku_id, tipe, qty, catatan, created_at')
  .eq('outlet_id', outletId)
  .in('bahan_baku_id', bahanBakuIds)
  .order('created_at', { ascending: false });

if (ledgerError) throw ledgerError;

// Group ledger entries by bahan_baku_id on client
const ledgerMap = new Map<string, typeof allLedgers>();
allLedgers?.forEach(entry => {
  const key = entry.bahan_baku_id;
  if (!ledgerMap.has(key)) ledgerMap.set(key, []);
  ledgerMap.get(key)!.push(entry);
});

// Map items with their ledger history
const enriched = dedupedItems.map((it): OutletDetailItem => ({
  ...it,
  ledger_history: ledgerMap.get(it.bahan_baku_id)?.slice(0, 5) || [],
}));
```

- [ ] **Step 4: Test that type-check passes**

```bash
cd apps/stok
yarn type-check
```

Expected: No new type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/lib/queries/monitoring.ts
git commit -m "perf(stok): replace N+1 query with batch ledger fetch in fetchOutletItemsDetail"
```

---

## Task 2: Fix distribusi N+1 Query

**File:** `apps/distribusi/src/components/distribusi/SuratJalanList.tsx`

- [ ] **Step 1: Locate the problematic Promise.all pattern (lines 50-59)**

Current code maps over items and makes individual supabase queries.

- [ ] **Step 2: Replace with batch fetch**

```typescript
// Get unique bahan_baku IDs
const bahanBakuIds = [...new Set((items || []).map(i => i.bahan_baku_id))];

// Batch fetch all bahan_baku in ONE query
const { data: bahanBakuList, error: bahanError } = await supabase
  .from('bahan_baku')
  .select('id, nama, satuan')
  .in('id', bahanBakuIds);

if (bahanError) throw bahanError;

// Create lookup map
const bahanMap = new Map(
  bahanBakuList?.map(b => [b.id, { nama: b.nama, satuan: b.satuan }]) ?? []
);

// Map items with bahan details
const itemsWithBahan = (items || []).map(item => ({
  ...item,
  bahan_nama: bahanMap.get(item.bahan_baku_id)?.nama || 'Unknown',
  bahan_satuan: bahanMap.get(item.bahan_baku_id)?.satuan || '',
}));
```

- [ ] **Step 3: Type-check**

```bash
cd apps/distribusi
yarn type-check
```

- [ ] **Step 4: Commit**

```bash
git add apps/distribusi/src/components/distribusi/SuratJalanList.tsx
git commit -m "perf(distribusi): replace N+1 query with batch bahan_baku fetch"
```

---

## Task 3: Clean up owner-dashboard

**Files:** `apps/owner-dashboard/src/**`

- [ ] **Step 1: Search for console calls**

```bash
cd apps/owner-dashboard
grep -r "console\." src/ | grep -v ".test\|.spec" | grep -v "node_modules"
```

- [ ] **Step 2: Remove all found console calls**

For each found line, remove the entire line (or gate with `if (process.env.NODE_ENV === 'development')`).

- [ ] **Step 3: Verify tsconfig has baseUrl**

The tsconfig should already have `"baseUrl": "."` from earlier fixes. If not, add it.

- [ ] **Step 4: Type-check**

```bash
yarn type-check
```

- [ ] **Step 5: Commit (if changes made)**

```bash
git add apps/owner-dashboard/
git commit -m "chore(owner-dashboard): remove console.log calls for production" --allow-empty
```

---

## Task 4: Clean up portal

**Files:** `apps/portal/src/**`

- [ ] **Step 1: Search for console calls**

```bash
cd apps/portal
grep -r "console\." src/ | grep -v ".test\|.spec"
```

- [ ] **Step 2: Remove all found console calls**

- [ ] **Step 3: Verify tsconfig**

```bash
cat tsconfig.json | grep -A2 '"baseUrl"'
```

Should show `"baseUrl": "."`. If not, add it.

- [ ] **Step 4: Type-check**

```bash
yarn type-check
```

- [ ] **Step 5: Commit**

```bash
git add apps/portal/
git commit -m "chore(portal): remove console.log calls for production" --allow-empty
```

---

## Task 5: Verify all 4 apps build locally

**Purpose:** Ensure no regressions from fixes.

- [ ] **Step 1: Build each app**

```bash
cd "D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT"

# Install @suka/auth first
cd packages/auth && yarn build && cd ../..

# Build each app
cd apps/stok && yarn build && echo "✅ stok" && cd ../..
cd apps/distribusi && yarn build && echo "✅ distribusi" && cd ../..
cd apps/owner-dashboard && yarn build && echo "✅ owner-dashboard" && cd ../..
cd apps/portal && yarn build && echo "✅ portal" && cd ../..
```

Expected: All builds succeed, no errors.

- [ ] **Step 2: Verify .next artifacts exist**

```bash
for app in stok distribusi owner-dashboard portal; do
  if [ -d "apps/$app/.next" ]; then
    echo "✅ $app/.next exists"
  else
    echo "❌ $app/.next missing"
  fi
done
```

- [ ] **Step 3: Commit build verification (optional)**

```bash
git add -A
git commit -m "build: verify all 4 apps build successfully after fixes" --allow-empty
```

---

## Task 6: Final verification and summary

- [ ] **Step 1: Run type-check across all 4 apps**

```bash
cd "D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT"
cd apps/stok && yarn type-check && echo "✅ stok" && cd ../..
cd apps/distribusi && yarn type-check && echo "✅ distribusi" && cd ../..
cd apps/owner-dashboard && yarn type-check && echo "✅ owner-dashboard" && cd ../..
cd apps/portal && yarn type-check && echo "✅ portal" && cd ../..
```

Expected: All pass (0 errors).

- [ ] **Step 2: Verify git log shows all commits**

```bash
git log --oneline --grep="perf\|chore" -6
```

Expected to see:
- perf(stok): replace N+1 query...
- perf(distribusi): replace N+1 query...
- chore(owner-dashboard): remove console.log...
- chore(portal): remove console.log...

- [ ] **Step 3: Create summary document**

Create `docs/FIXES-COMPLETED.md`:

```markdown
# Fixes Completed — 2026-06-17

## Summary

Fixed HIGH severity issues in 4 apps before deployment:

| App | Issue | Status |
|-----|-------|--------|
| stok | N+1 query (fetchOutletItemsDetail) | ✅ FIXED |
| distribusi | N+1 query (SuratJalanList) | ✅ FIXED |
| owner-dashboard | console.log calls | ✅ REMOVED |
| portal | console.log calls | ✅ REMOVED |

## Changes

- **Performance:** Replaced 2 N+1 query patterns with batch queries (50+ items → 1 query instead of 50+)
- **Production safety:** Removed all debug console calls
- **Type safety:** All apps pass type-check, builds succeed

## Ready for Deployment

All 4 apps are now ready for deployment to production (stok.sukashawarma.com, distribusi.sukashawarma.com, owner-dashboard.sukashawarma.com, portal.sukashawarma.com).

## Notes for Team

- absensi: Security fixes + console.log removal (handled by team member)
- pos-kasir: Race condition + validation fixes (handled by team member)
- See AUDIT-FIXES-NOTES.md for detailed team instructions
```

- [ ] **Step 4: Final commit**

```bash
git add docs/FIXES-COMPLETED.md
git commit -m "docs: record completion of pre-deployment fixes (4 apps)"
```

---

## Summary

- **Tasks:** 6
- **Effort:** ~1.5 hours
- **Changes:** 4 files modified (2 perf fixes, 2 chore cleanups)
- **Outcome:** 4 apps ready for production deployment

---

Last updated: 2026-06-17
