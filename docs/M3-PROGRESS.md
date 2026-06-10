# M3 Distribusi — Progress & Completion Status

> **Last Updated:** 2026-06-10  
> **Status:** Phase 1 (Monitoring Dashboard) ✅ Complete  
> **Next:** Phase 2 (Surat Jalan CRUD + Verification)

---

## Phase 1: Monitoring Dashboard (✅ COMPLETED)

### Overview

SPV monitoring dashboard built to track stok across 19 outlets in real-time. Multi-outlet isolation via RLS, organized by geographic region (Bogor, Jakarta, Depok, Bekasi, Tangerang + Central Kitchen).

### Deliverables

#### 1️⃣ Database Views (New)

**Files:**
- `supabase/migrations/20260610001000_monitoring_views.sql`

**Views Created:**
- `monitoring_view_spv` — SPV multi-outlet view (all outlets, all bahan)
  - Joins: `stok_balance` → `bahan_baku` + `outlets`
  - Includes: `satuan`, `kategori`, computed `status` (below/warning/ok)
  - Latest opname date per item
  
- `monitoring_view_crew` — Crew single-outlet view (RLS: own outlet only)
  - Same schema as SPV view
  - RLS inherited from underlying tables

#### 2️⃣ Type Updates

**File:** `apps/stok/src/lib/types/monitoring.ts`

**Changes:**
```typescript
export interface MonitoringItem {
  outlet_id: string;
  outlet_name: string;
  bahan_baku_id: string;
  item_name: string;
  satuan: string;         // ← NEW (was hardcoded by name)
  kategori: string;       // ← NEW
  current_qty: number;
  threshold: number;
  status: StockStatus;
  is_flagged: boolean;
  last_updated: string;
  last_opname_date: string | null;
}
```

#### 3️⃣ SPV Dashboard Component

**File:** `apps/stok/src/components/monitoring/SPVDashboard.tsx`

**Features:**
- **Region-based navigation** (Central Kitchen, Bogor, Jakarta, Depok, Bekasi, Tangerang)
- **Overview tab:** Split view (left: outlet list by region, right: stok detail)
- **Alerts tab:** Global critical/warning items across all outlets
- **Compliance tab:** Opname freshness status + operational checklist (stub)
- **Threshold editing:** Inline edit per outlet+bahan threshold
- **Auto-refresh:** 30-second polling with pause/resume controls
- **Toast notifications:** Threshold changes, restock requests, transfers

**Helper Function:**
```typescript
const getOutletRegion = (outletName: string) => {
  // Maps outlet names to regions based on location keywords
  // KITCHEN → 'Central Kitchen' (separate category)
  // Returns: 'Central Kitchen' | 'Bogor' | 'Jakarta' | 'Depok' | 'Bekasi' | 'Tangerang'
}
```

#### 4️⃣ SPVTable Component Fix

**File:** `apps/stok/src/components/monitoring/SPVTable.tsx`

**Fixes:**
- ✅ Removed hardcoded satuan logic (was guessing 'pcs' vs 'kg' by name)
- ✅ Now uses `item.satuan` from database (correct: crt, pack, kg, pcs, ikat, etc.)
- ✅ Removed confusing "Menampilkan X dari Y" message (now just shows count per outlet)
- ✅ Fixed duplicate key error (added deduplication in `fetchSPVMonitoringData`)

#### 5️⃣ Data Population

**Stok Balance Populated:**

| Outlet | Bahan Count | Qty per Item |
|--------|-------------|--------------|
| Central Kitchen | 33 | 10 |
| EMPANG | 33 | 10 |
| PALEDANG | 33 | 10 |
| **Total stok_balance rows** | **99** | — |

**SQL Migration:** Added via Supabase SQL Editor
```sql
INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo)
SELECT o.id, b.id, 10
FROM outlets o
CROSS JOIN bahan_baku b
WHERE o.name IN ('SUKA SHAWARMA KITCHEN', 'SUKA SHAWARMA EMPANG', 'SUKA SHAWARMA PALEDANG')
ON CONFLICT DO NOTHING;
```

---

## Code Review Findings (Phase 1)

### Fixed

✅ **Duplicate key error** (monitoring_view_spv)
- Root: View returned multiple rows for same (outlet_id, bahan_baku_id)
- Fix: Added deduplication in `fetchSPVMonitoringData()` + `fetchCrewMonitoringData()`

✅ **Hardcoded satuan** (SPVTable)
- Root: Guessed 'pcs' vs 'kg' based on item name
- Fix: Use actual `item.satuan` from database

✅ **Confusing item count message**
- Root: Showed "33 dari 72" (outlet items vs all outlets)
- Fix: Show only outlet-filtered count

### Pending Issues

🔶 **Compliance tab mock data** — static checklist needs to be wired to actual outlet data (M3 Phase 2)

