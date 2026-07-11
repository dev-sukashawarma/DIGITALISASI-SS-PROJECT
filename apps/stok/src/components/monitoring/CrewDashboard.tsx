'use client';

import React, { useState, useEffect } from 'react';
import { CrewList } from './CrewList';
import { ProductionEstimateWidget } from './ProductionEstimateWidget';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useCrewMonitoringData } from '@/hooks/useMonitoringData';
import { useAuth, createSupabaseBrowserClient } from '@suka/auth';
import type { MonitoringItem } from '@/lib/types/monitoring';
import Link from 'next/link';
import { Skeleton } from '@suka/design-system';
import { BottomNav } from '@/components/common/BottomNav';
import { formatCompositeSaldo } from '@/lib/format/compositeUnit';

export function CrewDashboard() {
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  const [displayTime, setDisplayTime] = useState<string>('');
  const [isOpnameOverdue, setIsOpnameOverdue] = useState(false);
  const [opnameAgeText, setOpnameAgeText] = useState('');
  const { data, isLoading, isError, error, lastFetched, refetch } = useCrewMonitoringData();
  const { outletStaff } = useAuth();

  useEffect(() => {
    if (lastFetched) {
      setDisplayTime(new Date(lastFetched).toLocaleTimeString('id-ID'));
    }

    // Calculate opname status client-side to avoid hydration mismatch
    const items = data?.items || [];
    const overdue = items.some((item) => {
      if (!item.last_opname_date) return true;
      const days = Math.floor((Date.now() - new Date(item.last_opname_date).getTime()) / (1000 * 60 * 60 * 24));
      return days > 7;
    });
    setIsOpnameOverdue(overdue);

    let oldestDate: Date | null = null;
    for (const item of items) {
      if (item.last_opname_date) {
        const d = new Date(item.last_opname_date);
        if (!oldestDate || d < oldestDate) oldestDate = d;
      }
    }
    const ageText = !oldestDate ? 'Belum pernah opname' : `Terakhir ${Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))} hari lalu`;
    setOpnameAgeText(ageText);
  }, [lastFetched, data?.items]);

  const criticalItems = (data?.items || []).filter((item) => item.status === 'below');

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  let resolvedPortalUrl = portalUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedPortalUrl = 'http://localhost:3010'
  }

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-suka-cream">
      <header className="bg-white sticky top-0 z-40 w-full px-3 py-2.5 border-b border-suka-brown/20 shadow-sm flex flex-col gap-2.5">
        {/* Top Row: Navigation and Profile */}
        <div className="flex items-center justify-between w-full">
          <Link 
            href="/dashboard" 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-suka-cream hover:bg-suka-cream/80 border border-suka-brown/20 text-suka-brown transition-all active:scale-95 flex-shrink-0"
            title="Kembali ke Dashboard"
          >
            <span className="text-sm font-bold">←</span>
          </Link>

          <div className="flex items-center gap-1.5">
            <img 
              src="/logo.png" 
              alt="Suka Logo" 
              className="h-5 w-auto object-contain" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
            />
            <span className="text-[11px] font-black text-suka-brown tracking-wider uppercase">SS Digital</span>
          </div>

          <div className="w-8 h-8 flex-shrink-0"></div>
        </div>

        {/* Title Row */}
        <div className="flex flex-col">
          <h1 className="text-sm sm:text-base font-black text-suka-brown uppercase tracking-tight leading-tight">
            {isLoading && !data ? <Skeleton className="h-4 w-32 inline-block" /> : (data?.outlet_name || 'Outlet')} - Monitoring
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-[9px] font-bold text-suka-orange uppercase tracking-widest">
              Stock Control Panel
            </p>
            <span className="w-1 h-1 rounded-full bg-suka-brown/30"></span>
            <span className="text-[9px] font-medium text-suka-brown/70 flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
              Updated {displayTime || '...'}
            </span>
          </div>
        </div>

        {/* Action & Meta Row */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
          {/* Meta Tags */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap">
              Outlet {isLoading && !data ? '...' : (data?.outlet_name ? 'Active' : '...')}
            </span>
            <span className="bg-suka-cream border border-suka-brown/10 text-suka-brown px-2 py-0.5 rounded text-[9px] font-medium whitespace-nowrap">
              Crew: <strong className="font-bold">{outletStaff?.name || '...'}</strong>
            </span>
            <span className="bg-suka-cream border border-suka-brown/10 text-suka-brown px-2 py-0.5 rounded text-[9px] font-medium whitespace-nowrap">
              Items: <strong className="font-bold">{isLoading && !data ? <Skeleton className="h-2 w-4 inline-block" /> : (data?.items?.length || '0')}</strong>
            </span>
          </div>

          {/* Actions Button Group */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <a
              href={resolvedPortalUrl}
              className="flex-1 sm:flex-initial px-2 h-7 flex items-center justify-center rounded-md bg-white hover:bg-suka-cream border border-suka-brown/20 text-suka-brown font-bold text-[10px] transition-all active:scale-95 shadow-sm"
              title="Portal"
            >
              Portal
            </a>
            <button
              onClick={() => refetch()}
              className="flex-[1.2] sm:flex-initial px-2 h-7 flex items-center justify-center rounded-md bg-white hover:bg-suka-cream border border-suka-brown/20 text-suka-brown font-bold text-[10px] transition-all active:scale-95 shadow-sm gap-1"
              title="Refresh"
            >
              🔄 Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 sm:flex-initial px-2 h-7 flex items-center justify-center rounded-md bg-white hover:bg-red-50 border border-red-200 text-red-600 font-bold text-[10px] transition-all active:scale-95 shadow-sm"
              title="Logout"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 flex flex-col gap-6 mt-6 pb-28 max-w-7xl mx-auto">
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
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider">
              Saldo Stok Real-time
            </h2>
            <button className="text-suka-orange font-semibold text-xs flex items-center gap-1">
              Filter <span>⚙️</span>
            </button>
          </div>

          {/* List */}
          <CrewList items={data?.items || []} onItemClick={setSelectedItem} loading={isLoading && !data} />

          {/* Alerts Row (stacked vertically) */}
          <div className="flex flex-col gap-4 w-full pt-4">
            {/* Critical Alerts Widget */}
            {isLoading && !data ? (
              <Skeleton className="h-14 w-full rounded-2xl" />
            ) : (
              (criticalItems.length > 0 || isOpnameOverdue) && (
                <details className="group bg-white rounded-2xl border border-suka-brown/20 shadow-sm flex flex-col h-fit">
                  <summary className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3.5 select-none">
                    <div className="flex items-center gap-2 text-red-600">
                      <span className="text-xl">⚠️</span>
                      <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Peringatan Kritis</h2>
                    </div>
                    <span className="text-suka-brown/50 transition-transform group-open:rotate-180">▼</span>
                  </summary>
                  
                  <div className="px-4 pb-4 flex flex-col gap-4">
                    <div className="space-y-2">
                      {criticalItems.map((item) => (
                        <div key={item.bahan_baku_id} className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-200">
                          <div className="flex flex-col">
                            <span className="font-bold text-red-700 text-sm">{item.item_name}</span>
                            <span className="text-xs text-gray-600">
                              {formatCompositeSaldo(item.current_qty, item.satuan, item.satuan_kecil, item.faktor_tampilan)} / <span className="font-bold text-red-700">Reorder {item.threshold} {item.satuan}</span>
                            </span>
                          </div>
                          <span className="text-red-600 font-bold text-lg">↓</span>
                        </div>
                      ))}

                      {isOpnameOverdue && (
                        <div className="flex items-start gap-3 p-3 bg-suka-cream rounded-xl border border-suka-brown/20">
                          <span className="text-xl">📅</span>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-sm">Opname Jatuh Tempo</span>
                            <p className="text-xs text-gray-600">
                              {opnameAgeText} (<span className="text-red-600 font-bold uppercase text-[9px]">Overdue</span>)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <Link
                      href="/stok/opname/new"
                      className="w-full bg-suka-orange hover:bg-suka-orange/90 text-suka-ink font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm text-center active:scale-95"
                    >
                      📋 Mulai Opname Baru
                    </Link>
                  </div>
                </details>
              )
            )}

            {/* Production Estimate Widget */}
            {!isLoading && data?.items && data.items.length > 0 && (
              <div className="h-fit">
                <ProductionEstimateWidget items={data.items} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav />

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
