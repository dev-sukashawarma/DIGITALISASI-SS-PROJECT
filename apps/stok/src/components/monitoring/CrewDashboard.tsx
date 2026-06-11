'use client';

import React, { useState } from 'react';
import { CrewList } from './CrewList';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useCrewMonitoringData } from '@/hooks/useMonitoringData';
import type { MonitoringItem } from '@/lib/types/monitoring';

export function CrewDashboard() {
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  const { data, isLoading, isError, lastFetched, refetch } = useCrewMonitoringData();

  if (isLoading && !data) {
    return <div className="text-center py-8">Loading monitoring data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-12 w-auto object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-suka-brown">{data?.outlet_name} - Monitoring</h1>
            <p className="text-sm text-gray-600 mt-1">Check stok status before shifts & opname</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {isError && (
            <div className="bg-yellow-50 text-yellow-700 px-4 py-2 rounded text-sm border border-yellow-200">
              Connection unstable
            </div>
          )}
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Last updated */}
      <div className="text-sm text-gray-500">
        Last updated: {lastFetched ? new Date(lastFetched).toLocaleTimeString('id-ID') : 'Never'}
      </div>

      {/* List */}
      <CrewList items={data?.items || []} onItemClick={setSelectedItem} />

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
