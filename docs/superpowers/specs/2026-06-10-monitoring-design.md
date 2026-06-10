# M2 Monitoring — Dashboard Design

> **Status:** Design locked · **Date:** 2026-06-10 · **Dev:** Dev B (M2 lead)  
> **Basis:** Brainstorming with SPV (kitchen) + crew (outlet) use case analysis

---

## Overview

M2 Stok requires **two separate monitoring dashboards** tailored to different users and contexts:

1. **SPV Monitoring (Kitchen/Central)** — Multi-outlet overview, alert aggregation, compliance tracking
2. **Crew Monitoring (Outlet)** — Single-outlet operational check, opname preparation

Both dashboards display real-time stok data: current qty vs. reorder point threshold, flagged discrepancies, and opname status. Different layouts serve different use cases.

---

## SPV Monitoring Dashboard (Multi-Outlet Overview)

**Primary User:** SPV Kitchen (Supervisor Produksi)  
**Device:** Monitor/desktop (landscape primary), tablet responsive  
**Usage:** Constantly checking (every few minutes)  
**Purpose:** Detect issues, coordinate outlets, compliance oversight

### Architecture

Single page with **three navigation tabs** — all tabs share the same underlying data, filtered differently:

| Tab | Content | Focus |
|-----|---------|-------|
| **Overview** | All items across all outlets | Raw data, complete visibility |
| **Alerts** | Only items below threshold or flagged | Issues requiring action |
| **Compliance** | Opname status per outlet, flagged items | Audit trail, verification tracking |

### Table Layout

```
Header: [Filter: Outlet▼] [Status: All|Below|Warning|OK] [Search: Item...]
Auto-refresh: Every 30 seconds | Last updated: 2:35 PM

┌──────────┬──────────────┬──────────┬───────────┬────────┬──────────────┐
│ Outlet   │ Item Name    │ Qty Now  │ Threshold │ Status │ Updated      │
├──────────┼──────────────┼──────────┼───────────┼────────┼──────────────┤
│ Bandung  │ Minyak       │ 8        │ 15        │ 🔴     │ 2:34 PM      │
│ Jakarta  │ Daging       │ 22       │ 30        │ 🟡     │ 2:35 PM      │
│ Surabaya │ Sayur        │ 40       │ 20        │ ✅     │ 2:35 PM      │
│ Bandung  │ Telur        │ 5/8      │ 20        │ 🔴 📌  │ 2:33 PM (fld)│
└──────────┴──────────────┴──────────┴───────────┴────────┴──────────────┘
```

**Columns:**
- **Outlet:** Outlet name
- **Item Name:** Bahan baku name
- **Qty Now:** Current stok quantity from `stok_balance`
- **Threshold:** `bahan_baku.default_reorder_point` (global, all outlets same)
- **Status:** Color-coded indicator + flag if flagged
- **Updated:** Timestamp of last ledger entry or balance update

### Status Indicators

| Status | Condition | Color | Icon |
|--------|-----------|-------|------|
| Below | qty < threshold | Red | 🔴 |
| Warning | qty ≥ threshold AND qty < (threshold × 1.2) | Yellow | 🟡 |
| OK | qty ≥ (threshold × 1.2) | Green | ✅ |
| Flagged | discrepancy from opname | Any + 📌 | 📌 |

Flagged icon overlays status color to show "this item has discrepancy from recent opname + damage/qty mismatch recorded".

### Interactions

**Click table row:**
- Opens detail modal/panel showing:
  - Current qty + threshold
  - Last opname date & discrepancy details (if any)
  - Recent ledger entries (transfer, waste, adjustment)
  - Opname status (when due next)
  - Photo of discrepancy (if available from M3)

**Sorting:**
- Default: By Outlet, then Item Name
- User can click column headers: Outlet, Item, Status, Updated

**Filtering:**
- **Outlet dropdown:** Single select (or multi-select later)
- **Status radio:** All | Below | Warning | OK (filters rows)
- **Search:** Item name fuzzy search

**Alerts Tab specific:**
- Hanya show rows where Status ∈ [Below, Warning, Flagged]
- Grouped by Outlet for easier scanning
- Red items first (Below), then Yellow (Warning), then Flagged

**Compliance Tab specific:**
- Summary per outlet: "Last opname: X days ago" | "Status: OK | ⚠️ Overdue (>7 days)"
- List of flagged items with: Item name, Outlet, Discrepancy type (qty mismatch, damage, etc), Flagged date

### Auto-Refresh

- **Interval:** 30 seconds (configurable, user can pause)
- **Behavior:** Silently fetch and update table rows. If data changed, highlight cell briefly (0.5s flash) to draw attention
- **Failure:** If API timeout, show toast: "Connection unstable, showing cached data (last updated 2:30 PM)" + Retry button
- **Timestamp:** Always show "Last updated: HH:MM" at top

### Mobile/Tablet Responsiveness

- On tablet (<768px): Table columns compress (hide "Updated" column, abbreviate headers)
- Outlet column sticky (left), other columns horizontal-scroll
- Touch-friendly: row height ≥ 44px

---

## Crew Monitoring Dashboard (Single-Outlet Detail)

**Primary User:** Crew at outlet (operational staff)  
**Device:** Tablet (primary), monitor accessible  
**Usage:** Periodic checks (before shift, before opname, during day)  
**Purpose:** Operational status check, opname preparation

### Architecture

Single page with flat item list, header summary, role-based access (RLS enforces single-outlet view).

### Header Summary

