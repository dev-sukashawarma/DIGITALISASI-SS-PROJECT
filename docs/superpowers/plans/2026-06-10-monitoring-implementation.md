# M2 Monitoring Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build role-based monitoring dashboards (SPV multi-outlet + Crew single-outlet) with real-time stok visibility, auto-refresh, and graceful error handling.

**Architecture:** Single page route `/stok/monitoring` with role-based rendering (SPV → table + tabs, Crew → flat list). Both use shared data queries and detail modals. Auto-refresh every 30s via client-side polling. RLS enforces data access.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS, Supabase (RLS + queries), TanStack React Query for caching/polling.

---

## File Structure

### New Files to Create

**Backend/API:**
- `apps/stok/src/lib/queries/monitoring.ts` — Monitoring data queries (SPV + crew)
- `apps/stok/src/lib/queries/opname.ts` — Opname flagging query

**Frontend Components:**
- `apps/stok/src/components/monitoring/MonitoringPage.tsx` — Main page (role detection + routing)
- `apps/stok/src/components/monitoring/SPVDashboard.tsx` — SPV multi-outlet table
- `apps/stok/src/components/monitoring/CrewDashboard.tsx` — Crew single-outlet list
- `apps/stok/src/components/monitoring/SPVTabs.tsx` — Tab navigation for SPV
- `apps/stok/src/components/monitoring/SPVTable.tsx` — Sortable/filterable table
- `apps/stok/src/components/monitoring/CrewList.tsx` — Item list for crew
- `apps/stok/src/components/monitoring/MonitoringDetailModal.tsx` — Detail view modal
- `apps/stok/src/components/monitoring/StatusBadge.tsx` — Shared status indicator component
- `apps/stok/src/hooks/useMonitoringData.ts` — Auto-refresh & data fetching hook
- `apps/stok/src/hooks/useAutoRefresh.ts` — Polling logic (30s interval)

**Styling:**
- `apps/stok/src/styles/monitoring.css` — Custom CSS for status colors, cell highlight animation

**Tests:**
- `apps/stok/src/components/monitoring/__tests__/StatusBadge.test.tsx`
- `apps/stok/src/components/monitoring/__tests__/SPVDashboard.test.tsx`
- `apps/stok/src/components/monitoring/__tests__/CrewDashboard.test.tsx`
- `apps/stok/src/hooks/__tests__/useMonitoringData.test.ts`

### Modified Files

- `apps/stok/src/app/layout.tsx` — Add route link to monitoring
- `apps/stok/src/app/page.tsx` — Add navigation to monitoring dashboard
- `apps/stok/package.json` — Ensure TanStack React Query is installed

### Database/Schema (No changes needed)

Existing tables are sufficient: `stok_balance`, `bahan_baku`, `opname`, `opname_item`, `ledger_stok`

---

## Implementation Tasks

### Task 1: Set Up Monitoring Queries & Types

**Files:**
- Create: `apps/stok/src/lib/queries/monitoring.ts`
- Create: `apps/stok/src/lib/types/monitoring.ts`

- [ ] **Step 1: Create types file with monitoring data structures**

```typescript
// apps/stok/src/lib/types/monitoring.ts

export type StockStatus = 'below' | 'warning' | 'ok';

export interface MonitoringItem {
  outlet_id: string;
  outlet_name: string;
  bahan_baku_id: string;
  item_name: string;
  current_qty: number;
  threshold: number;
  status: StockStatus;
  is_flagged: boolean;
  last_updated: string;
  last_opname_date: string | null;
}

export interface SPVMonitoringData {
  items: MonitoringItem[];
  lastFetched: string;
}

export interface CrewMonitoringData {
  outlet_id: string;
  outlet_name: string;
  items: Omit<MonitoringItem, 'outlet_id' | 'outlet_name'>[];
  summary: {
    below_threshold: number;
    flagged: number;
    ok: number;
    total: number;
  };
  lastFetched: string;
}

export interface OpnameStatus {
  outlet_id: string;
  outlet_name: string;
  last_opname_date: string | null;
  days_since: number;
  is_overdue: boolean;
}

export interface DetailItem extends MonitoringItem {
  recent_ledger: {
    type: string;
    qty: number;
    notes: string;
    created_at: string;
  }[];
  discrepancy_details?: {
    type: 'qty_mismatch' | 'damaged' | 'lost';
    qty_system: number;
    qty_fisik: number;
    catatan: string;
    foto_path?: string;
  };
}
```

- [ ] **Step 2: Create queries file with SQL queries**

