# M2 — Domain Stok Bahan Baku | Specification

> **For:** Dev B  
> **Phase:** M2 (post-M0)  
> **Modules:** Opname · Ledger · Monitoring  
> **Status:** Pre-development (spec phase)

---

## Context

**Sukashawarma** operates 19 outlets. Each outlet needs to:
1. **Know** its current stock (daily/weekly opname)
2. **Track** what comes in/goes out (ledger: shipment received, waste, adjustments)
3. **Alert** when stock runs low or unusual patterns (monitoring)

**Goal:** Single integrated domain `stok` with 3 interchangeable UI modules.

---

## Domain Model

### Master Data

#### `bahan_baku` (Raw Material Master)
```
id: UUID (PK)
outlet_id: UUID (FK outlets)
nama: text
satuan: enum (kg, liter, pcs, box, dll)
kategori: enum (protein, bumbu, sayur, dll) 
reorder_point: numeric
created_at: timestamp
```

**Role:** Defined once per outlet (or centralized, then per-outlet override). SPV/Kepala outlet can manage.

---

### Transactional Data

#### `opname` (Stock Count Session)
```
id: UUID (PK)
outlet_id: UUID (FK outlets)
tanggal: date
tipe: enum (harian, mingguan, ad_hoc)
status: enum (draft, finalized) -- once finalized, lock from edits
created_by: UUID (outlet_staff, SPV/Kepala)
created_at: timestamp
updated_at: timestamp

notes: text (optional)
```

**Rows:** 1 opname session per date/outlet.

#### `opname_item` (Line items per opname)
```
id: UUID (PK)
opname_id: UUID (FK opname)
bahan_baku_id: UUID (FK bahan_baku)
qty_fisik: numeric -- counted in hand
qty_system: numeric -- previous ledger balance
selisih: numeric (computed: qty_fisik - qty_system)
catatan: text (optional)
```

**Workflow:**
1. SPV/crew count physical items → input qty_fisik
2. System fetches qty_system (last ledger balance)
3. Selisih auto-computed for audit
4. Once opname finalized, create ledger entry for selisih

#### `ledger_stok` (Stock Movement)
```
id: UUID (PK)
outlet_id: UUID (FK outlets)
bahan_baku_id: UUID (FK bahan_baku)
tipe: enum (terima_kiriman, pemakaian, waste, adjustment, opname_selisih)
qty: numeric
catatan: text
ref_shipment_id: UUID (FK shipment, nullable) -- link to M3 shipment if terima_kiriman
ref_opname_id: UUID (FK opname, nullable) -- link to opname if from opname_selisih
created_by: UUID (outlet_staff)
created_at: timestamp
saldo_sebelum: numeric (denormalized for audit)
saldo_sesudah: numeric (denormalized for audit)
```

**Rules:**
- Every opname finalize → ledger entry (tipe=opname_selisih, qty=selisih)
- Every shipment verify (M3) → ledger entry (tipe=terima_kiriman)
- SPV can manually add pemakaian/waste entries
- Negative ledger allowed (debt stock, manual correction)

#### `stok_balance` (Materialized Current Balance)
```
id: UUID (PK)
outlet_id: UUID (FK outlets)
bahan_baku_id: UUID (FK bahan_baku)
saldo: numeric (current qty)
updated_at: timestamp
```

**Maintained by:**
- Trigger on ledger INSERT → update stok_balance
- Nightly job (pg_cron) to recompute from ledger if drift detected

---

## UI Modules

### Module 1: Opname (Inventarisasi)
**Entry point:** `/stok/opname`

#### Views
1. **Opname List** (outlet_staff, SPV, Kepala)
   - Date range filter
   - Status (draft/finalized)
   - Quick count: "3 finalized today, 1 draft"
   - Actions: New opname, view detail, finalize

2. **Opname Form** (Create/Edit)
   - Date picker (default today)
   - Type (harian/mingguan/ad_hoc)
   - Items table:
     - Bahan baku dropdown (pre-populated from master)
     - Qty fisik (input)
     - Qty system (read-only, fetched from ledger)
     - Selisih (computed, highlighted if >threshold)
   - Add/remove items
   - Notes
   - Action: Save as draft, Finalize (once finalized, lock; show warning)