```
[Outlet Name: Bandung] — Last updated: 2:35 PM

Items Below Threshold: 5  |  Flagged Discrepancies: 2  |  OK: 43
```

- **Outlet Name:** Auto-populated from user's `outlet_staff.outlet_id` (RLS)
- **Counts:** Real-time counts from current stok data
  - "Below Threshold" = count of items where qty < threshold
  - "Flagged" = count of items where flagged=true in recent opname
  - "OK" = count of items where qty ≥ threshold AND not flagged
- **Counts are clickable:** Click "Below Threshold: 5" → filter list to show only red items

### Item List

```
Header: Auto-updated from RLS | Sort: [By Status (default) | By Name ▼]

┌──────────────┬─────────────┬───────────┬────────┐
│ Item Name    │ Current Qty │ Threshold │ Status │
├──────────────┼─────────────┼───────────┼────────┤
│ Minyak       │ 8           │ 15        │ 🔴     │
│ Daging       │ 22          │ 30        │ 🟡     │
│ Telur        │ 5/8         │ 20        │ 🔴 📌  │
│ Sayur        │ 40          │ 20        │ ✅     │
└──────────────┴─────────────┴───────────┴────────┘
```

**Columns:**
- **Item Name:** Bahan baku name
- **Current Qty:** From `stok_balance` for this outlet
- **Threshold:** `bahan_baku.default_reorder_point`
- **Status:** Color-coded (same system as SPV)

**Default Sort:** By Status (Red → Yellow → OK) then by Item Name (A-Z)  
**User can toggle:** Sort by Name instead (A-Z, ignoring status)

### Interactions

**Click item row:**
- Opens detail modal showing:
  - Current qty + threshold
  - Last opname date & any discrepancy note
  - Photo (if flagged)
  - Recent ledger entries for this item at this outlet

**Sort toggle:** Dropdown or toggle "By Status | By Name"

**Clickable header counts:**
- Click "Items Below Threshold: 5" → temporarily filter to show only red items, button shows "X" to clear filter
- Same for "Flagged"

**Search (optional for M2, nice-to-have):** Type item name to filter list

### Auto-Refresh

- **Interval:** 30 seconds (same as SPV)
- **Behavior:** Same as SPV — silent update, brief highlight on change
- **Failure:** Same graceful degradation (show cached data + "Retry" button)

### Mobile/Tablet Responsiveness

- **Primary device:** Tablet (vertical orientation)
- **List layout:** Full-width, no horizontal scroll needed
- **Touch:** Row height ≥ 44px, tap-friendly
- **Monitor access:** List adapts to wider screen, readable

---

## Navigation & Access

**Single URL:** `/stok/monitoring`

- **SPV accesses:** Role-based (RLS check: is user SPV?) → render SPV layout (multi-outlet tabs)
- **Crew accesses:** Not SPV → render Crew layout (single-outlet list)
- **No separate routes:** Same page, different content based on auth role

**RLS Enforcement:**
- SPV: Can see all outlets' data
- Crew: Can only see their own outlet (outlet_id from `outlet_staff` table)

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| API timeout (stok service down) | Show cached data + "Last updated X ago" badge + Retry button (toast) |
| Network error on auto-refresh | Silent fail, keep showing current data. Retry happens on next 30s cycle |
| Empty data (no items yet for outlet) | Show empty state: "No items tracked yet" + "Create first opname to start monitoring" |
| Threshold not set (null reorder_point) | Show item as "—" (dash) for threshold, status = neutral (gray) |

---

## Data Flow & Dependencies

**Source Data:**
- `stok_balance` — current qty per outlet, item (materialized, updated by ledger triggers)
- `bahan_baku` — item master, including `default_reorder_point`
- `opname_item` — flagged discrepancies, used to mark items as "flagged" in monitoring
- `ledger_stok` — recent movements (optional detail view)

**Auto-refresh query:**
```sql
SELECT 
  sb.outlet_id, sb.bahan_baku_id, sb.saldo,
  bb.nama, bb.default_reorder_point,
  CASE WHEN oi.flagged THEN true ELSE false END as has_discrepancy
FROM stok_balance sb
JOIN bahan_baku bb ON sb.bahan_baku_id = bb.id
LEFT JOIN opname_item oi ON oi.bahan_baku_id = bb.id 
  AND oi.opname_id IN (SELECT id FROM opname WHERE outlet_id = sb.outlet_id ORDER BY id DESC LIMIT 1)
WHERE sb.outlet_id = ? (for crew) OR (for SPV: no filter, show all)
```

**Frequency:** Every 30 seconds (RealTime subscription via Supabase or polling)

---

## Success Criteria (M2)

✅ SPV can view multi-outlet monitoring with alerts, overview, compliance tabs  
✅ Crew can view single-outlet list with current qty vs threshold  
✅ Both dashboards auto-refresh every 30 seconds  
✅ Status color-coding matches threshold logic (below, warning, ok)  
✅ Flagged items show discrepancy indicators  
✅ Click row → detail view works  
✅ RLS enforced: SPV sees all outlets, crew sees own only  
✅ Graceful error handling (cached data fallback)  
✅ Mobile (tablet) + desktop (monitor) responsive  

---

## Out of Scope M2 (Deferred)

- Push/WA notifications on threshold breach (in-app dashboard monitoring first)
- Advanced analytics (trend charts, forecasting)
- Custom per-outlet thresholds (M4 owner dashboard)
- Batch operations (mark multiple as reviewed)
- Export to CSV
- Search/fuzzy find (nice-to-have, can add if time)