```typescript
// apps/stok/src/lib/queries/monitoring.ts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Fetch monitoring data for SPV (multi-outlet view)
 * RLS enforced: SPV role can see all outlets
 */
export async function fetchSPVMonitoringData() {
  const { data, error } = await supabase
    .from('monitoring_view_spv') // We'll create this view in task 2
    .select('*')
    .order('outlet_name')
    .order('item_name');

  if (error) throw error;
  return {
    items: data || [],
    lastFetched: new Date().toISOString(),
  };
}

/**
 * Fetch monitoring data for Crew (single-outlet view)
 * RLS enforced: Crew can only see own outlet
 */
export async function fetchCrewMonitoringData() {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not authenticated');

  // Get user's outlet_id from outlet_staff
  const { data: staffData, error: staffError } = await supabase
    .from('outlet_staff')
    .select('outlet_id, outlets(nama)')
    .eq('id', authData.user.id)
    .single();

  if (staffError) throw staffError;
  if (!staffData) throw new Error('User not assigned to outlet');

  const { data, error } = await supabase
    .from('monitoring_view_crew')
    .select('*')
    .eq('outlet_id', staffData.outlet_id)
    .order('item_name');

  if (error) throw error;

  // Calculate summary
  const summary = {
    below_threshold: (data || []).filter((item) => item.status === 'below').length,
    flagged: (data || []).filter((item) => item.is_flagged).length,
    ok: (data || []).filter((item) => item.status === 'ok').length,
    total: data?.length || 0,
  };

  return {
    outlet_id: staffData.outlet_id,
    outlet_name: staffData.outlets.nama,
    items: data || [],
    summary,
    lastFetched: new Date().toISOString(),
  };
}

/**
 * Fetch detail for a specific item
 */
export async function fetchItemDetail(outletId: string, bahan_baku_id: string) {
  const { data: itemData, error: itemError } = await supabase
    .from('monitoring_view_spv')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('bahan_baku_id', bahan_baku_id)
    .single();

  if (itemError) throw itemError;

  // Fetch recent ledger entries
  const { data: ledgerData, error: ledgerError } = await supabase
    .from('ledger_stok')
    .select('tipe, qty, catatan, created_at')
    .eq('outlet_id', outletId)
    .eq('bahan_baku_id', bahan_baku_id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (ledgerError) throw ledgerError;

  // Fetch opname discrepancy if exists
  const { data: opnameData, error: opnameError } = await supabase
    .from('opname_item')
    .select('qty_system, qty_fisik, catatan, flagged')
    .eq('bahan_baku_id', bahan_baku_id)
    .eq('opname.outlet_id', outletId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const discrepancyDetails = opnameData?.flagged
    ? {
        type: opnameData.qty_fisik < opnameData.qty_system ? 'qty_mismatch' : 'damaged',
        qty_system: opnameData.qty_system,
        qty_fisik: opnameData.qty_fisik,
        catatan: opnameData.catatan || '',
      }
    : undefined;

  return {
    ...itemData,
    recent_ledger: ledgerData || [],
    discrepancy_details: discrepancyDetails,
  };
}

/**
 * Fetch opname status per outlet (for Compliance tab)
 */
export async function fetchOpnameStatus() {
  const { data, error } = await supabase
    .from('outlets')
    .select(`
      id,
      nama,
      opname(created_at)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (
    data?.map((outlet) => {
      const lastOpname = outlet.opname?.[0]?.created_at;
      const lastOpnameDate = lastOpname ? new Date(lastOpname) : null;
      const daysSince = lastOpnameDate
        ? Math.floor((Date.now() - lastOpnameDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        outlet_id: outlet.id,
        outlet_name: outlet.nama,
        last_opname_date: lastOpname,
        days_since: daysSince,
        is_overdue: daysSince && daysSince > 7,
      };
    }) || []
  );
}
```

- [ ] **Step 3: Test queries by running them manually in browser console**

```typescript
// In browser console (after app loads)
const data = await fetch('/api/monitoring/spv').then(r => r.json());
console.log(data);
// Expected: { items: [...], lastFetched: "2026-06-10T..." }
```

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/lib/types/monitoring.ts apps/stok/src/lib/queries/monitoring.ts
git commit -m "feat: add monitoring data queries and types"
```

---

### Task 2: Create Supabase Views for Monitoring Data

**Files:**
- No code files; create migration in Supabase

- [ ] **Step 1: Create migration file**

```bash
touch supabase/migrations/20260610_create_monitoring_views.sql
```

- [ ] **Step 2: Write migration with two views (SPV & Crew)**

```sql
-- supabase/migrations/20260610_create_monitoring_views.sql

-- SPV Monitoring View (multi-outlet, all staff)
CREATE OR REPLACE VIEW monitoring_view_spv AS
SELECT
  sb.outlet_id,
  o.nama as outlet_name,
  sb.bahan_baku_id,
  bb.nama as item_name,
  sb.saldo as current_qty,
  COALESCE(bb.default_reorder_point, 0) as threshold,
  CASE
    WHEN sb.saldo < COALESCE(bb.default_reorder_point, 0) THEN 'below'
    WHEN sb.saldo < COALESCE(bb.default_reorder_point, 0) * 1.2 THEN 'warning'
    ELSE 'ok'
  END as status,
  COALESCE(oi.flagged, false) as is_flagged,
  sb.updated_at as last_updated,
  opn.created_at as last_opname_date
FROM stok_balance sb
JOIN outlets o ON sb.outlet_id = o.id
JOIN bahan_baku bb ON sb.bahan_baku_id = bb.id
LEFT JOIN (
  SELECT bahan_baku_id, flagged, opname_id
  FROM opname_item
  WHERE flagged = true
) oi ON oi.bahan_baku_id = sb.bahan_baku_id
LEFT JOIN (
  SELECT DISTINCT ON (outlet_id) outlet_id, created_at
  FROM opname
  ORDER BY outlet_id, created_at DESC
) opn ON opn.outlet_id = sb.outlet_id
WHERE bb.is_active = true
ORDER BY o.nama, bb.nama;

-- Crew Monitoring View (single outlet, filtered by auth)
CREATE OR REPLACE VIEW monitoring_view_crew AS
SELECT
  sb.outlet_id,
  sb.bahan_baku_id,
  bb.nama as item_name,
  sb.saldo as current_qty,
  COALESCE(bb.default_reorder_point, 0) as threshold,
  CASE
    WHEN sb.saldo < COALESCE(bb.default_reorder_point, 0) THEN 'below'
    WHEN sb.saldo < COALESCE(bb.default_reorder_point, 0) * 1.2 THEN 'warning'
    ELSE 'ok'
  END as status,
  COALESCE(oi.flagged, false) as is_flagged,
  sb.updated_at as last_updated,
  opn.created_at as last_opname_date
FROM stok_balance sb
JOIN bahan_baku bb ON sb.bahan_baku_id = bb.id
LEFT JOIN opname_item oi ON oi.bahan_baku_id = sb.bahan_baku_id AND oi.flagged = true
LEFT JOIN (
  SELECT DISTINCT ON (outlet_id) outlet_id, created_at
  FROM opname
  ORDER BY outlet_id, created_at DESC
) opn ON opn.outlet_id = sb.outlet_id
WHERE bb.is_active = true AND sb.outlet_id = (
  -- RLS: only see own outlet
  SELECT outlet_id FROM outlet_staff WHERE id = auth.uid()
)
ORDER BY bb.nama;

-- Grant RLS policies
ALTER VIEW monitoring_view_spv OWNER TO postgres;
ALTER VIEW monitoring_view_crew OWNER TO postgres;

-- RLS on views: inherit from base tables (stok_balance has RLS)
```

