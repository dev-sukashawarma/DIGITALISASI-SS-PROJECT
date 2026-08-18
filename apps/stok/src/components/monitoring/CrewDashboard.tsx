'use client';

import React, { useState } from 'react';
import { CrewList } from './CrewList';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useCrewMonitoringData, useMonitoringRealtime } from '@/hooks/useMonitoringData';
import type { MonitoringItem } from '@/lib/types/monitoring';
import { RefreshCw } from 'lucide-react';

export function CrewDashboard() {
  useMonitoringRealtime();
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  const { data, isLoading, isError, error, refetch } = useCrewMonitoringData();

  return (
    <div className="min-h-screen bg-[#fffdfa] flex flex-col">
      {/* Top Banner / Toolbar */}
      <div className="bg-white border-b border-suka-brown/10 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-2xs">
        <div>
          <span className="text-[10px] font-black text-suka-orange uppercase tracking-wider">
            {data?.outlet_name || 'OUTLET'}
          </span>
          <h1 className="text-base sm:text-lg font-black text-suka-brown leading-tight font-display">
            Saldo Stok Real-time
          </h1>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-suka-cream/50 hover:bg-suka-cream text-suka-brown border border-suka-brown/10 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
          title="Refresh Data"
        >
          <RefreshCw className="w-3.5 h-3.5 text-suka-orange" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <main className="px-4 md:px-6 flex flex-col gap-6 mt-4 pb-24 max-w-7xl mx-auto w-full">
        {/* Connection unstable alert */}
        {isError && (
          <div className="w-full p-3.5 bg-[#ffdad6] text-[#ba1a1a] rounded-2xl border border-[#ba1a1a]/20 text-xs font-semibold flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span>⚠️</span> Connection unstable
            </div>
            {error && (
              <div className="text-[10px] font-mono bg-white/50 p-2 rounded border border-[#ba1a1a]/10 max-h-20 overflow-y-auto">
                {String(error?.message || error)}
              </div>
            )}
          </div>
        )}

        {/* Real-time Stock Balance Section (Full Width) */}
        <div className="w-full space-y-4">
          <CrewList items={data?.items || []} onItemClick={setSelectedItem} loading={isLoading && !data} />
        </div>
      </main>

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
