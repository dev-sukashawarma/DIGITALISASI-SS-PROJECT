'use client';

import Link from 'next/link';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';
import { useMutasiList } from '@/hooks/useMutasi';
import { MutasiList } from '@/components/stok/MutasiList';
import { OutletSwitcher } from '@/components/common/OutletSwitcher';
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown';
import { AppLayout } from '@/components/layout/AppLayout';
import { Plus, Loader2 } from 'lucide-react';

export default function MutasiPage() {
  const { outletStaff } = useAuth();
  const { selectedOutletId, boundOutlets } = useOutletScope();
  
  const isGudangSelected = boundOutlets.find(o => o.id === selectedOutletId)?.name?.toUpperCase().includes('GUDANG');
  const queryOutletId = isGudangSelected ? undefined : (selectedOutletId || undefined);
  
  const { mutasi, loading, error } = useMutasiList(queryOutletId);

  if (!outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-suka-orange mx-auto" />
          <p className="text-suka-brown font-bold uppercase tracking-wider text-sm">Memuat Data...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-24">
        {/* Header Banner */}
        <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-2xs sticky top-0 z-20">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight truncate">
              Mutasi Antar Outlet
            </h1>
            <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider mt-0.5">
              Transfer & Perpindahan Stok Fisik
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <OutletSwitcher />
            <UserAvatarDropdown />
          </div>
        </header>

        {/* Main Container */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
          <Link href="/stok/mutasi/new" className="block">
            <button className="w-full py-3.5 bg-suka-orange hover:bg-orange-600 active:bg-orange-700 text-white rounded-2xl font-black text-sm transition-all shadow-xs uppercase tracking-wider active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
              <Plus className="w-5 h-5" /> Buat Mutasi Baru
            </button>
          </Link>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs font-bold text-red-700">
              🚨 Error: {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-suka-orange mx-auto" />
              <p className="text-suka-brown/70 font-bold uppercase tracking-wider text-xs mt-4 animate-pulse">Memuat data mutasi...</p>
            </div>
          ) : (
            <MutasiList items={mutasi || []} />
          )}
        </main>
      </div>
    </AppLayout>
  );
}