- [ ] **Step 3: Push migration to Supabase**

```bash
npx supabase db push
```

Expected: "Migration pushed successfully"

- [ ] **Step 4: Test view in Supabase SQL editor**

```sql
SELECT * FROM monitoring_view_spv LIMIT 5;
-- Expected: rows with outlet_name, item_name, current_qty, threshold, status, is_flagged
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260610_create_monitoring_views.sql
git commit -m "feat(db): create monitoring views for SPV and crew"
```

---

### Task 3: Create Status Badge Component

**Files:**
- Create: `apps/stok/src/components/monitoring/StatusBadge.tsx`
- Create: `apps/stok/src/styles/monitoring.css`

- [ ] **Step 1: Create Tailwind-based status badge component**

```typescript
// apps/stok/src/components/monitoring/StatusBadge.tsx

'use client';

import React from 'react';
import type { StockStatus } from '@/lib/types/monitoring';

interface StatusBadgeProps {
  status: StockStatus;
  isFlagged?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  isFlagged = false,
  className = '',
}: StatusBadgeProps) {
  const baseClass = 'inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium';

  const statusStyles = {
    below: 'bg-red-100 text-red-700',
    warning: 'bg-yellow-100 text-yellow-700',
    ok: 'bg-green-100 text-green-700',
  };

  const statusEmoji = {
    below: '🔴',
    warning: '🟡',
    ok: '✅',
  };

  return (
    <span className={`${baseClass} ${statusStyles[status]} ${className}`}>
      {statusEmoji[status]}
      {isFlagged && <span className="text-base">📌</span>}
      <span className="capitalize">{status}</span>
    </span>
  );
}
```

- [ ] **Step 2: Add custom CSS for highlight animation**

```css
/* apps/stok/src/styles/monitoring.css */

@keyframes cellHighlight {
  0% {
    background-color: transparent;
  }
  50% {
    background-color: rgba(255, 193, 7, 0.3);
  }
  100% {
    background-color: transparent;
  }
}

.cell-updated {
  animation: cellHighlight 0.5s ease-in-out;
}

/* Table responsive adjustments */
.monitoring-table {
  @apply w-full border-collapse text-sm;
}

.monitoring-table th {
  @apply bg-gray-50 px-4 py-2 text-left font-semibold text-gray-700 border-b-2 border-gray-200;
}

.monitoring-table td {
  @apply px-4 py-2 border-b border-gray-100;
}

.monitoring-table tbody tr:hover {
  @apply bg-gray-50 cursor-pointer;
}

.monitoring-sticky-header {
  position: sticky;
  top: 0;
  background-color: rgb(249, 250, 251);
  z-index: 10;
}

/* Outlet column sticky on mobile */
@media (max-width: 768px) {
  .monitoring-outlet-col {
    position: sticky;
    left: 0;
    background-color: white;
    z-index: 5;
  }

  .monitoring-table tbody tr:hover .monitoring-outlet-col {
    background-color: rgb(249, 250, 251);
  }
}
```

- [ ] **Step 3: Import CSS in layout**

```typescript
// In apps/stok/src/app/layout.tsx, add:
import '@/styles/monitoring.css';
```

- [ ] **Step 4: Write test for StatusBadge**

```typescript
// apps/stok/src/components/monitoring/__tests__/StatusBadge.test.tsx

import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders below status with red styling', () => {
    render(<StatusBadge status="below" />);
    expect(screen.getByText('🔴')).toBeInTheDocument();
    const badge = screen.getByText('below').parentElement;
    expect(badge).toHaveClass('bg-red-100');
  });

  it('renders warning status with yellow styling', () => {
    render(<StatusBadge status="warning" />);
    expect(screen.getByText('🟡')).toBeInTheDocument();
  });

  it('renders ok status with green styling', () => {
    render(<StatusBadge status="ok" />);
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('shows flagged icon when isFlagged=true', () => {
    render(<StatusBadge status="below" isFlagged={true} />);
    expect(screen.getByText('📌')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run test**

```bash
cd apps/stok && npm test -- StatusBadge.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/stok/src/components/monitoring/StatusBadge.tsx apps/stok/src/styles/monitoring.css apps/stok/src/components/monitoring/__tests__/StatusBadge.test.tsx
git commit -m "feat: add status badge component with styling"
```

---

### Task 4: Create useMonitoringData Hook (Auto-Refresh)

**Files:**
- Create: `apps/stok/src/hooks/useMonitoringData.ts`
- Create: `apps/stok/src/hooks/useAutoRefresh.ts`

- [ ] **Step 1: Create useAutoRefresh hook for polling logic**

```typescript
// apps/stok/src/hooks/useAutoRefresh.ts

import { useEffect, useRef } from 'react';

interface UseAutoRefreshOptions {
  interval?: number; // ms, default 30000
  onRefresh: () => Promise<void>;
  enabled?: boolean;
}

