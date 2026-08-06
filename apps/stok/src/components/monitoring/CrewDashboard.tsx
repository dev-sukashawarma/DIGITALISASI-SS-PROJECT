'use client';

import React, { useState, useEffect } from 'react';
import { CrewList } from './CrewList';
import { ProductionEstimateWidget } from './ProductionEstimateWidget';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useCrewMonitoringData, useMonitoringRealtime } from '@/hooks/useMonitoringData';
import { useAuth, createSupabaseBrowserClient } from '@suka/auth';
import type { MonitoringItem } from '@/lib/types/monitoring';
import Link from 'next/link';
import { Skeleton } from '@suka/design-system/src/components/SkeletonBase';
import { Avatar } from '@suka/design-system/src/components/Avatar';
import { LogOut, RefreshCw } from 'lucide-react';
import { BottomNav } from '@/components/common/BottomNav';
import { formatCompositeSaldoAdaptive } from '@/lib/format/compositeUnit';

export function CrewDashboard() {
  useMonitoringRealtime();
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  const [isOpnameOverdue, setIsOpnameOverdue] = useState(false);
  const [opnameAgeText, setOpnameAgeText] = useState('');
  const { data, isLoading, isError, error, lastFetched, refetch } = useCrewMonitoringData();
  const { outletStaff } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
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
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-3 md:py-4 flex flex-col md:flex-row md:justify-between md:items-center shadow-sm relative gap-3 md:gap-0">
        {/* Row 1: Logo & Title (left) & Avatar (right on mobile) */}
        <div className="flex justify-between items-center w-full md:w-auto">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-xl sm:rounded-2xl p-1 shadow-sm border border-suka-orange/10 flex items-center justify-center shrink-0">
              <img
                alt="Suka Shawarma Logo"
                className="w-full h-full object-contain"
                src="/logo.png"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-sm sm:text-base text-suka-brown leading-tight font-display tracking-wide">
                Monitoring Dashboard
              </h1>
              <p className="text-[10px] text-suka-gray-500 font-extrabold tracking-widest uppercase mt-0.5">
                Stock Control Panel
              </p>
            </div>
          </div>
          {/* Avatar visible on mobile right side only */}
          <div className="md:hidden relative">
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-8 h-8 rounded-full ring-2 ring-suka-orange/20 overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            >
              <Avatar name={outletStaff?.name || ''} size={32} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-36 bg-white rounded-xl shadow-lg border border-suka-brown/10 py-1.5 z-50 flex flex-col">
                <a href={resolvedPortalUrl} className="px-4 py-2.5 text-xs font-bold text-[#544437] hover:bg-[#faf2e9] transition-colors">
                  ← Portal Utama
                </a>
                <button onClick={() => refetch()} className="px-4 py-2.5 text-xs font-bold text-suka-brown hover:bg-suka-cream text-left flex items-center gap-2 transition-colors">
                  <RefreshCw size={12} /> Refresh Data
                </button>
                <Link href="/stok/waste-history" className="px-4 py-2.5 text-xs font-bold text-suka-brown hover:bg-suka-cream text-left flex items-center gap-2 transition-colors">
                  🗑️ Riwayat Waste Saya
                </Link>
                <button onClick={handleLogout} className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 text-left flex items-center gap-2 transition-colors border-t border-suka-brown/5">
                  <LogOut size={12} /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* User Session Bar - Stacks below on mobile, inline on desktop */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3 border-t md:border-t-0 border-suka-brown/5 pt-2.5 md:pt-0">
          <div className="flex flex-col text-left md:text-right">
            <span className="text-xs font-extrabold text-[#1e1b15]">{outletStaff?.name || '...'}</span>
            <span className="text-[10px] text-suka-orange font-bold uppercase tracking-wider mt-0.5">
              {data?.outlet_name || 'OUTLET'}
            </span>
          </div>

          <div className="hidden md:block relative">
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-9 h-9 rounded-full ring-2 ring-suka-orange/20 overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            >
              <Avatar name={outletStaff?.name || ''} size={36} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-suka-brown/10 py-1.5 z-50 flex flex-col">
                <a href={resolvedPortalUrl} className="px-4 py-2.5 text-xs font-bold text-[#544437] hover:bg-[#faf2e9] transition-colors">
                  ← Portal Utama
                </a>
                <button onClick={() => refetch()} className="px-4 py-2.5 text-xs font-bold text-suka-brown hover:bg-suka-cream text-left flex items-center gap-2 transition-colors">
                  <RefreshCw size={12} /> Refresh Data
                </button>
                <Link href="/stok/waste-history" className="px-4 py-2.5 text-xs font-bold text-suka-brown hover:bg-suka-cream text-left flex items-center gap-2 transition-colors">
                  🗑️ Riwayat Waste Saya
                </Link>
                <button onClick={handleLogout} className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 text-left flex items-center gap-2 transition-colors border-t border-suka-brown/5">
                  <LogOut size={12} /> Keluar
                </button>
              </div>
            )}
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
          <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider">
            Saldo Stok Real-time
          </h2>

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
                              {formatCompositeSaldoAdaptive(item.current_qty, item.saldo_is_gram, item.satuan, item.satuan_kecil, item.faktor_tampilan)} / <span className="font-bold text-red-700">Reorder {item.threshold} {item.satuan}</span>
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
