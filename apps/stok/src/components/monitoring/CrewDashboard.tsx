'use client';

import React, { useState } from 'react';
import { CrewList } from './CrewList';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useCrewMonitoringData } from '@/hooks/useMonitoringData';
import { useAuth } from '@/context/AuthContext';
import type { MonitoringItem } from '@/lib/types/monitoring';
import Link from 'next/link';

export function CrewDashboard() {
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  const { data, isLoading, isError, lastFetched, refetch } = useCrewMonitoringData();
  const { outletStaff } = useAuth();

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center text-sm font-semibold text-gray-500 animate-pulse">
          Loading monitoring data...
        </div>
      </div>
    );
  }

  const criticalItems = (data?.items || []).filter((item) => item.status === 'below');

  return (
    <div className="pb-20 space-y-5">
      {/* Top Header App Bar */}
      <div className="bg-white border-b border-[#701604]/10 px-4 py-4 flex flex-col gap-2 shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#fd7e62]/20 flex items-center justify-center overflow-hidden border border-[#fd7e62]/40">
              {outletStaff?.ref_photo_url ? (
                <img src={outletStaff.ref_photo_url} alt="Staff Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">🧑‍🍳</span>
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <img src="/logo.png" alt="Suka Shawarma Logo" className="h-6 w-auto object-contain" />
                <span className="text-[10px] font-bold text-[#701604]/40 uppercase tracking-widest">SS Digital</span>
              </div>
              <h1 className="text-lg font-extrabold text-[#701604] uppercase tracking-tight leading-tight">
                {data?.outlet_name || 'Outlet'} - Monitoring
              </h1>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors active:scale-95"
            title="Refresh"
          >
            🔄
          </button>
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-[#a43c26] text-white px-2.5 py-0.5 rounded-full font-semibold">
            Outlet {data?.outlet_name || '...'}
          </span>
          <span className="text-gray-500 font-medium">
            Staff: {outletStaff?.name || 'Crew'} ({outletStaff?.role || 'crew'})
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-500 px-4">
        Check stok status before shifts & opname
      </p>

      {/* Connection unstable alert */}
      {isError && (
        <div className="mx-4 p-3.5 bg-[#ffdad6] text-[#ba1a1a] rounded-2xl border border-[#ba1a1a]/20 text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span> Connection unstable
        </div>
      )}

      {/* Last updated timestamp */}
      <div className="text-[11px] text-gray-400 px-4">
        Last updated: {lastFetched ? new Date(lastFetched).toLocaleTimeString('id-ID') : 'Never'}
      </div>

      {/* Section 1: Critical Alerts Widget */}
      {criticalItems.length > 0 && (
        <section className="px-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[#ba1a1a]">
              <span className="text-lg">⚠️</span>
              <h2 className="font-bold text-[#ba1a1a] text-sm uppercase tracking-wider">Peringatan Kritis</h2>
            </div>
            
            <div className="space-y-2">
              {criticalItems.slice(0, 3).map((item) => (
                <div key={item.bahan_baku_id} className="flex justify-between items-center p-2.5 bg-[#ffdad6]/20 rounded-xl border border-[#ba1a1a]/10">
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 text-sm">{item.item_name}</span>
                    <span className="text-xs text-gray-600">
                      {item.current_qty} {item.satuan} / <span className="font-bold text-[#a43c26]">Reorder {item.threshold} {item.satuan}</span>
                    </span>
                  </div>
                  <span className="text-[#ba1a1a] text-lg font-bold">↓</span>
                </div>
              ))}
            </div>
            
            <Link
              href="/stok/opname/new"
              className="w-full bg-[#f29744] hover:bg-[#d97c2b] text-[#643400] font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm text-center active:scale-95"
            >
              📋 Mulai Opname Baru
            </Link>
          </div>
        </section>
      )}

      {/* Section 2: Quick Actions Panel */}
      <section className="px-4 flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        <Link href="/stok/ledger/new" className="flex-1 min-w-[100px] bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow transition-all active:scale-95">
          <div className="w-12 h-12 rounded-full bg-[#f29744]/10 flex items-center justify-center">
            <span className="text-xl">📒</span>
          </div>
          <span className="text-xs font-bold text-gray-700 whitespace-nowrap">Entri Ledger</span>
        </Link>
        <Link href="/stok/opname" className="flex-1 min-w-[100px] bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow transition-all active:scale-95">
          <div className="w-12 h-12 rounded-full bg-[#f29744]/10 flex items-center justify-center">
            <span className="text-xl">📋</span>
          </div>
          <span className="text-xs font-bold text-gray-700 whitespace-nowrap">Mulai Opname</span>
        </Link>
        <Link href="/distribusi/terima" className="flex-1 min-w-[100px] bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow transition-all active:scale-95">
          <div className="w-12 h-12 rounded-full bg-[#f29744]/10 flex items-center justify-center">
            <span className="text-xl">🚚</span>
          </div>
          <span className="text-xs font-bold text-gray-700 whitespace-nowrap">Terima Barang</span>
        </Link>
      </section>

      {/* Section 3: Real-time Stock Balance Grid */}
      <section className="px-4 space-y-3">
        <h2 className="text-base font-extrabold text-[#701604] uppercase tracking-wider">
          Saldo Stok Real-time
        </h2>
        
        {/* List */}
        <CrewList items={data?.items || []} onItemClick={setSelectedItem} />
      </section>

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
