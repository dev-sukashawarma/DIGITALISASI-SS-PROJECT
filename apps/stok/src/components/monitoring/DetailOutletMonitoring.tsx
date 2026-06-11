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
          <div className="space-y-6 max-w-4xl">
            {items.map((item) => {
              const ratio = item.threshold > 0 ? item.current_qty / item.threshold : 0;
              const percent = Math.min(100, Math.round(ratio * 100));

              let statusBgColor = 'bg-white border-outline-variant';
              let statusTextColor = 'text-suka-green';
              let statusLabel = '🟢 Aman';

              if (item.status === 'below') {
                statusBgColor = 'bg-[#ffdad6]/20 border-[#ba1a1a]';
                statusTextColor = 'text-[#ba1a1a]';
                statusLabel = '🔴 Kritis';
              } else if (item.status === 'warning') {
                statusBgColor = 'bg-suka-orange/5 border-suka-orange';
                statusTextColor = 'text-suka-orange';
                statusLabel = '🟡 Menipis';
              }

              return (
                <div
                  key={item.bahan_baku_id}
                  className={`${statusBgColor} border-2 rounded-xl p-6 space-y-4 shadow-[0px_4px_12px_rgba(112,22,4,0.08)]`}
                >
                  {/* Item header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-suka-ink uppercase tracking-wide">{item.item_name}</h3>
                      <p className={`text-sm font-bold ${statusTextColor} mt-1`}>{statusLabel}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-black font-mono text-suka-ink">{item.current_qty}</p>
                      <p className="text-xs text-suka-brown/60 font-semibold">/ {item.threshold} {item.satuan}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="w-full h-2 bg-suka-brown/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          item.status === 'below'
                            ? 'bg-[#ba1a1a]'
                            : item.status === 'warning'
                              ? 'bg-suka-orange'
                              : 'bg-suka-green'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-suka-brown/60">
                      <span>Min: {item.threshold}</span>
                      <span>{percent}% Stok</span>
                    </div>
                  </div>

                  {/* Ledger history */}
                  {item.recent_ledger && item.recent_ledger.length > 0 && (
                    <div className="border-t border-suka-brown/10 pt-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-suka-brown/85">Riwayat Terbaru</p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {item.recent_ledger.slice(0, 5).map((ledger, idx) => (
                          <div
                            key={idx}
                            className="bg-white/40 rounded px-3 py-2 text-xs space-y-0.5"
                          >
                            <div className="flex justify-between items-baseline">
                              <span className="font-bold text-suka-ink">{ledger.tipe}</span>
                              <span className={`font-bold font-mono ${ledger.qty > 0 ? 'text-suka-green' : 'text-[#ba1a1a]'}`}>
                                {ledger.qty > 0 ? '+' : ''}{ledger.qty}
                              </span>
                            </div>
                            <p className="text-suka-brown/60 font-medium">
                              {new Date(ledger.created_at).toLocaleString('id-ID', {
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            {ledger.catatan && <p className="text-suka-brown/60 italic">{ledger.catatan}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
