'use client';

import React, { useState } from 'react';
import { CrewList } from './CrewList';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { useCrewMonitoringData, useMonitoringRealtime } from '@/hooks/useMonitoringData';
import { useAuth, createSupabaseBrowserClient } from '@suka/auth';
import type { MonitoringItem } from '@/lib/types/monitoring';
import Link from 'next/link';
import { Avatar } from '@suka/design-system/src/components/Avatar';
import { LogOut, RefreshCw } from 'lucide-react';
import { BottomNav } from '@/components/common/BottomNav';

export function CrewDashboard() {
  useMonitoringRealtime();
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  const { data, isLoading, isError, error, refetch } = useCrewMonitoringData();
  const { outletStaff } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

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
