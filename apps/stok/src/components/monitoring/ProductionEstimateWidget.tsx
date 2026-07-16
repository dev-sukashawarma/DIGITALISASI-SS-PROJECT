'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { MonitoringItem } from '@/lib/types/monitoring';
import { calculateProductionEstimate, type ProductionEstimate } from '@/lib/stok/productionEstimate';
import { fetchEstimasiRecipes, type EstimasiRecipe } from '@/app/actions/estimasi_produksi';

interface Props {
  items: Partial<MonitoringItem>[];
}

export function ProductionEstimateWidget({ items }: Props) {
  const [recipes, setRecipes] = useState<EstimasiRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  const outletId = items.length > 0 ? items[0].outlet_id : null;

  useEffect(() => {
    if (!outletId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchEstimasiRecipes(outletId)
      .then(setRecipes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [outletId]);

  const estimates = useMemo(() => calculateProductionEstimate(items, recipes), [items, recipes]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-suka-brown/20 shadow-sm p-4 animate-pulse">
        <div className="h-4 bg-suka-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-suka-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

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
