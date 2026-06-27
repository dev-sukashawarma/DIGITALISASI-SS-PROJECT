'use client';

import React, { useState, useEffect } from 'react';
import { CrewList } from './CrewList';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useCrewMonitoringData } from '@/hooks/useMonitoringData';
import { useAuth, createSupabaseBrowserClient } from '@suka/auth';
import type { MonitoringItem } from '@/lib/types/monitoring';
import Link from 'next/link';
import { Skeleton } from '@suka/design-system';

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
    <div className="min-h-screen bg-[#fff8f1]">
      {/* Top Header App Bar */}
      <header className="bg-white sticky top-0 z-40 w-full px-4 py-3 border-b border-[#d9c2b2]/30 shadow-[0px_4px_12px_rgba(144,77,0,0.04)]">
        {/* Top Row: Navigation and Profile */}
        <div className="flex items-center justify-between w-full">
          <Link 
            href="/dashboard" 
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#fff8f1] hover:bg-[#f5ede3] border border-[#d9c2b2]/45 text-[#701604] transition-all active:scale-95 flex-shrink-0"
            title="Kembali ke Dashboard"
          >
            <span className="text-base font-bold">←</span>
          </Link>

          <div className="flex items-center gap-1.5">
            <img 
              src="/logo.png" 
              alt="Suka Logo" 
              className="h-6 w-auto object-contain" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
            />
            <span className="text-xs font-black text-[#701604] tracking-wider uppercase">SS Digital</span>
          </div>

          <div 
            className="w-9 h-9 rounded-full bg-[#fd7e62]/20 flex items-center justify-center overflow-hidden border border-[#fd7e62]/40 flex-shrink-0 relative"
            title={`Logged in as ${outletStaff?.name || 'Staff'}`}
          >
            {outletStaff?.ref_photo_url && (
              <img 
                src={outletStaff.ref_photo_url} 
                alt="Staff Profile" 
                className="absolute inset-0 w-full h-full object-cover z-10" 
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <span className="text-base">🧑‍🍳</span>
          </div>
        </div>

        {/* Title and Outlet Name */}
        <div className="mt-3 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#701604] uppercase tracking-tight leading-tight">
              {isLoading && !data ? <Skeleton className="h-5 w-32 inline-block" /> : (data?.outlet_name || 'Outlet')} - Monitoring
            </h1>
            <p className="text-[10px] font-bold text-[#f29744] uppercase tracking-widest mt-0.5">
              Stock Control Panel
            </p>
          </div>

          {/* Actions Button Group */}
          <div className="flex items-center gap-1.5 mt-1 md:mt-0 w-full md:w-auto">
            <a
              href={resolvedPortalUrl}
              className="flex-1 md:flex-initial px-3 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-[#fff8f1] border border-[#d9c2b2]/50 text-[#701604] font-bold text-[11px] transition-all active:scale-95 shadow-sm"
              title="Portal"
            >
              Portal
            </a>
            <button
              onClick={() => refetch()}
              className="px-3 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-[#fff8f1] border border-[#d9c2b2]/50 text-[#701604] font-bold text-[11px] transition-all active:scale-95 shadow-sm flex items-center gap-1"
              title="Refresh"
            >
              🔄 Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 md:flex-initial px-3 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-red-50 border border-red-200 text-red-600 font-bold text-[11px] transition-all active:scale-95 shadow-sm"
              title="Logout"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Meta Information Bar */}
        <div className="mt-3 pt-3 border-t border-[#d9c2b2]/20 flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] text-[#544437]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-[#a43c26] text-white px-2 py-0.5 rounded-full font-bold text-[9px] tracking-wide uppercase">
                Outlet {isLoading && !data ? '...' : (data?.outlet_name ? 'Active' : '...')}
              </span>
              <span className="font-semibold">
                Crew: <span className="font-bold text-gray-800">{outletStaff?.name || '...'}</span>
              </span>
            </div>
            <span className="font-medium text-right">
              Total Items: <span className="font-bold text-[#701604]">{isLoading && !data ? <Skeleton className="h-3 w-8 inline-block" /> : (data?.items?.length || '0')}</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-[#544437]/60 font-semibold border-t border-[#d9c2b2]/10 pt-2">
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Check stok status before shifts & opname
            </span>
            <span>
              Last updated: {displayTime || 'Never'}
            </span>
          </div>
        </div>
      </header>

      <main className="px-4 flex flex-col md:grid md:grid-cols-12 md:gap-6 mt-6 pb-28 max-w-7xl mx-auto">
        {/* Connection unstable alert */}
        {isError && (
          <div className="col-span-12 p-3.5 bg-[#ffdad6] text-[#ba1a1a] rounded-2xl border border-[#ba1a1a]/20 text-xs font-semibold flex flex-col gap-2">
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

        {/* Left Column: Real-time Stock Balance Grid */}
        <div className="col-span-12 md:col-span-7 order-2 md:order-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider">
              Saldo Stok Real-time
            </h2>
            <button className="text-[#904d00] font-semibold text-xs flex items-center gap-1">
              Filter <span>⚙️</span>
            </button>
          </div>
          
          {/* List */}
          <CrewList items={data?.items || []} onItemClick={setSelectedItem} loading={isLoading && !data} />
        </div>

        {/* Right Column: Alerts & Quick Actions */}
        <div className="col-span-12 md:col-span-5 order-1 md:order-2 space-y-6">
          {/* Section 1: Critical Alerts Widget */}
          {isLoading && !data ? (
            <Skeleton className="h-44 w-full" />
          ) : (
            (criticalItems.length > 0 || isOpnameOverdue) && (
              <section className="bg-white rounded-xl border border-[#d9c2b2]/45 shadow-[0px_4px_12px_rgba(144,77,0,0.06)] p-4 flex flex-col gap-4">
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
                          {opnameAgeText} (<span className="text-[#ba1a1a] font-bold uppercase text-[9px]">Overdue</span>)
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
              </section>
            )
          )}

          <section className="bg-white border border-[#d9c2b2]/45 rounded-xl p-5 shadow-[0px_4px_12px_rgba(144,77,0,0.06)] space-y-4">
            <h3 className="font-bold text-xs text-[#544437] uppercase tracking-wider pl-0.5">Aksi Cepat</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/stok/permintaan" className="bg-[#faf2e9]/40 border border-[#d9c2b2]/45 hover:bg-[#faf2e9] rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:shadow transition-all active:scale-95">
                <span className="text-xl">📝</span>
                <span className="text-xs font-semibold text-[#544437]">Permintaan Bahan</span>
              </Link>
              <Link href="/stok/ledger/new" className="bg-[#faf2e9]/40 border border-[#d9c2b2]/45 hover:bg-[#faf2e9] rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:shadow transition-all active:scale-95">
                <span className="text-xl">📒</span>
                <span className="text-xs font-semibold text-[#544437]">Entri Ledger</span>
              </Link>
              <Link href="/stok/opname/new" className="bg-[#faf2e9]/40 border border-[#d9c2b2]/45 hover:bg-[#faf2e9] rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:shadow transition-all active:scale-95">
                <span className="text-xl">📋</span>
                <span className="text-xs font-semibold text-[#544437]">Mulai Opname</span>
              </Link>
              <Link href="/stok/permintaan" className="bg-[#faf2e9]/40 border border-[#d9c2b2]/45 hover:bg-[#faf2e9] rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center shadow-sm hover:shadow transition-all active:scale-95">
                <span className="text-xl">📝</span>
                <span className="text-xs font-semibold text-[#544437]">Permintaan Bahan</span>
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 pb-safe bg-[#f5ede3] border-t border-[#877365]/20 shadow-2xl rounded-t-2xl">
        <Link href="/dashboard" className="flex flex-col items-center justify-center bg-[#f29744] text-[#643400] rounded-xl px-5 py-2 shadow-sm active:scale-95 transition-all">
          <span className="text-lg leading-none">📊</span>
          <span className="text-[10px] font-bold mt-0.5">Dashboard</span>
        </Link>
        <Link href="/stok/ledger" className="flex flex-col items-center justify-center text-[#544437] hover:bg-[#e9e1d8]/50 px-4 py-1.5 rounded-full transition-all active:scale-95">
          <span className="text-lg leading-none">📒</span>
          <span className="text-[10px] font-bold mt-0.5">Ledger</span>
        </Link>
        <Link href="/stok/opname" className="flex flex-col items-center justify-center text-[#544437] hover:bg-[#e9e1d8]/50 px-4 py-1.5 rounded-full transition-all active:scale-95">
          <span className="text-lg leading-none">📋</span>
          <span className="text-[10px] font-bold mt-0.5">Opname</span>
        </Link>
        <Link href="/stok/permintaan" className="flex flex-col items-center justify-center text-[#544437] hover:bg-[#e9e1d8]/50 px-4 py-1.5 rounded-full transition-all active:scale-95">
          <span className="text-lg leading-none">📝</span>
          <span className="text-[10px] font-bold mt-0.5">Permintaan</span>
        </Link>
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
