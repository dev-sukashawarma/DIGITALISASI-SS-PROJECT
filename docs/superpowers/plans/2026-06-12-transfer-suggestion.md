# Transfer Antar-Outlet Suggestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side engine that suggests cross-outlet stock transfers (surplus outlet → critical outlet, same item) and surfaces them as a panel in the SPV Dashboard.

**Architecture:** A pure function computes suggestions from the `MonitoringItem[]` already fetched by SPV Dashboard (`monitoring_view_spv`) — no DB change, no extra query. A presentational panel renders the suggestions and lets the SPV open the existing `TransferModal`.

**Tech Stack:** TypeScript, React (Next.js app router), Vitest + @testing-library/react, TailwindCSS (`suka-*` tokens).

Spec: `docs/superpowers/specs/2026-06-12-transfer-suggestion-design.md`

---

## File Structure

- Create: `apps/stok/src/lib/stok/transferSuggestion.ts` — pure function + `TransferSuggestion` type.
- Create: `apps/stok/src/lib/stok/transferSuggestion.test.ts` — unit tests.
- Create: `apps/stok/src/components/monitoring/TransferSuggestionPanel.tsx` — presentational panel.
- Create: `apps/stok/src/components/monitoring/__tests__/TransferSuggestionPanel.test.tsx` — component tests.
- Modify: `apps/stok/src/components/monitoring/SPVDashboard.tsx` — render the panel, wire Transfer button to existing modal.

---

## Task 1: Pure suggestion engine

**Files:**
- Create: `apps/stok/src/lib/stok/transferSuggestion.ts`
- Test: `apps/stok/src/lib/stok/transferSuggestion.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/stok/src/lib/stok/transferSuggestion.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeTransferSuggestions } from './transferSuggestion'
import type { MonitoringItem } from '@/lib/types/monitoring'

// Test helper — builds a MonitoringItem with sensible defaults
function makeItem(overrides: Partial<MonitoringItem>): MonitoringItem {
  return {
    outlet_id: 'o1',
    outlet_name: 'Outlet 1',
    bahan_baku_id: 'b1',
    item_name: 'Daging',
    satuan: 'kg',
    kategori: 'protein',
    current_qty: 10,
    threshold: 10,
    status: 'ok',
    is_flagged: false,
    last_updated: '2026-06-12T00:00:00Z',
    last_opname_date: null,
    ...overrides,
  }
}

describe('computeTransferSuggestions', () => {
  it('returns empty when no donor has surplus', () => {
    const items = [
      makeItem({ outlet_id: 'a', current_qty: 2, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'b', current_qty: 8, threshold: 10, status: 'warning' }),
    ]
    expect(computeTransferSuggestions(items)).toEqual([])
  })

  it('suggests qty = min(need, surplus) for one donor and one recipient', () => {
    const items = [
      makeItem({ outlet_id: 'a', outlet_name: 'A', current_qty: 2, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'b', outlet_name: 'B', current_qty: 30, threshold: 10, status: 'ok' }),
    ]
    const result = computeTransferSuggestions(items)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      donorOutletId: 'b',
      recipientOutletId: 'a',
      qty: 8, // need = 10 - 2 = 8, surplus = 20 -> min = 8
      recipientStatus: 'below',
    })
  })

  it('never drops a donor below its threshold across multiple recipients', () => {
    const items = [
      makeItem({ outlet_id: 'a', current_qty: 2, threshold: 10, status: 'below' }), // need 8
      makeItem({ outlet_id: 'b', current_qty: 4, threshold: 10, status: 'below' }), // need 6
      makeItem({ outlet_id: 'd', current_qty: 20, threshold: 10, status: 'ok' }),   // surplus 10
    ]
    const result = computeTransferSuggestions(items)
    const totalSent = result
      .filter((s) => s.donorOutletId === 'd')
      .reduce((sum, s) => sum + s.qty, 0)
    expect(totalSent).toBeLessThanOrEqual(10) // donor surplus only
  })

  it('prioritizes below recipients before warning recipients', () => {
    const items = [
      makeItem({ outlet_id: 'warn', current_qty: 9, threshold: 10, status: 'warning' }), // need 1
      makeItem({ outlet_id: 'crit', current_qty: 1, threshold: 10, status: 'below' }),    // need 9
      makeItem({ outlet_id: 'donor', current_qty: 15, threshold: 10, status: 'ok' }),     // surplus 5
    ]
    const result = computeTransferSuggestions(items)
    expect(result[0].recipientOutletId).toBe('crit')
  })

  it('only pairs outlets that share the same bahan_baku_id', () => {
    const items = [
      makeItem({ outlet_id: 'a', bahan_baku_id: 'b1', current_qty: 2, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'b', bahan_baku_id: 'b2', current_qty: 30, threshold: 10, status: 'ok' }),
    ]
    expect(computeTransferSuggestions(items)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/stok && yarn vitest run src/lib/stok/transferSuggestion.test.ts`