---

## Test Data (Pilot Outlets)

| Outlet | Region | Staff | Auth User |
|--------|--------|-------|-----------|
| SUKA SHAWARMA KITCHEN | Central Kitchen | Crew Kitchen | spv@test.com |
| SUKA SHAWARMA EMPANG | Bogor | Crew Empang | andi.empang@sukashawarma.com |
| SUKA SHAWARMA PALEDANG | Depok | Crew Paledang | budi.sukmajaya@sukashawarma.com |

---

## Architecture Notes

### RLS Strategy
- `monitoring_view_spv`: SPV role can see all outlets
- `monitoring_view_crew`: Crew role sees only own outlet (RLS enforced via underlying tables)
- Both views inherit row-level policies from `stok_balance` table

### Deduplication Pattern
When querying views that may have duplicates (due to multiple opname entries, ledger rows, etc.), deduplicate by composite key (outlet_id, bahan_baku_id) using `Set<string>`:

```typescript
const seen = new Set<string>();
const dedupedItems = data.filter(item => {
  const key = `${item.outlet_id}-${item.bahan_baku_id}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

---

## Next Steps (Phase 2)

### Surat Jalan CRUD (Supply Chain)
- [ ] Create surat_jalan + surat_jalan_item schema
- [ ] RLS policies (SPV pusat can create, outlets can verify)
- [ ] SPV form: outlet select + bahan picker + signature flow
- [ ] Outlet verification form: qty + kondisi + foto (conditional)
- [ ] RPC: auto-create ledger entries from verified surat_jalan

### Compliance Tab Wiring
- [ ] Wire actual opname freshness (from opname table)
- [ ] Wire operational checklist (from new checklist_item table or config)

### Edge Function Integration (M3→M2)
- [ ] `ledger-create-from-surat-jalan` Edge Function
- [ ] Verify qty terima auto-flows to M2 ledger on surat_jalan finalize

---

## Deployment Checklist

- [ ] RLS policies tested (SPV sees all, crew sees own outlet)
- [ ] Monitoring dashboard tested on mobile (Android 6+)
- [ ] Stok_balance populated for all 19 outlets (currently: 3 pilot outlets)
- [ ] Performance baseline: `monitoring_view_spv` < 2s with 99 rows
- [ ] Edge Function for surat_jalan→ledger ready

---

## Files Changed

**Migrations:**
- `supabase/migrations/20260610001000_monitoring_views.sql` ✅

**App Code:**
- `apps/stok/src/lib/types/monitoring.ts` ✅
- `apps/stok/src/components/monitoring/SPVDashboard.tsx` ✅
- `apps/stok/src/components/monitoring/SPVTable.tsx` ✅
- `apps/stok/src/lib/queries/monitoring.ts` ✅ (deduplication)

**Distribusi (M3 Baseline):**
- `apps/distribusi/src/components/distribusi/SuratJalanList.tsx` (created in M3 plan, baseline)
- `apps/distribusi/src/components/distribusi/SuratJalanDetail.tsx` (baseline)
- `apps/distribusi/src/components/distribusi/VerifikasiForm.tsx` (baseline)
- `apps/distribusi/src/hooks/useSuratJalanList.ts` (baseline)
- `apps/distribusi/src/hooks/useSuratJalanDetail.ts` (baseline)
- `apps/distribusi/src/hooks/useTerimaList.ts` (baseline)
- `supabase/migrations/20260610000100_outlets_anon_read.sql` (RLS baseline)
- `supabase/migrations/20260610000200_bahan_baku_anon_read.sql` (RLS baseline)
- `supabase/migrations/20260610000300_surat_jalan_anon_insert.sql` (RLS baseline)
- `supabase/migrations/20260610000400_fix_surat_jalan_rls.sql` (RLS baseline)

---

## Known Limitations

1. **Compliance tab checklist** — Currently mocked, not tied to real outlet data
2. **Transfer modal** — UI present but not fully integrated with backend
3. **Offline queue** — Not implemented for monitoring dashboard (lower priority vs M2)
4. **Mobile testing** — Designed for Android 6+, not yet tested on real device
5. **Stok_balance** — Only populated for 3 pilot outlets; needs expansion to all 19 before full rollout

---

## Success Metrics

| Metric | Status | Notes |
|--------|--------|-------|
| SPV Dashboard responsive | ✅ | All tabs, auto-refresh, region navigation |
| Satuan correct | ✅ | Using database values, not hardcoded |
| RLS tested | 🔶 | Manual verification only, needs automated test |
| Performance baseline | ⚠️ | Not yet profiled; target < 2s |
| Mobile usable | 🔶 | Not tested on real device |
| All 19 outlets data-ready | ❌ | Only 3 pilot outlets populated |