export function useAutoRefresh({
  interval = 30000,
  onRefresh,
  enabled = true,
}: UseAutoRefreshOptions) {
  const intervalRef = useRef<NodeJS.Timeout>();
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Initial refresh
    if (!pausedRef.current) {
      onRefresh().catch(console.error);
    }

    // Set up interval
    intervalRef.current = setInterval(() => {
      if (!pausedRef.current) {
        onRefresh().catch(console.error);
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, onRefresh, enabled]);

  const pause = () => {
    pausedRef.current = true;
  };

  const resume = () => {
    pausedRef.current = false;
    onRefresh().catch(console.error);
  };

  const isPaused = () => pausedRef.current;

  return { pause, resume, isPaused };
}
```

- [ ] **Step 2: Create useMonitoringData hook for SPV**

```typescript
// apps/stok/src/hooks/useMonitoringData.ts

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SPVMonitoringData } from '@/lib/types/monitoring';
import { fetchSPVMonitoringData, fetchCrewMonitoringData } from '@/lib/queries/monitoring';
import { useAutoRefresh } from './useAutoRefresh';

export function useSPVMonitoringData() {
  const queryClient = useQueryClient();
  const [isError, setIsError] = useState(false);
  const [cachedData, setCachedData] = useState<SPVMonitoringData | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['monitoring', 'spv'],
    queryFn: async () => {
      try {
        const result = await fetchSPVMonitoringData();
        setCachedData(result);
        setIsError(false);
        return result;
      } catch (err) {
        setIsError(true);
        // Return cached data on error
        if (cachedData) {
          return cachedData;
        }
        throw err;
      }
    },
    staleTime: 25000, // Consider stale after 25s (refresh at 30s)
    gcTime: 60000, // Keep in cache for 1 min
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const autoRefresh = useAutoRefresh({
    interval: 30000,
    onRefresh: handleRefresh,
  });

  return {
    data,
    isLoading,
    error,
    isError,
    refetch: handleRefresh,
    autoRefresh,
    lastFetched: data?.lastFetched || cachedData?.lastFetched,
  };
}

export function useCrewMonitoringData() {
  const queryClient = useQueryClient();
  const [isError, setIsError] = useState(false);
  const [cachedData, setCachedData] = useState<CrewMonitoringData | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['monitoring', 'crew'],
    queryFn: async () => {
      try {
        const result = await fetchCrewMonitoringData();
        setCachedData(result);
        setIsError(false);
        return result;
      } catch (err) {
        setIsError(true);
        if (cachedData) {
          return cachedData;
        }
        throw err;
      }
    },
    staleTime: 25000,
    gcTime: 60000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const autoRefresh = useAutoRefresh({
    interval: 30000,
    onRefresh: handleRefresh,
  });

  return {
    data,
    isLoading,
    error,
    isError,
    refetch: handleRefresh,
    autoRefresh,
    lastFetched: data?.lastFetched || cachedData?.lastFetched,
  };
}
```

- [ ] **Step 3: Write tests for hooks**

```typescript
// apps/stok/src/hooks/__tests__/useMonitoringData.test.ts

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSPVMonitoringData } from '../useMonitoringData';
import * as monitoringQueries from '@/lib/queries/monitoring';