Expected: FAIL — "Failed to resolve import './transferSuggestion'".

- [ ] **Step 3: Write the implementation**

Create `apps/stok/src/lib/stok/transferSuggestion.ts`:

```ts
import type { MonitoringItem } from '@/lib/types/monitoring'

export interface TransferSuggestion {
  bahan_baku_id: string
  item_name: string
  satuan: string
  donorOutletId: string
  donorOutletName: string
  recipientOutletId: string
  recipientOutletName: string
  qty: number
  recipientStatus: 'below' | 'warning'
}

/**
 * Suggest cross-outlet transfers: pair surplus outlets with critical
 * (below/warning) outlets on the same item. Greedy allocation that never
 * drops a donor below its own threshold.
 */
export function computeTransferSuggestions(
  items: MonitoringItem[]
): TransferSuggestion[] {
  const byItem = new Map<string, MonitoringItem[]>()
  for (const item of items) {
    const list = byItem.get(item.bahan_baku_id) ?? []
    list.push(item)
    byItem.set(item.bahan_baku_id, list)
  }

  const suggestions: TransferSuggestion[] = []
  const severityRank = (s: string) => (s === 'below' ? 0 : 1)

  for (const group of byItem.values()) {
    const recipients = group
      .filter((i) => i.status === 'below' || i.status === 'warning')
      .map((i) => ({ item: i, need: i.threshold - i.current_qty }))
      .filter((r) => r.need > 0)
      .sort(
        (a, b) =>
          severityRank(a.item.status) - severityRank(b.item.status) ||
          b.need - a.need
      )

    const donors = group
      .filter((i) => i.current_qty > i.threshold)
      .map((i) => ({ item: i, surplus: i.current_qty - i.threshold }))
      .sort((a, b) => b.surplus - a.surplus)

    for (const recipient of recipients) {
      let remaining = recipient.need
      for (const donor of donors) {
        if (remaining <= 0) break
        if (donor.surplus <= 0) continue
        const qty = Math.min(remaining, donor.surplus)
        if (qty <= 0) continue
        suggestions.push({
          bahan_baku_id: recipient.item.bahan_baku_id,
          item_name: recipient.item.item_name,
          satuan: recipient.item.satuan,
          donorOutletId: donor.item.outlet_id,
          donorOutletName: donor.item.outlet_name,
          recipientOutletId: recipient.item.outlet_id,
          recipientOutletName: recipient.item.outlet_name,
          qty,
          recipientStatus: recipient.item.status as 'below' | 'warning',
        })
        donor.surplus -= qty
        remaining -= qty
      }
    }
  }

  return suggestions
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/stok && yarn vitest run src/lib/stok/transferSuggestion.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/lib/stok/transferSuggestion.ts apps/stok/src/lib/stok/transferSuggestion.test.ts
git commit -m "feat(transfer-suggestion): add cross-outlet suggestion engine"
```

---

## Task 2: TransferSuggestionPanel component

