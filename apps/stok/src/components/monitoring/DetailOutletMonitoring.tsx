'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchOutletsList, fetchOutletItemsDetail } from '@/lib/queries/monitoring';

export function DetailOutletMonitoring({ outletId }: { outletId: string }) {
  const router = useRouter();

  const { data: outlets } = useQuery({
    queryKey: ['monitoring', 'outlets'],
    queryFn: fetchOutletsList,
  });

  const {
    data: items = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['monitoring', 'outletDetail', outletId],
    queryFn: () => fetchOutletItemsDetail(outletId),
    enabled: !!outletId,
  });

  const error = queryError instanceof Error ? queryError.message : queryError ? 'Gagal memuat data outlet' : null;

  const outletName = outlets?.find((o) => o.id === outletId)?.nama || 'Outlet';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">Memuat detail outlet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff8f1] gap-6">
        <div className="text-center">
          <p className="text-xl font-bold text-[#dc2626] mb-2">⚠️ Error</p>
          <p className="text-[#8b6f47]">{error}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-[#701604] text-white rounded-lg font-bold uppercase tracking-wider hover:opacity-85"
        >
          ← Kembali ke Papan
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-suka-cream text-suka-ink">
      {/* Header */}
      <header className="px-10 py-6 bg-suka-cream border-b-[3px] border-suka-brown flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="text-sm font-bold text-suka-brown mb-4 hover:opacity-75"
        >
          ← Kembali ke Papan
        </button>
        <h1 className="text-2xl font-black text-suka-brown uppercase tracking-tight leading-tight">
          {outletName.replace('SUKA SHAWARMA ', '')}
        </h1>
        <p className="text-xs text-suka-brown/60 font-semibold mt-1 uppercase tracking-wider">Detail Stok Outlet</p>
      </header>

      {/* Content */}
      <main className="flex-1 px-10 py-6 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-suka-brown/60 font-semibold">Tidak ada data stok</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => {
              const ratio = item.threshold > 0 ? item.current_qty / item.threshold : 0;
              const percent = Math.min(100, Math.round(ratio * 100));
              const lastLedger = item.recent_ledger?.[0];

              let statusBgColor = 'bg-white border-suka-brown/10';
              let statusTextColor = 'text-suka-green';
              let statusDot = 'bg-suka-green';
              let barColor = 'bg-suka-green';

              if (item.status === 'below') {
                statusBgColor = 'bg-[#ffdad6]/20 border-[#ba1a1a]';
                statusTextColor = 'text-[#ba1a1a]';
                statusDot = 'bg-[#ba1a1a]';
                barColor = 'bg-[#ba1a1a]';
              } else if (item.status === 'warning') {
                statusBgColor = 'bg-suka-orange/5 border-suka-orange';
                statusTextColor = 'text-suka-orange';
                statusDot = 'bg-suka-orange';
                barColor = 'bg-suka-orange';
              }

              return (
                <div
                  key={item.bahan_baku_id}
                  className={`${statusBgColor} border-2 rounded-xl p-4 flex flex-col gap-2.5 shadow-[0px_2px_8px_rgba(112,22,4,0.05)]`}
                >
                  {/* Name + status dot */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-black text-suka-ink uppercase tracking-wide leading-tight">{item.item_name}</h3>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${statusDot}`} />
                  </div>

                  {/* Qty */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-suka-ink leading-none">{item.current_qty}</span>
                    <span className="text-xs text-suka-brown/50 font-semibold">/ {item.threshold} {item.satuan}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-suka-brown/10 rounded-full overflow-hidden">
                    <div className={`h-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
                  </div>

                  {/* Footer: status + last activity */}
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className={statusTextColor}>{percent}%</span>
                    {lastLedger && (
                      <span className={`font-mono ${lastLedger.qty > 0 ? 'text-suka-green' : 'text-[#ba1a1a]'}`}>
                        {lastLedger.qty > 0 ? '+' : ''}{lastLedger.qty}
                        <span className="text-suka-brown/40 font-medium ml-1">
                          {new Date(lastLedger.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