jest.mock('@/lib/queries/monitoring');

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useSPVMonitoringData', () => {
  it('fetches SPV monitoring data on mount', async () => {
    const mockData = {
      items: [{ outlet_id: '1', item_name: 'Minyak', current_qty: 8, threshold: 15, status: 'below', is_flagged: false, outlet_name: 'Bandung', last_updated: '2026-06-10T10:00:00Z', last_opname_date: '2026-06-09T10:00:00Z' }],
      lastFetched: '2026-06-10T10:00:00Z',
    };

    jest.mocked(monitoringQueries.fetchSPVMonitoringData).mockResolvedValue(mockData);

    const { result } = renderHook(() => useSPVMonitoringData(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
  });

  it('handles errors and returns cached data', async () => {
    const mockError = new Error('Network error');
    jest.mocked(monitoringQueries.fetchSPVMonitoringData).mockRejectedValue(mockError);

    const { result } = renderHook(() => useSPVMonitoringData(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd apps/stok && npm test -- useMonitoringData.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/hooks/useMonitoringData.ts apps/stok/src/hooks/useAutoRefresh.ts apps/stok/src/hooks/__tests__/useMonitoringData.test.ts
git commit -m "feat: add auto-refresh hooks with error handling"
```

---

### Task 5: Create SPV Dashboard Components

**Files:**
- Create: `apps/stok/src/components/monitoring/SPVDashboard.tsx`
- Create: `apps/stok/src/components/monitoring/SPVTabs.tsx`
- Create: `apps/stok/src/components/monitoring/SPVTable.tsx`

- [ ] **Step 1: Create SPVTable component (sortable/filterable)**

```typescript
// apps/stok/src/components/monitoring/SPVTable.tsx

'use client';

import React, { useState, useMemo } from 'react';
import { StatusBadge } from './StatusBadge';
import type { MonitoringItem } from '@/lib/types/monitoring';

interface SPVTableProps {
  items: MonitoringItem[];
  tab: 'overview' | 'alerts' | 'compliance';
  onRowClick: (item: MonitoringItem) => void;
}

type SortField = 'outlet_name' | 'item_name' | 'status' | 'last_updated';
type SortDir = 'asc' | 'desc';

export function SPVTable({ items, tab, onRowClick }: SPVTableProps) {
  const [sortField, setSortField] = useState<SortField>('outlet_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'below' | 'warning' | 'ok'>('all');
  const [filterOutlet, setFilterOutlet] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    let result = items;

    // Filter by tab
    if (tab === 'alerts') {
      result = result.filter((item) => item.status !== 'ok' || item.is_flagged);
    } else if (tab === 'compliance') {
      result = result.filter((item) => item.is_flagged);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter((item) => item.status === filterStatus);
    }

    // Filter by outlet
    if (filterOutlet) {
      result = result.filter((item) => item.outlet_id === filterOutlet);
    }

    // Filter by search term
    if (searchTerm) {
      result = result.filter((item) =>
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'status') {
        const statusOrder = { below: 0, warning: 1, ok: 2 };
        aVal = statusOrder[a.status as keyof typeof statusOrder];
        bVal = statusOrder[b.status as keyof typeof statusOrder];
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, tab, filterStatus, filterOutlet, searchTerm, sortField, sortDir]);

  const uniqueOutlets = useMemo(
    () => Array.from(new Set(items.map((item) => item.outlet_id))),
    [items]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 flex-wrap bg-gray-50 p-4 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>

        <select
          value={filterOutlet}
          onChange={(e) => setFilterOutlet(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="">All Outlets</option>
          {uniqueOutlets.map((outletId) => {
            const outletName = items.find((item) => item.outlet_id === outletId)?.outlet_name;
            return (
              <option key={outletId} value={outletId}>
                {outletName}
              </option>
            );
          })}
        </select>

        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="status"
              value="all"
              checked={filterStatus === 'all'}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            />
            All
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="status"
              value="below"
              checked={filterStatus === 'below'}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            />
            Below
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="status"
              value="warning"
              checked={filterStatus === 'warning'}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            />
            Warning
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="status"
              value="ok"
              checked={filterStatus === 'ok'}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            />
            OK
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="monitoring-table w-full">
          <thead className="monitoring-sticky-header">
            <tr>
              <th>
                <button
                  onClick={() => handleSort('outlet_name')}
                  className="hover:text-blue-600"
                >
                  Outlet {sortField === 'outlet_name' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => handleSort('item_name')}
                  className="hover:text-blue-600"
                >
                  Item {sortField === 'item_name' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="text-right">Qty Now</th>
              <th className="text-right">Threshold</th>
              <th>
                <button
                  onClick={() => handleSort('status')}
                  className="hover:text-blue-600"
                >
                  Status {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="hidden md:table-cell">
                <button
                  onClick={() => handleSort('last_updated')}
                  className="hover:text-blue-600"
                >
                  Updated {sortField === 'last_updated' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No items found
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={`${item.outlet_id}-${item.bahan_baku_id}`}
                  onClick={() => onRowClick(item)}
                  className="hover:bg-blue-50 cursor-pointer"
                >
                  <td className="monitoring-outlet-col font-medium">{item.outlet_name}</td>
                  <td>{item.item_name}</td>
                  <td className="text-right">{item.current_qty}</td>
                  <td className="text-right">{item.threshold}</td>
                  <td>
                    <StatusBadge status={item.status} isFlagged={item.is_flagged} />
                  </td>
                  <td className="hidden md:table-cell text-sm text-gray-600">
                    {new Date(item.last_updated).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-500">
        Showing {filteredItems.length} of {items.length} items
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SPVTabs component**

```typescript
// apps/stok/src/components/monitoring/SPVTabs.tsx

'use client';

import React from 'react';

interface SPVTabsProps {
  activeTab: 'overview' | 'alerts' | 'compliance';
  onTabChange: (tab: 'overview' | 'alerts' | 'compliance') => void;
  alertCount: number;
}

export function SPVTabs({ activeTab, onTabChange, alertCount }: SPVTabsProps) {
  const tabs = [
    { id: 'overview', label: 'Overview', count: null },
    { id: 'alerts', label: 'Alerts', count: alertCount },
    { id: 'compliance', label: 'Compliance', count: null },
  ] as const;

  return (
    <div className="flex gap-0 border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          {tab.label}
          {tab.count !== null && <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create SPVDashboard main component**

```typescript
// apps/stok/src/components/monitoring/SPVDashboard.tsx

'use client';

import React, { useState } from 'react';
import { SPVTabs } from './SPVTabs';
import { SPVTable } from './SPVTable';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useSPVMonitoringData } from '@/hooks/useMonitoringData';
import type { MonitoringItem } from '@/lib/types/monitoring';

export function SPVDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'compliance'>('overview');
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  const { data, isLoading, isError, lastFetched, refetch, autoRefresh } = useSPVMonitoringData();

  const alertCount = (data?.items || []).filter((item) => item.status !== 'ok' || item.is_flagged).length;

  if (isLoading && !data) {
    return <div className="text-center py-8">Loading monitoring data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-suka-brown">SPV Monitoring Dashboard</h1>
        <div className="flex gap-2 items-center">
          {isError && (
            <div className="bg-yellow-50 text-yellow-700 px-4 py-2 rounded text-sm border border-yellow-200">
              Connection unstable, showing cached data
            </div>
          )}
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
          <button
            onClick={autoRefresh.isPaused() ? autoRefresh.resume : autoRefresh.pause}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
          >
            {autoRefresh.isPaused() ? 'Resume (30s)' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Last updated */}
      <div className="text-sm text-gray-500">
        Last updated: {lastFetched ? new Date(lastFetched).toLocaleTimeString('id-ID') : 'Never'}
      </div>

      {/* Tabs */}
      <SPVTabs activeTab={activeTab} onTabChange={setActiveTab} alertCount={alertCount} />

      {/* Table */}
      <SPVTable items={data?.items || []} tab={activeTab} onRowClick={setSelectedItem} />

      {/* Detail Modal */}
      {selectedItem && (
        <MonitoringDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          isOpen={!!selectedItem}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write test for SPVTable**

```typescript
// apps/stok/src/components/monitoring/__tests__/SPVTable.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { SPVTable } from '../SPVTable';
import type { MonitoringItem } from '@/lib/types/monitoring';

const mockItem: MonitoringItem = {
  outlet_id: '1',
  outlet_name: 'Bandung',
  bahan_baku_id: 'bb1',
  item_name: 'Minyak',
  current_qty: 8,
  threshold: 15,
  status: 'below',
  is_flagged: false,
  last_updated: '2026-06-10T10:00:00Z',
  last_opname_date: '2026-06-09T10:00:00Z',
};

describe('SPVTable', () => {
  it('renders table with items', () => {
    render(<SPVTable items={[mockItem]} tab="overview" onRowClick={() => {}} />);
    expect(screen.getByText('Bandung')).toBeInTheDocument();
    expect(screen.getByText('Minyak')).toBeInTheDocument();
  });

  it('filters by outlet', () => {
    render(<SPVTable items={[mockItem]} tab="overview" onRowClick={() => {}} />);
    const outlet select = screen.getByDisplayValue('All Outlets');
    fireEvent.change(outlet select, { target: { value: '1' } });
    expect(screen.getByText('Bandung')).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = jest.fn();
    render(<SPVTable items={[mockItem]} tab="overview" onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Minyak'));
    expect(onRowClick).toHaveBeenCalledWith(mockItem);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd apps/stok && npm test -- SPVTable.test.tsx SPVDashboard.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/stok/src/components/monitoring/SPVDashboard.tsx apps/stok/src/components/monitoring/SPVTabs.tsx apps/stok/src/components/monitoring/SPVTable.tsx apps/stok/src/components/monitoring/__tests__/SPVTable.test.tsx
git commit -m "feat: create SPV dashboard with tabs and sortable table"
```

---

### Task 6: Create Crew Dashboard Components

**Files:**
- Create: `apps/stok/src/components/monitoring/CrewDashboard.tsx`
- Create: `apps/stok/src/components/monitoring/CrewList.tsx`

- [ ] **Step 1: Create CrewList component**

```typescript
// apps/stok/src/components/monitoring/CrewList.tsx

'use client';

import React, { useState, useMemo } from 'react';
import { StatusBadge } from './StatusBadge';
import type { MonitoringItem } from '@/lib/types/monitoring';

interface CrewListProps {
  items: MonitoringItem[];
  onItemClick: (item: MonitoringItem) => void;
}

type SortBy = 'status' | 'name';

export function CrewList({ items, onItemClick }: CrewListProps) {
  const [sortBy, setSortBy] = useState<SortBy>('status');
  const [filterStatus, setFilterStatus] = useState<'all' | 'below' | 'flagged'>('all');

  const filteredAndSorted = useMemo(() => {
    let result = items;

    // Filter
    if (filterStatus === 'below') {
      result = result.filter((item) => item.status === 'below');
    } else if (filterStatus === 'flagged') {
      result = result.filter((item) => item.is_flagged);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'status') {
        const statusOrder = { below: 0, warning: 1, ok: 2 };
        const aOrder = statusOrder[a.status];
        const bOrder = statusOrder[b.status];
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.item_name.localeCompare(b.item_name);
      } else {
        return a.item_name.localeCompare(b.item_name);
      }
    });

    return result;
  }, [items, sortBy, filterStatus]);

  const belowCount = items.filter((item) => item.status === 'below').length;
  const flaggedCount = items.filter((item) => item.is_flagged).length;
  const okCount = items.filter((item) => item.status === 'ok' && !item.is_flagged).length;

  return (
    <div className="space-y-4">
      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setFilterStatus(filterStatus === 'below' ? 'all' : 'below')}
          className={`p-4 rounded-lg border-2 text-center transition-colors ${
            filterStatus === 'below'
              ? 'bg-red-50 border-red-300'
              : 'bg-gray-50 border-gray-200 hover:border-red-200'
          }`}
        >
          <div className="text-2xl font-bold text-red-700">{belowCount}</div>
          <div className="text-sm text-gray-600">Below Threshold</div>
        </button>

        <button
          onClick={() => setFilterStatus(filterStatus === 'flagged' ? 'all' : 'flagged')}
          className={`p-4 rounded-lg border-2 text-center transition-colors ${
            filterStatus === 'flagged'
              ? 'bg-orange-50 border-orange-300'
              : 'bg-gray-50 border-gray-200 hover:border-orange-200'
          }`}
        >
          <div className="text-2xl font-bold text-orange-700">{flaggedCount}</div>
          <div className="text-sm text-gray-600">Flagged Discrepancies</div>
        </button>

        <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50 text-center">
          <div className="text-2xl font-bold text-green-700">{okCount}</div>
          <div className="text-sm text-gray-600">OK</div>
        </div>
      </div>

      {/* Sort dropdown */}
      <div className="flex gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="sort"
            value="status"
            checked={sortBy === 'status'}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          />
          Sort by Status
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="sort"
            value="name"
            checked={sortBy === 'name'}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          />
          Sort by Name
        </label>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {filterStatus === 'all' ? 'No items found' : `No ${filterStatus} items`}
          </div>
        ) : (
          filteredAndSorted.map((item) => (
            <div
              key={item.bahan_baku_id}
              onClick={() => onItemClick(item)}
              className="flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors min-h-[56px]"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.item_name}</div>
                <div className="text-sm text-gray-600">
                  {item.current_qty} / {item.threshold} {item.threshold === 0 ? '(no threshold)' : ''}
                </div>
              </div>
              <StatusBadge status={item.status} isFlagged={item.is_flagged} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CrewDashboard component**

```typescript
// apps/stok/src/components/monitoring/CrewDashboard.tsx

'use client';

import React, { useState } from 'react';
import { CrewList } from './CrewList';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useCrewMonitoringData } from '@/hooks/useMonitoringData';
import type { MonitoringItem } from '@/lib/types/monitoring';

export function CrewDashboard() {
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  const { data, isLoading, isError, lastFetched, refetch, autoRefresh } = useCrewMonitoringData();

  if (isLoading && !data) {
    return <div className="text-center py-8">Loading monitoring data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-suka-brown">{data?.outlet_name} - Monitoring</h1>
          <p className="text-sm text-gray-600 mt-1">Check stok status before shifts & opname</p>
        </div>
        <div className="flex gap-2 items-center">
          {isError && (
            <div className="bg-yellow-50 text-yellow-700 px-4 py-2 rounded text-sm border border-yellow-200">
              Connection unstable
            </div>
          )}
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Last updated */}
      <div className="text-sm text-gray-500">
        Last updated: {lastFetched ? new Date(lastFetched).toLocaleTimeString('id-ID') : 'Never'}
      </div>

      {/* List */}
      <CrewList items={data?.items || []} onItemClick={setSelectedItem} />

      {/* Detail Modal */}
      {selectedItem && (
        <MonitoringDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          isOpen={!!selectedItem}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write test for CrewDashboard**

```typescript
// apps/stok/src/components/monitoring/__tests__/CrewDashboard.test.tsx

import { render, screen } from '@testing-library/react';
import { CrewDashboard } from '../CrewDashboard';
import * as hook from '@/hooks/useMonitoringData';

jest.mock('@/hooks/useMonitoringData');

describe('CrewDashboard', () => {
  it('renders crew dashboard with outlet name', () => {
    jest.mocked(hook.useCrewMonitoringData).mockReturnValue({
      data: {
        outlet_id: '1',
        outlet_name: 'Bandung',
        items: [],
        summary: { below_threshold: 0, flagged: 0, ok: 0, total: 0 },
        lastFetched: '2026-06-10T10:00:00Z',
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      autoRefresh: { pause: jest.fn(), resume: jest.fn(), isPaused: () => false },
      lastFetched: '2026-06-10T10:00:00Z',
    } as any);

    render(<CrewDashboard />);
    expect(screen.getByText('Bandung - Monitoring')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd apps/stok && npm test -- CrewDashboard.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/components/monitoring/CrewDashboard.tsx apps/stok/src/components/monitoring/CrewList.tsx apps/stok/src/components/monitoring/__tests__/CrewDashboard.test.tsx
git commit -m "feat: create crew dashboard with item list"
```

---

### Task 7: Create Shared Detail Modal Component

**Files:**
- Create: `apps/stok/src/components/monitoring/MonitoringDetailModal.tsx`

- [ ] **Step 1: Create detail modal component**

```typescript
// apps/stok/src/components/monitoring/MonitoringDetailModal.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { fetchItemDetail } from '@/lib/queries/monitoring';
import type { MonitoringItem, DetailItem } from '@/lib/types/monitoring';

interface MonitoringDetailModalProps {
  item: MonitoringItem;
  onClose: () => void;
  isOpen: boolean;
}

export function MonitoringDetailModal({ item, onClose, isOpen }: MonitoringDetailModalProps) {
  const [detail, setDetail] = useState<DetailItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    fetchItemDetail(item.outlet_id, item.bahan_baku_id)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [isOpen, item]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-suka-brown to-suka-orange p-6 text-white flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">{item.item_name}</h2>
            <p className="text-sm opacity-90 mt-1">{item.outlet_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="text-center py-8">Loading details...</div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200">
              Error: {error}
            </div>
          ) : detail ? (
            <>
              {/* Current Status */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Current Qty</p>
                  <p className="text-3xl font-bold text-suka-brown">{detail.current_qty}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Threshold</p>
                  <p className="text-3xl font-bold text-gray-700">{detail.threshold}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <div className="mt-2">
                    <StatusBadge status={detail.status} isFlagged={detail.is_flagged} />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Last Opname</p>
                  <p className="text-lg font-medium text-gray-700">
                    {detail.last_opname_date
                      ? new Date(detail.last_opname_date).toLocaleDateString('id-ID')
                      : 'Never'}
                  </p>
                </div>
              </div>

              {/* Discrepancy Details */}
              {detail.discrepancy_details && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <h3 className="font-semibold text-orange-900 mb-2">📌 Flagged Discrepancy</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Type:</dt>
                      <dd className="font-medium">{detail.discrepancy_details.type.replace('_', ' ')}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">System Qty:</dt>
                      <dd className="font-medium">{detail.discrepancy_details.qty_system}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Physical Qty:</dt>
                      <dd className="font-medium">{detail.discrepancy_details.qty_fisik}</dd>
                    </div>
                    {detail.discrepancy_details.catatan && (
                      <div className="col-span-2 mt-3 pt-3 border-t border-orange-200">
                        <dt className="text-gray-600 mb-1">Notes:</dt>
                        <dd className="font-medium">{detail.discrepancy_details.catatan}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Recent Ledger */}
              {detail.recent_ledger.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Recent Movements</h3>
                  <div className="space-y-2">
                    {detail.recent_ledger.map((ledger, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-start p-3 border border-gray-200 rounded"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 capitalize">{ledger.type.replace('_', ' ')}</p>
                          {ledger.notes && (
                            <p className="text-sm text-gray-600 mt-1">{ledger.notes}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(ledger.created_at).toLocaleString('id-ID')}
                          </p>
                        </div>
                        <p className="font-bold text-gray-900 whitespace-nowrap ml-4">
                          {ledger.qty > 0 ? '+' : ''}{ledger.qty}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-6 border-t flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/stok/src/components/monitoring/MonitoringDetailModal.tsx
git commit -m "feat: add detail modal with ledger and discrepancy info"
```

---

### Task 8: Create Main Monitoring Page & Role Detection

**Files:**
- Create: `apps/stok/src/app/stok/monitoring/page.tsx`
- Create: `apps/stok/src/components/monitoring/MonitoringPage.tsx`
- Modify: `apps/stok/src/app/layout.tsx` (add route link)

- [ ] **Step 1: Create MonitoringPage with role detection**

```typescript
// apps/stok/src/components/monitoring/MonitoringPage.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { SPVDashboard } from './SPVDashboard';
import { CrewDashboard } from './CrewDashboard';
import { useAuth } from '@/context/AuthContext';

export function MonitoringPage() {
  const { user, userRole } = useAuth();
  const [isSPV, setIsSPV] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Determine if user is SPV based on role
    const spvRoles = ['spv_produksi', 'spv_stok', 'admin'];
    setIsSPV(spvRoles.includes(userRole || ''));
    setIsLoading(false);
  }, [userRole]);

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!user) {
    return <div className="text-center py-8 text-red-600">Not authenticated</div>;
  }

  return isSPV ? <SPVDashboard /> : <CrewDashboard />;
}
```

- [ ] **Step 2: Create page route**

```typescript
// apps/stok/src/app/stok/monitoring/page.tsx

import { MonitoringPage } from '@/components/monitoring/MonitoringPage';

export const metadata = {
  title: 'Monitoring - Stok Management',
};

export default function Page() {
  return <MonitoringPage />;
}
```

- [ ] **Step 3: Update layout to add navigation link**

Update `apps/stok/src/app/layout.tsx` to include monitoring in sidebar/navigation:

```typescript
// Add to navigation menu in layout
<a
  href="/stok/monitoring"
  className="block px-4 py-2 hover:bg-suka-orange/10 rounded"
>
  📊 Monitoring
</a>
```

- [ ] **Step 4: Test page loads**

```bash
cd apps/stok && npm run dev
# Navigate to http://localhost:3000/stok/monitoring
# Should see SPV or Crew dashboard based on role
```

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/components/monitoring/MonitoringPage.tsx apps/stok/src/app/stok/monitoring/page.tsx
git commit -m "feat: create monitoring page with role-based routing"
```

---

### Task 9: Integration Testing & E2E Verification

**Files:**
- Create: `apps/stok/src/components/monitoring/__tests__/integration.test.tsx`

- [ ] **Step 1: Write integration test**

```typescript
// apps/stok/src/components/monitoring/__tests__/integration.test.tsx

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MonitoringPage } from '../MonitoringPage';
import * as AuthContext from '@/context/AuthContext';

jest.mock('@/context/AuthContext');

const queryClient = new QueryClient();

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('Monitoring Integration', () => {
  it('renders SPV dashboard for SPV role', async () => {
    jest.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: 'user1' } as any,
      userRole: 'spv_produksi',
      logout: jest.fn(),
    } as any);

    render(<MonitoringPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/SPV Monitoring Dashboard/i)).toBeInTheDocument();
    });
  });

  it('renders Crew dashboard for non-SPV role', async () => {
    jest.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: 'user2' } as any,
      userRole: 'crew',
      logout: jest.fn(),
    } as any);

    render(<MonitoringPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Monitoring/i)).toBeInTheDocument();
    });
  });

  it('shows error state when not authenticated', () => {
    jest.mocked(AuthContext.useAuth).mockReturnValue({
      user: null,
      userRole: null,
      logout: jest.fn(),
    } as any);

    render(<MonitoringPage />, { wrapper });
    expect(screen.getByText(/Not authenticated/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run all monitoring tests**

```bash
cd apps/stok && npm test -- monitoring
```

Expected: All tests PASS

- [ ] **Step 3: Manual smoke test**

```
1. Start app: npm run dev
2. Navigate to /stok/monitoring
3. For SPV role:
   - See 3 tabs (Overview, Alerts, Compliance)
   - See sortable/filterable table with Outlet, Item, Qty, Threshold, Status
   - Click row → detail modal opens
   - Click Refresh → data updates
   - Auto-refresh every 30s
4. For Crew role:
   - See summary counts (Below Threshold, Flagged, OK)
   - See flat list of items
   - Click summary count → filter applied
   - Click item → detail modal opens
```

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/components/monitoring/__tests__/integration.test.tsx
git commit -m "test: add integration tests for monitoring page"
```

---

### Task 10: Error Handling & Edge Cases

**Files:**
- Modify: `apps/stok/src/hooks/useMonitoringData.ts`
- Modify: `apps/stok/src/components/monitoring/SPVDashboard.tsx`
- Modify: `apps/stok/src/components/monitoring/CrewDashboard.tsx`

- [ ] **Step 1: Test error scenarios**

Test cases:
```
1. Network timeout during initial fetch
   - Expected: Loading spinner, then show cached data or empty state
2. Network error during auto-refresh
   - Expected: Silent retry, show "Connection unstable" badge
3. Empty result (no items for outlet)
   - Expected: Empty state message
4. Threshold is null
   - Expected: Show "—" for threshold, gray status
```

- [ ] **Step 2: Add empty state handling**

```typescript
// Update CrewDashboard and SPVDashboard to show empty state
if (!data?.items || data.items.length === 0) {
  return (
    <div className="text-center py-12">
      <p className="text-gray-600 mb-2">No monitoring data yet</p>
      <p className="text-sm text-gray-500">Create your first opname to start tracking stok</p>
    </div>
  );
}
```

- [ ] **Step 3: Test edge cases**

```bash
cd apps/stok && npm test -- monitoring
# Verify all error scenarios handled gracefully
```

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/hooks/useMonitoringData.ts apps/stok/src/components/monitoring/SPVDashboard.tsx apps/stok/src/components/monitoring/CrewDashboard.tsx
git commit -m "feat: add error handling and empty states"
```

---

## Execution Paths

Choose one:

**1. Subagent-Driven (Recommended)**
- Each task gets fresh subagent + review between tasks
- Faster iteration, independent execution
- Use `superpowers:subagent-driven-development`

**2. Inline Execution**
- Execute tasks sequentially in this session
- Use `superpowers:executing-plans`
- Batch review at checkpoints

---

## Success Criteria Verification

After implementation, verify:

- [ ] SPV sees multi-outlet table with 3 tabs
- [ ] Crew sees single-outlet flat list
- [ ] Auto-refresh every 30s (pause/resume controls work)
- [ ] Status colors: Red (below), Yellow (warning), Green (OK)
- [ ] Flagged items show 📌 indicator
- [ ] Click row → detail modal with ledger + discrepancy info
- [ ] Filters work (outlet, status, search)
- [ ] RLS enforced (crew can't see other outlets)
- [ ] Error handling: graceful degradation, cached data fallback
- [ ] Mobile responsive (tablet primary)
- [ ] All tests pass
