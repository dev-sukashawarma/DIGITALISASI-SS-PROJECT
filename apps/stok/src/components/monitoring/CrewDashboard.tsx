'use client';

import React, { useState } from 'react';
import { CrewList } from './CrewList';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useCrewMonitoringData } from '@/hooks/useMonitoringData';
import { useAuth } from '@suka/auth';
import { getCrossAppUrl } from '@/lib/navigation';
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

  // Determine if opname is overdue (> 7 days)
  const isOpnameOverdue = (data?.items || []).some((item) => {
    if (!item.last_opname_date) return true;
    const days = Math.floor((Date.now() - new Date(item.last_opname_date).getTime()) / (1000 * 60 * 60 * 24));
    return days > 7;
  });

  const getOpnameAgeText = () => {
    let oldestDate: Date | null = null;
    for (const item of (data?.items || [])) {
      if (item.last_opname_date) {
        const d = new Date(item.last_opname_date);
        if (!oldestDate || d < oldestDate) oldestDate = d;
      }
    }

    if (!oldestDate) return 'Belum pernah opname';
    const days = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
    return `Terakhir ${days} hari lalu`;
  };

  return (
    <div className="min-h-screen bg-[#fff8f1]">
      {/* Top Header App Bar */}
      <header className="bg-[#fff8f1] sticky top-0 z-40 w-full px-4 py-4 flex flex-col gap-2 border-b border-[#d9c2b2]/30 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-xl font-bold text-[#701604] hover:text-[#a43c26] transition-colors mr-1" title="Kembali ke Dashboard">
              ←
            </Link>
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
              <h1 className="text-lg font-bold text-[#701604] uppercase tracking-tight leading-tight">
                {data?.outlet_name || 'Outlet'} - Monitoring
              </h1>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 border border-[#877365]/20 transition-all active:scale-95"
            title="Refresh"
          >
            🔄
          </button>
        </div>
        
        <div className="flex flex-col gap-1.5 mt-1 border-t border-[#d9c2b2]/20 pt-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="bg-[#a43c26] text-white px-2.5 py-0.5 rounded-full font-semibold">
              Outlet {data?.outlet_name || '...'}
            </span>
            <span className="text-[#544437] font-semibold">
              SPV: Aris S. • Crew: {data?.items ? '4' : '0'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#544437]/80 font-medium">
            <span>Check stok status before shifts & opname</span>
            <span className="text-[#544437]/60">
              Last updated: {lastFetched ? new Date(lastFetched).toLocaleTimeString('id-ID') : 'Never'}
            </span>
          </div>
        </div>
      </header>

      <main className="px-4 flex flex-col gap-6 mt-6 pb-28">
        {/* Connection unstable alert */}
        {isError && (
          <div className="p-3.5 bg-[#ffdad6] text-[#ba1a1a] rounded-2xl border border-[#ba1a1a]/20 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span> Connection unstable
          </div>
        )}

        {/* Section 1: Critical Alerts Widget */}
        {(criticalItems.length > 0 || isOpnameOverdue) && (
          <section>
            <div className="bg-white rounded-xl border border-outline-variant/30 shadow-sm p-4 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-[#ba1a1a]">
                <span className="text-xl">⚠️</span>
                <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Peringatan Kritis</h2>
              </div>
              
              <div className="space-y-2">
                {criticalItems.map((item) => (
                  <div key={item.bahan_baku_id} className="flex justify-between items-center p-3 bg-[#ffdad6]/20 rounded-lg border border-[#ba1a1a]/10">
                    <div className="flex flex-col">
                      <span className="font-bold text-[#a43c26] text-sm">{item.item_name}</span>
                      <span className="text-xs text-gray-600">
                        {item.current_qty} {item.satuan} / <span className="font-bold text-[#a43c26]">Reorder {item.threshold} {item.satuan}</span>
                      </span>
                    </div>
                    <span className="text-[#ba1a1a] font-bold text-lg">↓</span>
                  </div>
                ))}

                {isOpnameOverdue && (
                  <div className="flex items-start gap-3 p-3 bg-[#faf2e9] rounded-lg border border-[#877365]/20">
                    <span className="text-xl">📅</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 text-sm">Opname Jatuh Tempo</span>
                      <p className="text-xs text-gray-600">
                        {getOpnameAgeText()} (<span className="text-[#ba1a1a] font-bold uppercase text-[9px]">Overdue</span>)
                      </p>
                    </div>
                  </div>
                )}
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
        <section className="-mx-4 overflow-x-auto pb-2 no-scrollbar">
          <div className="flex gap-3 px-4 min-w-max">
            <Link href="/stok/ledger/new" className="flex-shrink-0 bg-white border border-[#d9c2b2]/45 rounded-xl p-4 flex flex-col items-center gap-2 w-28 shadow-sm hover:shadow transition-all active:scale-95">
              <div className="w-12 h-12 rounded-full bg-[#f29744]/10 flex items-center justify-center">
                <span className="text-xl">📒</span>
              </div>
              <span className="text-xs font-semibold text-[#544437]">Entri Ledger</span>
            </Link>
            <Link href="/stok/opname/new" className="flex-shrink-0 bg-white border border-[#d9c2b2]/45 rounded-xl p-4 flex flex-col items-center gap-2 w-28 shadow-sm hover:shadow transition-all active:scale-95">
              <div className="w-12 h-12 rounded-full bg-[#f29744]/10 flex items-center justify-center">
                <span className="text-xl">📋</span>
              </div>
              <span className="text-xs font-semibold text-[#544437]">Mulai Opname</span>
            </Link>
            <a href={getCrossAppUrl('/distribusi/terima')} className="flex-shrink-0 bg-white border border-[#d9c2b2]/45 rounded-xl p-4 flex flex-col items-center gap-2 w-28 shadow-sm hover:shadow transition-all active:scale-95">
              <div className="w-12 h-12 rounded-full bg-[#f29744]/10 flex items-center justify-center">
                <span className="text-xl">🚚</span>
              </div>
              <span className="text-xs font-semibold text-[#544437]">Terima Kiriman</span>
            </a>
          </div>
        </section>

        {/* Section 3: Real-time Stock Balance Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider">
              Saldo Stok Real-time
            </h2>
            <button className="text-[#904d00] font-semibold text-xs flex items-center gap-1">
              Filter <span>⚙️</span>
            </button>
          </div>
          
          {/* List */}
          <CrewList items={data?.items || []} onItemClick={setSelectedItem} />
        </section>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-3 pb-safe bg-[#f5ede3] border-t border-[#877365]/20 shadow-lg rounded-t-xl">
        <Link href="/dashboard" className="flex flex-col items-center justify-center bg-[#fd7e62] text-white rounded-full px-4 py-1.5 active:scale-95 transition-all">
          <span className="text-lg leading-none">📊</span>
          <span className="text-[10px] font-bold mt-0.5">Dashboard</span>
        </Link>
        <Link href="/stok/ledger" className="flex flex-col items-center justify-center text-[#544437] hover:bg-[#e9e1d8] px-4 py-1.5 rounded-full transition-all active:scale-95">
          <span className="text-lg leading-none">📒</span>
          <span className="text-[10px] font-bold mt-0.5">Ledger</span>
        </Link>
        <Link href="/stok/opname" className="flex flex-col items-center justify-center text-[#544437] hover:bg-[#e9e1d8] px-4 py-1.5 rounded-full transition-all active:scale-95">
          <span className="text-lg leading-none">📋</span>
          <span className="text-[10px] font-bold mt-0.5">Opname</span>
        </Link>
        <a href={getCrossAppUrl('/distribusi/terima')} className="flex flex-col items-center justify-center text-[#544437] hover:bg-[#e9e1d8] px-4 py-1.5 rounded-full transition-all active:scale-95">
          <span className="text-lg leading-none">🚚</span>
          <span className="text-[10px] font-bold mt-0.5">Terima</span>
        </a>
      </nav>

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