**Files:**
- Create: `apps/stok/src/components/monitoring/TransferSuggestionPanel.tsx`
- Test: `apps/stok/src/components/monitoring/__tests__/TransferSuggestionPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/stok/src/components/monitoring/__tests__/TransferSuggestionPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransferSuggestionPanel } from '../TransferSuggestionPanel'
import type { MonitoringItem } from '@/lib/types/monitoring'

function makeItem(overrides: Partial<MonitoringItem>): MonitoringItem {
  return {
    outlet_id: 'o1',
    outlet_name: 'Outlet 1',
    bahan_baku_id: 'b1',
    item_name: 'Daging',
    satuan: 'kg',
    kategori: 'protein',
    current_qty: 10,
    threshold: 10,
    status: 'ok',
    is_flagged: false,
    last_updated: '2026-06-12T00:00:00Z',
    last_opname_date: null,
    ...overrides,
  }
}

describe('TransferSuggestionPanel', () => {
  it('shows empty state when there are no suggestions', () => {
    render(<TransferSuggestionPanel items={[]} onTransfer={vi.fn()} />)
    expect(screen.getByText(/stok seimbang/i)).toBeInTheDocument()
  })

  it('renders a card with donor, recipient, qty and item', () => {
    const items = [
      makeItem({ outlet_id: 'a', outlet_name: 'EMPANG', current_qty: 2, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'b', outlet_name: 'KITCHEN', current_qty: 30, threshold: 10, status: 'ok' }),
    ]
    render(<TransferSuggestionPanel items={items} onTransfer={vi.fn()} />)
    expect(screen.getByText(/KITCHEN/)).toBeInTheDocument()
    expect(screen.getByText(/EMPANG/)).toBeInTheDocument()
    expect(screen.getByText(/8\s*kg/)).toBeInTheDocument()
  })

  it('calls onTransfer with the suggestion when the button is clicked', () => {
    const onTransfer = vi.fn()
    const items = [
      makeItem({ outlet_id: 'a', outlet_name: 'EMPANG', current_qty: 2, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'b', outlet_name: 'KITCHEN', current_qty: 30, threshold: 10, status: 'ok' }),
    ]
    render(<TransferSuggestionPanel items={items} onTransfer={onTransfer} />)
    fireEvent.click(screen.getByRole('button', { name: /transfer/i }))
    expect(onTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ donorOutletId: 'b', recipientOutletId: 'a', qty: 8 })
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/stok && yarn vitest run src/components/monitoring/__tests__/TransferSuggestionPanel.test.tsx`
Expected: FAIL — cannot resolve `../TransferSuggestionPanel`.

- [ ] **Step 3: Write the implementation**