3. **Opname Detail** (View)
   - Read-only summary (date, type, status, creator)
   - Items with selisih highlighted
   - Ledger entry created from this opname (if finalized)
   - Back to list

#### Business Logic
- New opname → status=draft
- Finalize opname → create ledger entry (tipe=opname_selisih) + lock opname from further edits
- Selisih alert: if |selisih| > tolerance (e.g., >10% qty_system) → visual highlight
- Offline: opname form cached; sync on reconnect

---

### Module 2: Ledger (Manajemen Pergerakan)
**Entry point:** `/stok/ledger`

#### Views
1. **Ledger List** (outlet_staff, SPV, Kepala)
   - Date range filter (default: last 7 days)
   - Bahan baku filter (dropdown, multi-select)
   - Type filter (terima_kiriman, pemakaian, waste, opname_selisih)
   - Pagination or infinite scroll
   - Columns: Date, Bahan Baku, Type, Qty, Saldo Sesudah, Created By
   - Actions: View detail, (optional) edit/delete if manual entry

2. **Ledger Detail** (View)
   - Transaction info (date, type, qty, actor)
   - Reference (if terima_kiriman → link to shipment; if opname_selisih → link to opname)
   - Before/after balance (saldo_sebelum, saldo_sesudah)
   - Notes/catatan

3. **Manual Entry Form** (SPV/Kepala only)
   - Type: pemakaian, waste, adjustment
   - Bahan baku: dropdown
   - Qty: input (can be negative for adjustment)
   - Catatan: text
   - Action: Submit → creates ledger entry, updates stok_balance

#### Business Logic
- terima_kiriman (from M3 shipment verify) → auto-created, read-only
- pemakaian/waste → manually entered by crew/SPV (audit trail: created_by, created_at)
- adjustment → manual correction, SPV-only, requires reason in catatan
- saldo_sebelum/saldo_sesudah: denormalized for audit (should match running sum from ledger)

---

### Module 3: Monitoring (Alert & Real-Time)
**Entry point:** `/stok/monitoring`

#### Views
1. **Stock Level Dashboard** (outlet_staff, SPV, Kepala)
   - Grid: Bahan Baku (rows) vs current saldo (cols)
   - Color code:
     - 🟢 Green: saldo >= reorder_point
     - 🟡 Yellow: reorder_point/2 <= saldo < reorder_point
     - 🔴 Red: saldo < reorder_point/2
   - Sort by urgency (red first)
   - Quick info: reorder_point, last opname date, last ledger entry

2. **Alert Summary** (Kepala/SPV read, crew view-only)
   - Critical items: saldo < reorder_point (count)
   - Waste flag: if waste qty > threshold (e.g., >5kg in 3 days)
   - Overstock: if saldo > reorder_point × 2 (rare, but notify)
   - Opname overdue: if >7 days since last opname
   - Actions: 
     - "Stok rendah" → link to create new opname or manual entry
     - "Waste tinggi" → link to waste entries for review

3. **Trend Mini-Chart** (Optional, M2+)
   - Bahan baku detail: line chart (last 30 days saldo)
   - Highlight when it crossed threshold

#### Business Logic
- Real-time: fetch stok_balance + last opname + last 3 ledger entries on page load
- Threshold: reorder_point per bahan_baku (set by Kepala/owner)
- Waste calculation: sum ledger WHERE tipe=waste AND created_at > NOW() - 3 days
- Opname due: if MAX(opname.created_at) < NOW() - 7 days → red flag

---

## Data Flow & Integration

### Opname → Ledger (M2 internal)
```
Opname finalized
  ↓
Create ledger entry (tipe=opname_selisih, qty=selisih)
  ↓
Update stok_balance via trigger
  ↓
Monitoring dashboard refreshes (manual reload or live if using realtime)
```

### Shipment → Ledger (M3 → M2)
```
M3: Shipment received & verified by outlet staff
  ↓
M3 creates ledger entry (tipe=terima_kiriman, ref_shipment_id=...)
  ↓
M2: Ledger shows terima_kiriman
  ↓
M2: Opname next day captures this in qty_system
  ↓
Monitoring updates
```

### Ledger → M4 Dashboard
```
Every ledger entry
  ↓
M4 nightly job aggregates COGS (by bahan_baku + outlet + date)
  ↓
M4 dashboard shows "bahan baku cost" KPI
```

---

## RLS Policies

