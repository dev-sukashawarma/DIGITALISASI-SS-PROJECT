'use client';

import React, { useState } from 'react';
import { SPVTabs } from './SPVTabs';
import { SPVTable } from './SPVTable';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useSPVMonitoringData } from '@/hooks/useMonitoringData';
import type { MonitoringItem } from '@/lib/types/monitoring';

export function SPVDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'compliance'>('overview');
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  const { data, isLoading, isError, lastFetched, refetch, autoRefresh } = useSPVMonitoringData();

  const alertCount = (data?.items || []).filter((item) => item.status !== 'ok' || item.is_flagged).length;

  if (isLoading && !data) {
    return <div className="text-center py-8">Loading monitoring data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-suka-brown">SPV Monitoring Dashboard</h1>
        <div className="flex gap-2 items-center">
          {isError && (
            <div className="bg-yellow-50 text-yellow-700 px-4 py-2 rounded text-sm border border-yellow-200">
              Connection unstable, showing cached data
            </div>
          )}
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
          <button
            onClick={autoRefresh.isPaused() ? autoRefresh.resume : autoRefresh.pause}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
          >
            {autoRefresh.isPaused() ? 'Resume (30s)' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Last updated */}
      <div className="text-sm text-gray-500">
        Last updated: {lastFetched ? new Date(lastFetched).toLocaleTimeString('id-ID') : 'Never'}
      </div>

      {/* Tabs */}
      <SPVTabs activeTab={activeTab} onTabChange={setActiveTab} alertCount={alertCount} />

      {/* Table */}
      <SPVTable items={data?.items || []} tab={activeTab} onRowClick={setSelectedItem} />

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
