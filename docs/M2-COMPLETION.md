# M2 Stok — Completion Summary

> Status: ✅ Complete (sample data) · Dev B · 2026-06-09
> Real bahan_baku/recipe list menyusul from owner — populate tables, no schema change.

## Delivered

### Schema & Database
- **bahan_baku** (ingredients master): satuan, kategori, harga_satuan
- **resep / resep_item** (BOM recipes): built (schema + structure), not yet wired to POS
- **opname / opname_item** (inventory counts): captured selisih (variance), dated, outlet-scoped
- **ledger_stok** (stock ledger): signed entries (masuk/keluar/adjustment), atomically updated balance
- **stok_balance** (denormalized current stock): outlet + bahan_baku + qty + last_updated, auto-updated via triggers

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

### React Hooks
- **useBahanBaku()**: fetch + cache bahan_baku list
- **useStokBalance()**: 30s polling, real-time qty updates
- **useOpname()**: list/detail fetch, offline retry for finalize_opname()
- **useLedger()**: list/create/detail, support manual entry form

### User Interface
- **/stok/opname**: list (outlet filter, overdue alert), new (quick opname form), detail (selisih breakdown, finalize button)
- **/stok/ledger**: list (date/type filter, running balance), new (manual entry, shipment import), detail (audit trail)
- **/stok/monitoring**: sorted by selisih severity, auto-refresh (10s), visual alerts for threshold breaches
- **Sidebar navigation**: links to opname, ledger, monitoring, dashboard

### Build & Tests
- **Unit tests**: 13 tests across bom.test.ts, selisih.test.ts, status.test.ts — all PASS
- **Type safety**: full TypeScript coverage, tsc --noEmit clean
- **Static export**: Next.js static build (10 prerendered pages + 2 dynamic routes)

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
- **Provide bahan_baku list**: CSV or SQL INSERT (satuan, kategori, harga_satuan)
- **Adjust CHECK constraints** if new satuan/kategori values needed
- **No schema migration required**: just data population

## Files Modified / Created

- `/apps/stok/src/lib/stok/`: bom.ts, selisih.ts, status.ts + test files
- `/apps/stok/src/hooks/`: useBahanBaku.ts, useStokBalance.ts, useOpname.ts, useLedger.ts
- `/apps/stok/src/app/stok/`: opname/, ledger/, monitoring/ page routes
- `/supabase/migrations/`: schema (bahan_baku, resep, opname, ledger_stok, stok_balance)
- `/supabase/functions/`: ledger-create-from-shipment edge function

## Testing Checklist

- ✅ Unit tests (bom, selisih, status): 13/13 PASS
- ✅ Type check: no errors
- ✅ Build: clean static export (10 prerendered, 2 dynamic)
- ✅ RLS: opname/ledger/balance scoped to outlet; master data readable
- ✅ finalize_opname(): atomic, idempotent, rolls back on error
- ✅ UI: all routes render, forms submit, data persists

## Next Session (M3)

1. Implement shipment intake flow (receive goods)
2. Wire ledger-create-from-shipment (POST from inventory)
3. Add opname → shipment reconciliation step
4. Dashboard widget: recent ledger entries + stok alerts

---

**Signed off**: Dev B · 2026-06-09 · Feature branch: `feature/m2-stok`
