# Production Estimate Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a real-time production estimate widget for the Crew Dashboard that calculates the maximum number of Shawarma portions that can be made based on current stock bottlenecks.

**Architecture:** A pure helper function will calculate the estimates based on a static recipe mapping and the current stock items array. A new UI component `ProductionEstimateWidget` will consume this helper and display the results. Finally, `CrewDashboard.tsx` will be updated to render the widget in the right column.

**Tech Stack:** React, Next.js, TailwindCSS, TypeScript.

## Global Constraints

- Must rely on existing `data.items` from `useCrewMonitoringData` hook.
- Logic must be client-side without extra backend queries.

---

### Task 1: Create Production Estimate Logic

**Files:**
- Create: `src/lib/stok/productionEstimate.ts`

**Interfaces:**
- Consumes: `MonitoringItem` from `src/lib/types/monitoring.ts`
- Produces: `calculateProductionEstimate(items: MonitoringItem[]): { menuName: string, estimatedPortions: number, limitingIngredient: string }[]`

- [ ] **Step 1: Write the minimal implementation**

```typescript
import type { MonitoringItem } from '../types/monitoring';

export interface ProductionEstimate {
  menuName: string;
  estimatedPortions: number;
  limitingIngredient: string;
}

const RECIPES = [
  {
    menuName: 'Shawarma Besar',
    ingredients: [
      { name: 'Daging Sapi (B)', requiredBaseQty: 80 }, // Using base qty (gram) for standard
      { name: 'Tortilla Besar', requiredBaseQty: 1 } // assuming pcs
    ]
  },
  {
    menuName: 'Shawarma Kecil',
    ingredients: [
      { name: 'Daging Sapi (K)', requiredBaseQty: 50 },
      { name: 'Tortilla Kecil', requiredBaseQty: 1 }
    ]
  }
];

export function calculateProductionEstimate(items: MonitoringItem[]): ProductionEstimate[] {
  if (!items || items.length === 0) return [];

  return RECIPES.map(recipe => {
    let minPortions = Infinity;
    let bottleneck = 'Tidak ada bahan';

    for (const req of recipe.ingredients) {
      // Fuzzy matching by name if needed, or exact matching if exact names are used
      const stockItem = items.find(i => 
        i.item_name.toLowerCase().includes(req.name.toLowerCase().replace(' (b)', '').replace(' (k)', '')) && 
        (req.name.includes('Tortilla') ? i.item_name.toLowerCase().includes('tortilla') : true)
      );

      if (!stockItem) {
        minPortions = 0;
        bottleneck = req.name;
        continue;
      }

      // Convert current_qty to base qty if needed, assuming current_qty is in base units for calculation
      // Simplification: assume current_qty is in standard smallest unit (e.g. gram, pcs)
      const portions = Math.floor(stockItem.current_qty / req.requiredBaseQty);
      
      if (portions < minPortions) {
        minPortions = portions;
        bottleneck = stockItem.item_name;
      }
    }

    if (minPortions === Infinity) minPortions = 0;

    return {
      menuName: recipe.menuName,
      estimatedPortions: minPortions,
      limitingIngredient: bottleneck
    };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stok/productionEstimate.ts
git commit -m "feat: add calculateProductionEstimate logic"
```

---

### Task 2: Create Production Estimate Widget Component

**Files:**
- Create: `src/components/monitoring/ProductionEstimateWidget.tsx`

**Interfaces:**
- Consumes: `ProductionEstimate`, `calculateProductionEstimate` from `src/lib/stok/productionEstimate.ts`, `MonitoringItem[]` (passed as props)
- Produces: `export function ProductionEstimateWidget({ items }: { items: MonitoringItem[] })`

- [ ] **Step 1: Write the minimal implementation**

```tsx
'use client';

import React, { useMemo } from 'react';
import type { MonitoringItem } from '@/lib/types/monitoring';
import { calculateProductionEstimate } from '@/lib/stok/productionEstimate';

interface Props {
  items: MonitoringItem[];
}

export function ProductionEstimateWidget({ items }: Props) {
  const estimates = useMemo(() => calculateProductionEstimate(items), [items]);

  if (estimates.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-suka-brown/20 shadow-sm p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2 text-suka-orange">
        <span className="text-xl">🥙</span>
        <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Estimasi Produksi</h2>
      </div>
      
      <div className="space-y-3">
        {estimates.map((est) => (
          <div key={est.menuName} className="flex flex-col p-3 bg-suka-cream/30 rounded-xl border border-suka-brown/10">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-suka-brown text-sm">{est.menuName}</span>
              <span className="font-black text-lg text-suka-orange">~{est.estimatedPortions}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
              Maks porsi (Limit: <span className="text-red-500 font-bold">{est.limitingIngredient}</span>)
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/monitoring/ProductionEstimateWidget.tsx
git commit -m "feat: add ProductionEstimateWidget component"
```

---

### Task 3: Render Widget in Crew Dashboard

**Files:**
- Modify: `src/components/monitoring/CrewDashboard.tsx`

**Interfaces:**
- Consumes: `ProductionEstimateWidget`

- [ ] **Step 1: Write the minimal implementation**

Update `src/components/monitoring/CrewDashboard.tsx` to import and place the widget above the "Aksi Cepat" section.

```tsx
// ADD IMPORT AT TOP
import { ProductionEstimateWidget } from './ProductionEstimateWidget';

// IN RENDER, INSERT BEFORE "Aksi Cepat" section (around line 245)
          {/* Section: Production Estimate Widget */}
          {!isLoading && data?.items && data.items.length > 0 && (
            <ProductionEstimateWidget items={data.items} />
          )}

          <section className="bg-white border border-suka-brown/20 rounded-2xl p-5 shadow-sm space-y-4">
```

- [ ] **Step 2: Commit**

```bash
git add src/components/monitoring/CrewDashboard.tsx
git commit -m "feat: render ProductionEstimateWidget in CrewDashboard"
```