```sql
-- opname: outlet_staff can read/write own outlet
CREATE POLICY opname_read ON opname FOR SELECT USING (
  outlet_id IN (
    SELECT outlet_id FROM outlet_staff 
    WHERE id = auth.uid()
  )
);

CREATE POLICY opname_insert ON opname FOR INSERT WITH CHECK (
  outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
  AND created_by = auth.uid()
);

-- ledger: read own outlet, insert own outlet
CREATE POLICY ledger_read ON ledger_stok FOR SELECT USING (
  outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
);

CREATE POLICY ledger_insert ON ledger_stok FOR INSERT WITH CHECK (
  outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
  AND created_by = auth.uid()
);

-- stok_balance: read own outlet
CREATE POLICY stok_balance_read ON stok_balance FOR SELECT USING (
  outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
);
```

---

## Implementation Notes

### Offline Support
- **Opname form:** Cache draft in localStorage (offline-queue), sync on reconnect
- **Manual ledger entry:** Queue submissions if offline, retry with exponential backoff
- **Monitoring dashboard:** Last-known state cached; refresh on online

### Performance
- **Ledger query:** Index on (outlet_id, created_at) for date range filters
- **Stok_balance:** Materialized view, updated via trigger; nightly recompute job (pg_cron) for drift correction
- **Opname finalize:** Atomic transaction (opname.status → finalized + ledger.INSERT + stok_balance.UPDATE)

### Accessibility
- Forms: Labels, ARIA, keyboard nav
- Lists: Sortable columns, filters, pagination
- Colors: Do not rely on color alone (red/yellow/green) — also use icons/text

### Localization
- Indonesian labels (Sukashawarma internal)
- Numbers: use Intl.NumberFormat (qty, currency if COGS shown)
- Dates: DD/MM/YYYY or locale-aware

---

## Success Criteria

By end of M2:
- [ ] Opname module: crew can create/finalize opname, SPV can view all
- [ ] Ledger module: all entries visible + manual entries working
- [ ] Monitoring dashboard: real-time stock levels + alerts
- [ ] RLS enforces outlet isolation
- [ ] Offline queue syncs opname/manual ledger entries
- [ ] Performance: opname list <1s, ledger list (30 days) <2s
- [ ] Tested with 19 outlets + 100+ bahan_baku + 1000+ ledger entries

---

## M2 Deliverables

1. **Supabase migrations:**
   - bahan_baku, opname, opname_item, ledger_stok, stok_balance tables
   - Indexes, triggers, RLS policies

2. **Next.js app (`apps/stok`):**
   - Pages: /stok/opname, /stok/ledger, /stok/monitoring
   - Components: OpnameForm, OpnameList, LedgerList, MonitoringDashboard
   - Hooks: useOpname, useLedger, useStokBalance (with offline queue)
   - TypeScript types for domain model

3. **Edge Function (optional M2+):**
   - nightly stok_balance recompute (drift correction)
   - ledger stats aggregation for M4

4. **Documentation:**
   - M2-COMPLETION.md (similar to M0-COMPLETION.md)
   - Updated FLOWS.md (diagram: opname → ledger → monitoring)

5. **Tests:**
   - Unit: opname finalize, ledger balance calc, stok_balance trigger
   - E2E: opname workflow, offline queue sync
   - RLS: outlet isolation

---

## Out of Scope (M2+)

- ❌ BOM auto-deduction (manual ledger entries only)
- ❌ Supplier integration (M3 shipment is source of terima_kiriman)
- ❌ FIFO costing (simplified COGS for M4)
- ❌ Batch/lot tracking (future)
- ❌ Multi-outlet aggregation (done in M4 dashboard)
- ❌ Compliance export (M4+)

---

## Resources

- **Base:** M0 foundation (design-system, offline-queue, auth, Supabase client)
- **Docs:** ARCHITECTURE.md, FLOWS.md, adr/ADR-001..006.md
- **Design Tokens:** @suka/design-system (colors, typography, spacing)
- **Form Library:** Headless UI or React Hook Form (TBD in spec/plan phase)

---

**Next Step:** Dev B → M2 Brainstorm → M2 Plan → M2 Implementation

**Timeline Estimate:** 2–3 weeks (opname + ledger + monitoring + testing)

**Start Date:** After M0 complete (ready 2026-06-09)
