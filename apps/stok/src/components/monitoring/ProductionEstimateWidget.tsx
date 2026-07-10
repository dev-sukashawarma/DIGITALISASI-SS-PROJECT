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
              Maks porsi (Limit: <span className="text-red-650 font-bold">{est.limitingIngredient}</span>)
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
