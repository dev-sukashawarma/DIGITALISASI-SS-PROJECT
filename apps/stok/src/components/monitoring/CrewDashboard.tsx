'use client';

import React, { useState } from 'react';
import { CrewList } from './CrewList';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useCrewMonitoringData, useMonitoringRealtime } from '@/hooks/useMonitoringData';
import type { MonitoringItem } from '@/lib/types/monitoring';
import { RefreshCw, Wallet } from 'lucide-react';
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown';
import { useAuth } from '@suka/auth';
import { useOutletBudgetStatus } from '@/hooks/useOutletBudget';
import { RequestTopUpModal } from './budget/OutletTopUpRequests';

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

function getPeriodLabel(periodType: string | null, customDays?: number | null): string {
  if (!periodType) return ''
  if (periodType === 'custom' && customDays) return `Per ${customDays} Hari`
  const labels: Record<string, string> = { harian: 'Hari Ini', mingguan: 'Minggu Ini', bulanan: 'Bulan Ini' }
  return labels[periodType] ?? periodType
}

export function CrewDashboard() {
  useMonitoringRealtime();
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  const { data, isLoading, isError, error, refetch } = useCrewMonitoringData();
  const { outletStaff } = useAuth();
  const outletId = outletStaff?.outlet_id ?? undefined;
  const { status: budget } = useOutletBudgetStatus(outletId);

  const pct = budget?.hasConfig && budget.nominal > 0
    ? Math.min(100, (budget.terpakai / budget.nominal) * 100)
    : 0;
  const isOver = budget?.hasConfig && budget.terpakai > budget.nominal;

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-suka-cream/50 hover:bg-suka-cream text-suka-brown border border-suka-brown/10 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-suka-orange" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <UserAvatarDropdown />
        </div>
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

        {/* Budget Saldo Card */}
        {budget?.hasConfig && (
          <div className={`rounded-2xl border p-4 ${isOver ? 'bg-red-50 border-red-200' : pct >= 80 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wallet className={`w-4 h-4 ${isOver ? 'text-red-600' : pct >= 80 ? 'text-orange-600' : 'text-green-700'}`} />
                <span className={`text-xs font-black uppercase tracking-wider ${isOver ? 'text-red-700' : pct >= 80 ? 'text-orange-700' : 'text-green-700'}`}>
                  Budget {getPeriodLabel(budget.periodType ?? null, budget.customDays)}
                </span>
              </div>
              {budget.periodStart && budget.periodEnd && (
                <span className="text-[10px] text-suka-ink/50 font-medium">
                  {budget.periodStart} s/d {budget.periodEnd}
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-green-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className={isOver ? 'text-red-700' : 'text-suka-ink/70'}>
                Terpakai: {formatRp(budget.terpakai)}
              </span>
              <span className={isOver ? 'text-red-600' : pct >= 80 ? 'text-orange-600' : 'text-green-700'}>
                {isOver
                  ? `⚠ Lebih ${formatRp(budget.terpakai - budget.nominal)}`
                  : `Sisa ${formatRp(budget.sisa)} dari ${formatRp(budget.nominal)}`}
              </span>
            </div>
            
            {/* Top Up Button directly inside the card */}
            {outletId && (
              <div className="mt-4 flex justify-end border-t border-black/5 pt-3">
                <RequestTopUpModal outletId={outletId} plafon={budget.nominal} sisa={budget.sisa} />
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
