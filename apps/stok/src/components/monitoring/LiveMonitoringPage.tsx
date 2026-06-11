'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSPVMonitoringData } from '@/hooks/useMonitoringData';
import { useQuery } from '@tanstack/react-query';
import { fetchOutletsList } from '@/lib/queries/monitoring';

export function LiveMonitoringPage() {
  const { data, isLoading: isMonitoringLoading, refetch } = useSPVMonitoringData();
  const { data: outletsMaster, isLoading: isOutletsLoading } = useQuery({
    queryKey: ['monitoring', 'outletsList'],
    queryFn: fetchOutletsList,
  });

  const isLoading = isMonitoringLoading || isOutletsLoading;

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live clock
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const items = data?.items || [];

  // Group items by outlet and determine their status
  const outlets = useMemo(() => {
    const itemsMap: Record<string, typeof items> = {};
    for (const item of items) {
      if (!itemsMap[item.outlet_id]) {
        itemsMap[item.outlet_id] = [];
      }
      itemsMap[item.outlet_id].push(item);
    }

    let masterList = outletsMaster || [];
    if (masterList.length === 0 && items.length > 0) {
      const uniqueOutlets: Record<string, string> = {};
      for (const item of items) {
        if (item.outlet_id && item.outlet_name) {
          uniqueOutlets[item.outlet_id] = item.outlet_name;
        }
      }
      masterList = Object.entries(uniqueOutlets).map(([id, nama]) => ({
        id,
        nama,
      }));
    }

    const list = masterList.map((outlet) => {
      const outletItems = itemsMap[outlet.id] || [];

      let kritisCount = 0;
      let menipisCount = 0;
      let status: 'below' | 'warning' | 'ok' = 'ok';
      const lowItems: typeof items = [];

      for (const item of outletItems) {
        if (item.status === 'below') {
          kritisCount++;
          status = 'below';
          lowItems.push(item);
        } else if (item.status === 'warning') {
          menipisCount++;
          if (status !== 'below') {
            status = 'warning';
          }
          lowItems.push(item);
        }
      }

      return {
        outlet_id: outlet.id,
        outlet_name: outlet.nama,
        kritisCount,
        menipisCount,
        status,
        lowItems,
        isKitchen: outlet.nama.toUpperCase().includes('KITCHEN'),
      };
    });

    // Sort outlets: below first, then warning, then ok, then by name
    return list.sort((a, b) => {
      const order = { below: 0, warning: 1, ok: 2 };
      if (a.status !== b.status) {
        return order[a.status] - order[b.status];
      }
      return a.outlet_name.localeCompare(b.outlet_name);
    });
  }, [items, outletsMaster]);

  // Separate Kitchen from consumer grid
  const kitchenOutlet = useMemo(() => outlets.find((o) => o.isKitchen) || null, [outlets]);
  const gridOutlets = useMemo(() => outlets.filter((o) => !o.isKitchen), [outlets]);

  // Top-3 most critical items across ALL outlets
  const topCritical = useMemo(() => {
    const belowItems = items.filter((it) => it.status === 'below');
    return belowItems
      .map((it) => ({
        ...it,
        ratio: it.threshold > 0 ? it.current_qty / it.threshold : 0,
      }))
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 3);
  }, [items]);

  // Overall statistics (18 outlets only)
  const stats = useMemo(() => {
    let kritis = 0;
    let menipis = 0;

    for (const o of gridOutlets) {
      if (o.status === 'below') kritis++;
      else if (o.status === 'warning') menipis++;
    }

    return { kritis, menipis };
  }, [gridOutlets]);


  if (isLoading && outlets.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">Menghubungkan ke Live Monitoring System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fff8f1] text-[#1a1a1a] font-sans">
      {/* ━━━━━ HEADER ━━━━━ */}
      <header className="flex items-center justify-between px-10 py-5 bg-[#fff8f1] border-b-[3px] border-[#701604] flex-shrink-0 gap-16">
        {/* Title + Stat Bar */}
        <div className="flex items-center gap-10">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#701604] uppercase leading-tight">
              📊 LIVE STOCK
            </h1>
            <p className="text-[10px] text-[#8b6f47] font-semibold uppercase tracking-wider mt-1">
              Suka Shawarma 19 Outlets Real-Time Monitor
            </p>
          </div>

          {/* Stat items: kritis | menipis */}
          <div className="flex gap-12 items-center">
            <div className="flex items-baseline gap-2">
              <span className="text-xl">🔴</span>
              <div>
                <div className="text-5xl font-black font-mono text-[#dc2626] leading-none">{stats.kritis}</div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#544437]">Kritis</div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl">🟡</span>
              <div>
                <div className="text-5xl font-black font-mono text-[#d97706] leading-none">{stats.menipis}</div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#544437]">Menipis</div>
              </div>
            </div>
          </div>
        </div>

        {/* Jam + Controls (right) */}
        <div className="flex items-center gap-6 ml-auto flex-shrink-0">
          {currentTime && (
            <div className="text-right">
              <div className="text-sm font-bold text-[#701604]">
                {currentTime.toLocaleDateString('id-ID', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div className="text-2xl font-black font-mono text-[#1a1a1a]">
                {currentTime.toLocaleTimeString('id-ID', { hour12: false })}
              </div>
            </div>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide rounded border transition-all ${
              soundEnabled
                ? 'bg-[#701604]/5 border-[#701604] text-[#701604]'
                : 'border-[#d1c7b3] text-[#8b6f47] bg-transparent'
            }`}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          <button
            onClick={() => refetch()}
            className="px-5 py-2 bg-[#701604] text-white rounded text-xs font-bold uppercase tracking-wide hover:opacity-85 transition-opacity"
          >
            🔄 Refresh
          </button>
        </div>
      </header>

      {/* ━━━━━ TOP SECTION: Kitchen + Top-3 ━━━━━ */}
      {(kitchenOutlet || topCritical.length > 0) && (
        <section className="flex gap-6 px-10 py-7 bg-[#fff8f1] border-b-[2px] border-[#e8dcc8] flex-shrink-0">
          {/* Kitchen Panel: 22% */}
          {kitchenOutlet && (
            <div className="flex-shrink-0 w-96 bg-white border-2 border-[#701604] rounded-lg p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏭</span>
                <div>
                  <h2 className="text-sm font-black text-[#701604] uppercase tracking-wider leading-tight">
                    Kitchen Pusat
                  </h2>
                  <p className="text-xs text-[#8b6f47] font-semibold mt-1">Sumber pasok 18 outlet</p>
                </div>
              </div>

              {kitchenOutlet.status === 'ok' ? (
                <div className="text-sm font-bold text-[#15803d]">🟢 Stok pasok aman</div>
              ) : (
                <div className="space-y-2">
                  <p className={`text-xs font-black ${kitchenOutlet.status === 'below' ? 'text-[#dc2626]' : 'text-[#d97706]'}`}>
                    {kitchenOutlet.kritisCount > 0 && `${kitchenOutlet.kritisCount} kritis`}
                    {kitchenOutlet.kritisCount > 0 && kitchenOutlet.menipisCount > 0 && ' · '}
                    {kitchenOutlet.menipisCount > 0 && `${kitchenOutlet.menipisCount} menipis`}
                  </p>
                  <p className="text-xs text-[#8b6f47] font-medium leading-tight">
                    {kitchenOutlet.lowItems.slice(0, 3).map((it) => it.item_name).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Top-3 Kritis: 48% */}
          {topCritical.length > 0 ? (
            <div className="flex-1 bg-[#fef3f2] border-2 border-[#dc2626] rounded-lg p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-xs font-black text-[#dc2626] uppercase tracking-wider">Prioritas — Item Kritis</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {topCritical.map((it, i) => (
                  <div key={`${it.outlet_id}-${it.bahan_baku_id}`} className="bg-white rounded p-3 border border-[#fecaca]">
                    <div className="text-2xl font-black text-[#fca5a5] leading-none mb-1">{i + 1}</div>
                    <p className="text-xs font-bold text-[#1a1a1a] mb-1">{it.item_name}</p>
                    <p className="text-[9px] text-[#8b6f47] mb-2">{it.outlet_name.replace('SUKA SHAWARMA ', '')}</p>
                    <p className="text-xs font-black font-mono text-[#dc2626]">
                      {it.current_qty}/{it.threshold} {it.satuan}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white border-2 border-dashed border-[#d1c7b3] rounded-lg p-6 flex items-center justify-center text-center">
              <p className="text-sm text-[#8b6f47] font-semibold">📭 Semua outlet aman — tidak ada item kritis</p>
            </div>
          )}
        </section>
      )}

      {/* ━━━━━ GRID: 18 OUTLETS ━━━━━ */}
      <main className="flex-1 px-10 py-7 overflow-y-auto">
        <div className="grid grid-cols-3 gap-6 h-fit">
          {gridOutlets.map((outlet) => {
            let borderClass = 'border-2 border-[#d1c7b3] hover:border-[#8b6f47]';
            let bgClass = 'bg-white';
            let indicatorColor = 'bg-[#15803d]';

            if (outlet.status === 'below') {
              borderClass = 'border-3 border-[#dc2626] bg-[#fef3f2]';
              indicatorColor = 'bg-[#dc2626] animate-pulse';
            } else if (outlet.status === 'warning') {
              borderClass = 'border-2 border-[#d97706] bg-[#fffbf0]';
              indicatorColor = 'bg-[#d97706]';
            }

            return (
              <div
                key={outlet.outlet_id}
                className={`${bgClass} ${borderClass} rounded-lg p-5 flex flex-col gap-4 min-h-60 transition-all`}
              >
                {/* Card header */}
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-black text-[#1a1a1a] uppercase tracking-wider leading-tight truncate">
                      {outlet.outlet_name.replace('SUKA SHAWARMA ', '')}
                    </h3>
                    <p className="text-[10px] text-[#8b6f47] font-semibold mt-1 truncate">
                      {outlet.outlet_name.includes('KITCHEN') ? 'Kitchen' : 'Branch'}
                    </p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0 ${indicatorColor}`} />
                </div>

                {/* Status or items */}
                {outlet.status === 'ok' ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-1">
                    <span className="text-2xl">🟢</span>
                    <p className="text-xs font-bold text-[#15803d]">Semua Aman</p>
                    <p className="text-[10px] text-[#15803d]/70">Stok terpenuhi</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-2">
                    {outlet.lowItems.map((item) => (
                      <div key={item.bahan_baku_id} className="bg-[rgba(112,22,4,0.04)] rounded p-2">
                        <p className="text-[10px] font-bold text-[#1a1a1a]">{item.item_name}</p>
                        <p className="text-[10px] font-bold font-mono text-[#dc2626]">
                          {item.current_qty}/{item.threshold} {item.satuan}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
