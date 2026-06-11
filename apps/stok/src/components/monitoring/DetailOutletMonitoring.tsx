'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchOutletsList } from '@/lib/queries/monitoring';

interface DetailItem {
  bahan_baku_id: string;
  item_name: string;
  current_qty: number;
  threshold: number;
  satuan: string;
  status: 'below' | 'warning' | 'ok';
  recent_ledger: Array<{
    tipe: string;
    qty: number;
    catatan: string | null;
    created_at: string;
  }>;
}

export function DetailOutletMonitoring({ outletId }: { outletId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<DetailItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: outlets } = useQuery({
    queryKey: ['monitoring', 'outlets'],
    queryFn: fetchOutletsList,
  });

  const outletName = outlets?.find((o) => o.id === outletId)?.nama || 'Outlet';

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const loadItems = async () => {
      try {
        // Fetch all items for this outlet + their ledger history
        // Since fetchItemDetail is per-item, we need to integrate with monitoring view
        // For now, we'll fetch from monitoring_view_spv then detail per item

        const response = await fetch(`/api/stok/outlet/${outletId}/items`);
        if (!response.ok) throw new Error('Gagal memuat data');

        const data = await response.json();
        setItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat data outlet');
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, [outletId]);

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
    <div className="min-h-screen flex flex-col bg-[#fff8f1] text-[#1a1a1a]">
      {/* Header */}
      <header className="px-10 py-6 bg-[#fff8f1] border-b-[3px] border-[#701604] flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="text-sm font-bold text-[#701604] mb-4 hover:opacity-75"
        >
          ← Kembali ke Papan
        </button>
        <h1 className="text-2xl font-black text-[#701604] uppercase tracking-tight leading-tight">
          {outletName.replace('SUKA SHAWARMA ', '')}
        </h1>
        <p className="text-xs text-[#8b6f47] font-semibold mt-1 uppercase tracking-wider">Detail Stok Outlet</p>
      </header>

      {/* Content */}
      <main className="flex-1 px-10 py-6 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-[#8b6f47] font-semibold">Tidak ada data stok</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl">
            {items.map((item) => {
              const ratio = item.threshold > 0 ? item.current_qty / item.threshold : 0;
              const percent = Math.min(100, Math.round(ratio * 100));

              let statusBgColor = 'bg-white border-[#d1c7b3]';
              let statusTextColor = 'text-[#15803d]';
              let statusLabel = '🟢 Aman';

              if (item.status === 'below') {
                statusBgColor = 'bg-[#fef3f2] border-[#dc2626]';
                statusTextColor = 'text-[#dc2626]';
                statusLabel = '🔴 Kritis';
              } else if (item.status === 'warning') {
                statusBgColor = 'bg-[#fffbf0] border-[#d97706]';
                statusTextColor = 'text-[#d97706]';
                statusLabel = '🟡 Menipis';
              }

              return (
                <div
                  key={item.bahan_baku_id}
                  className={`${statusBgColor} border-2 rounded-lg p-6 space-y-4`}
                >
                  {/* Item header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-[#1a1a1a] uppercase tracking-wide">{item.item_name}</h3>
                      <p className={`text-sm font-bold ${statusTextColor} mt-1`}>{statusLabel}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-black font-mono text-[#1a1a1a]">{item.current_qty}</p>
                      <p className="text-xs text-[#8b6f47] font-semibold">/ {item.threshold} {item.satuan}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="w-full h-2 bg-[#e8dcc8] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          item.status === 'below'
                            ? 'bg-[#dc2626]'
                            : item.status === 'warning'
                              ? 'bg-[#d97706]'
                              : 'bg-[#15803d]'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-[#8b6f47]">
                      <span>Min: {item.threshold}</span>
                      <span>{percent}% Stok</span>
                    </div>
                  </div>

                  {/* Ledger history */}
                  {item.recent_ledger && item.recent_ledger.length > 0 && (
                    <div className="border-t-2 border-current border-opacity-10 pt-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#544437]">Riwayat Terbaru</p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {item.recent_ledger.slice(0, 5).map((ledger, idx) => (
                          <div
                            key={idx}
                            className="bg-white/40 rounded px-3 py-2 text-xs space-y-0.5"
                          >
                            <div className="flex justify-between items-baseline">
                              <span className="font-bold text-[#1a1a1a]">{ledger.tipe}</span>
                              <span className={`font-bold font-mono ${ledger.qty > 0 ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
                                {ledger.qty > 0 ? '+' : ''}{ledger.qty}
                              </span>
                            </div>
                            <p className="text-[#8b6f47] font-medium">
                              {new Date(ledger.created_at).toLocaleString('id-ID', {
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            {ledger.catatan && <p className="text-[#8b6f47] italic">{ledger.catatan}</p>}
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
