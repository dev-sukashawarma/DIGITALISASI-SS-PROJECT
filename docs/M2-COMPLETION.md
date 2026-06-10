# M2 Stok — Completion Summary

> Status: ✅ Complete · Dev B · 2026-06-10
> Real bahan_baku/recipe list populated, UI redesigned with premium warm brand style.

## Delivered

### Schema & Database
- **bahan_baku** (ingredients master): satuan, kategori, default_reorder_point
- **resep / resep_item** (BOM recipes): built (schema + structure), global recipes example seeded
- **opname / opname_item** (inventory counts): captured selisih (variance), dated, outlet-scoped
- **ledger_stok** (stock ledger): signed entries (masuk/keluar/adjustment), atomically updated balance
- **stok_balance** (denormalized current stock): outlet + bahan_baku + qty + last_updated, auto-updated via triggers
- **Outlets query fix**: resolved column mapping error by aliasing `nama:name` in queries to match the physical database schema, fixing empty render issue.

### Functions & RPC
- **finalize_opname()** atomic RPC: locks opname, generates opname_selisih ledger entries, updates stok_balance, rolls back on error
- **Edge Function** ledger-create-from-shipment: integration point for M3 (shipment → ledger entry)

### Row-Level Security (RLS)
- **opname, opname_item, ledger_stok, stok_balance**: outlet isolation (staff can only see/edit their outlet)
- **bahan_baku, resep, resep_item**: global read (master data, changes by admin only)

### Business Logic (Test-Driven)
- **selisih compute**: physical_count - expected_balance = selisih, flagged red if |selisih| > 15%
- **stok status color**: green (adequate), yellow (low), red (critical/negative)
- **opname overdue**: marked if created >2 days ago without finalization
- **BOM expectedUsage**: calculated from recipe and historical usage (feature gate for POS feed, M4)

### React Hooks & Data Layers
- **useBahanBaku()**: fetch + cache bahan_baku list
- **useStokBalance()**: 30s polling, real-time qty updates
- **useOpname()**: list/detail fetch, offline retry for finalize_opname()
- **useLedger()**: list/create/detail, support manual entry form
- **Supabase PromiseLike Fix**: refactored queries to use async/await try-catch patterns, resolving TS compiler PromiseLike `.catch` type checks.

### User Interface & Redesign (Suka Shawarma Premium Brand style)
- **Live Stock Monitoring Board (`/stok/monitoring-live`)**:
  - Multi-column outlet card grid with sound alarm chimes (Web Audio API) for critical items.
  - Overall status summary counters (Kritis, Menipis, Aman) with automatic data refreshing.
- **SPV Monitoring Split Pane Dashboard (`/stok/monitoring`)**:
  - 25% left navigation panel for 19 outlets with worst-status indicators and blinking alerts.
  - 75% right detail pane displaying materials table, quick-action replenishment/transfer buttons, and real-time refresh controls.
- **Stock Opname Form (`/stok/opname/new`)**:
  - Categorized tab list filter (Protein, Sayuran, etc.) and live search.
  - Tactile physical quantity inputs with `+` and `-` steps based on item unit.
  - Highlighted >15% discrepancy warning borders and custom floating toast notifications (removed browser alerts).
- **Stock Ledger Log (`/stok/ledger`)**:
  - Filter by transaction types (📥 Masuk, 🗑️ Keluar, ⚖️ Penyesuaian) and live search by material name or reference ID.
  - Mapped ID values to actual ingredient names and units, formatted bold inflows (green) and outflows (red) with relative timestamps.
- **Opname History List (`/stok/opname`)**:
  - Search filter, status pills (All, Selesai, Draft), stats cards, and colored status badges.
- **Sidebar navigation**: integrated all entry points using premium warm styling.

### Build & Tests
- **Unit & UI integration tests**: 50 tests across status, bom, selisih, and UI dashboard components — all PASS.
- **Type safety**: full TypeScript coverage, tsc --noEmit clean.
- **Static export**: Next.js production build completes successfully.

## Deferred (Per Design)

- **BOM auto-deduction**: wires to POS sales feed (M4), triggers expectedUsage anomaly flag
- **Precise selisih anomaly flag**: ML/heuristic model trained on historical variance (M5)
- **Per-outlet reorder override**: manual reorder points, stock level policies (future)
- **Push/WA notifications**: staff alert on critical stock, overdue opname (future)
- **Unit conversion**: UI + ledger support for different satuan (future)
- **Full offline-first**: local IndexedDB queue, sync on reconnect (future)

## Handoff Points

### To M3 (Inventory + Shipment)
- **Endpoint**: `POST /functions/v1/ledger-create-from-shipment`
  - **Payload**: `{ shipment_id, outlet_id, items: [{bahan_baku_id, qty_received, satuan}, ...] }`
  - **Response**: ledger entry ID + updated stok_balance
  - **Behavior**: atomic, upserts ledger if shipment_id already processed

### To M4 (Sales + Reporting)
- **Read stok_balance** for real-time qty (inventory-at-hand)
- **Read ledger_stok** for COGS/HPP calculation (signed movements)
- **Use expectedUsage** (from BOM + historical) to detect anomalies (waste, theft)
- **Integrate POS feed** to auto-populate ledger masuk (sales → deduction)

### To Owner
- **Provide bahan_baku list**: CSV or SQL INSERT (satuan, kategori, default_reorder_point)
- **Adjust CHECK constraints** if new satuan/kategori values needed
- **No schema migration required**: just data population

## Files Modified / Created

- `/apps/stok/src/lib/stok/`: bom.ts, selisih.ts, status.ts + test files
- `/apps/stok/src/hooks/`: useBahanBaku.ts, useStokBalance.ts, useOpname.ts, useLedger.ts, useMonitoringData.ts
- `/apps/stok/src/components/`: stok/ (OpnameList, OpnameForm, LedgerList), monitoring/ (LiveMonitoringPage, SPVDashboard, SPVTable, SPVTabs)
- `/apps/stok/src/app/stok/`: opname/, ledger/, monitoring/, monitoring-live/ routes
- `/supabase/migrations/`: schema (bahan_baku, resep, opname, ledger_stok, stok_balance)
- `/supabase/functions/`: ledger-create-from-shipment edge function

## Testing Checklist

- ✅ Unit & UI tests (bom, selisih, status, live monitor, dashboard): 50/50 PASS
- ✅ Type check: no errors (`tsc --noEmit` passes)
- ✅ Build: clean static export production build
- ✅ RLS: opname/ledger/balance scoped to outlet; master data readable
- ✅ finalize_opname(): atomic, idempotent, rolls back on error
- ✅ UI: all routes render, forms submit, data persists, custom alerts function cleanly

## Next Session (M3)

1. Implement shipment intake flow (receive goods)
2. Wire ledger-create-from-shipment (POST from inventory)
3. Add opname → shipment reconciliation step
4. Dashboard widget: recent ledger entries + stok alerts

---

**Signed off**: Dev B · 2026-06-10 · Feature branch: `feature/m2-stok`