Create `apps/stok/src/components/monitoring/TransferSuggestionPanel.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import type { MonitoringItem } from '@/lib/types/monitoring'
import {
  computeTransferSuggestions,
  type TransferSuggestion,
} from '@/lib/stok/transferSuggestion'

interface TransferSuggestionPanelProps {
  items: MonitoringItem[]
  onTransfer: (suggestion: TransferSuggestion) => void
}

export function TransferSuggestionPanel({
  items,
  onTransfer,
}: TransferSuggestionPanelProps) {
  const suggestions = useMemo(
    () => computeTransferSuggestions(items),
    [items]
  )

  if (suggestions.length === 0) {
    return (
      <div className="p-4 bg-white border border-suka-brown/10 rounded-2xl text-center text-sm text-suka-brown/60">
        Semua stok seimbang ✅
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s, idx) => (
        <div
          key={`${s.bahan_baku_id}-${s.recipientOutletId}-${s.donorOutletId}-${idx}`}
          className="p-4 bg-white border border-suka-brown/10 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <span
              className={`inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                s.recipientStatus === 'below'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {s.recipientStatus === 'below' ? 'Kritis' : 'Menipis'}
            </span>
            <p className="text-sm text-suka-brown">
              Kirim{' '}
              <span className="font-extrabold">
                {s.qty} {s.satuan} {s.item_name}
              </span>{' '}
              dari <span className="font-bold">{s.donorOutletName}</span> →{' '}
              <span className="font-bold">{s.recipientOutletName}</span>
            </p>
          </div>
          <button
            onClick={() => onTransfer(s)}
            className="shrink-0 px-4 py-2 text-sm font-semibold rounded-xl bg-suka-orange text-white hover:opacity-90 transition-opacity"
          >
            Transfer
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/stok && yarn vitest run src/components/monitoring/__tests__/TransferSuggestionPanel.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/components/monitoring/TransferSuggestionPanel.tsx apps/stok/src/components/monitoring/__tests__/TransferSuggestionPanel.test.tsx
git commit -m "feat(transfer-suggestion): add TransferSuggestionPanel component"
```

---

## Task 3: Wire panel into SPVDashboard

**Files:**
- Modify: `apps/stok/src/components/monitoring/SPVDashboard.tsx`

Context: `SPVDashboard` already holds `transferItem` state and renders `TransferModal`
(see `apps/stok/src/components/monitoring/SPVDashboard.tsx:33` and `:606`). The SPV
inventory array is available from `useSPVMonitoringData()`. We open the existing
modal for the recipient item when a suggestion's Transfer button is clicked.

- [ ] **Step 1: Add the import**

In `apps/stok/src/components/monitoring/SPVDashboard.tsx`, after the existing
`TransferModal` import (line 7), add:

```tsx
import { TransferSuggestionPanel } from './TransferSuggestionPanel';
import type { TransferSuggestion } from '@/lib/stok/transferSuggestion';
```

- [ ] **Step 2: Identify the inventory array variable**

Run: `cd apps/stok && grep -n "useSPVMonitoringData\|\.items" src/components/monitoring/SPVDashboard.tsx | head`
Expected: shows the hook call and the variable holding `MonitoringItem[]` (e.g.
`data?.items` or a destructured `items`). Use that exact variable name as
`<INVENTORY>` in the next steps.

- [ ] **Step 3: Add the suggestion handler**

Immediately after the existing `handleTransferConfirm` function (around line 196),
add a handler that opens the existing modal for the recipient outlet's item:

```tsx
  const handleSuggestionTransfer = (suggestion: TransferSuggestion) => {
    const recipientItem = (<INVENTORY> ?? []).find(
      (i) =>
        i.outlet_id === suggestion.recipientOutletId &&
        i.bahan_baku_id === suggestion.bahan_baku_id
    );
    if (recipientItem) setTransferItem(recipientItem);
  };
```

- [ ] **Step 4: Render the panel**

In the JSX, just above the `{/* Transfer Stock Modal */}` comment (around line 605),
insert the panel with a heading:

```tsx
      {/* Transfer Suggestions */}
      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-suka-brown/70">
          Saran Transfer Antar-Outlet
        </h2>
        <TransferSuggestionPanel
          items={<INVENTORY> ?? []}
          onTransfer={handleSuggestionTransfer}
        />
      </section>

```

- [ ] **Step 5: Verify type-check and full test suite pass**

Run: `cd apps/stok && yarn type-check && yarn vitest run`
Expected: type-check clean; all test files pass (existing 50 + new 8).

- [ ] **Step 6: Commit**

```bash
git add apps/stok/src/components/monitoring/SPVDashboard.tsx
git commit -m "feat(transfer-suggestion): surface suggestion panel in SPV dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** detection logic (Task 1), pure-function core + TDD (Task 1),
  panel UI + empty state + opens existing TransferModal (Tasks 2–3), no DB change,
  not on monitoring-live board — all covered.
- **Donor protection** is asserted in Task 1 Step 1 test #3.
- **Out of scope (per spec):** real ledger write in `TransferModal` (still mock);
  pre-filling source/qty inside the modal — Task 3 opens the modal for the
  recipient item, SPV confirms source/qty there as today.
