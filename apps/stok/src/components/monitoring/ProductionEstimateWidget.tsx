'use client';

import React, { useMemo } from 'react';
import type { MonitoringItem } from '@/lib/types/monitoring';
import { calculateProductionEstimate } from '@/lib/stok/productionEstimate';

interface Props {
  items: Partial<MonitoringItem>[];
}

export function ProductionEstimateWidget({ items }: Props) {
  const estimates = useMemo(() => calculateProductionEstimate(items), [items]);

  if (estimates.length === 0) return null;

  return (
    <details className="group bg-white rounded-2xl border border-suka-brown/20 shadow-sm flex flex-col">
      <summary className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3.5 select-none">
        <h3 className="font-black text-xs text-suka-brown tracking-wider uppercase flex items-center gap-1.5">
          <span>🥙</span> Estimasi Produksi
        </h3>
        <span className="text-suka-brown/50 transition-transform group-open:rotate-180">▼</span>
      </summary>
      
      <div className="space-y-3 px-4 pb-4">
        {estimates.map((est) => (
          <div key={est.menuName} className="flex flex-col p-3 bg-suka-cream/30 rounded-xl border border-suka-brown/10">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-suka-brown text-sm">{est.menuName}</span>
              <span className="font-black text-lg text-suka-orange">~{est.estimatedPortions}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
              Maks porsi (Limit: <span className="text-red-650 font-bold">{est.limitingIngredient}</span>)
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
