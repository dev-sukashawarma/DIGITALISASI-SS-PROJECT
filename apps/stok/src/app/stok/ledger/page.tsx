'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';
import { useLedgerTransaksiList } from '@/hooks/useLedger';
import { LedgerList } from '@/components/stok/LedgerList';
import { OutletSwitcher } from '@/components/common/OutletSwitcher';
import { AppLayout } from '@/components/layout/AppLayout';
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown';
import { Plus, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function LedgerPage() {
  const { outletStaff } = useAuth();
  const { selectedOutletId } = useOutletScope();
  const [page, setPage] = useState(0);
  const { transaksi, loading, error } = useLedgerTransaksiList(selectedOutletId, page);

  if (!outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-[#701604] mx-auto" />
          <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">Memuat Data Karyawan...</p>
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
              Ledger Stok
            </h1>
            <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider mt-0.5">
              Buku Kas & Riwayat Mutasi Bahan
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <OutletSwitcher />
            <UserAvatarDropdown />
          </div>
        </header>

        {/* Main Container */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
          <Link href="/stok/ledger/new" className="block">
            <button className="w-full py-3.5 bg-suka-orange hover:bg-orange-600 active:bg-orange-700 text-white rounded-2xl font-black text-sm transition-all shadow-xs uppercase tracking-wider active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
              <Plus className="w-5 h-5" /> Buat Entri Manual
            </button>
          </Link>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs font-bold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Error: {error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-suka-orange mx-auto" />
              <p className="text-suka-brown/70 font-bold uppercase tracking-wider text-xs mt-4 animate-pulse">Memuat data log pergerakan...</p>
            </div>
          ) : (
            <LedgerList items={transaksi || []} />
          )}

          {/* Pagination Controls */}
          {!loading && (transaksi || []).length > 0 && (
            <div className="flex justify-between items-center bg-white border border-suka-brown/10 p-4 rounded-2xl shadow-xs mt-6">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 flex items-center gap-2 bg-white border border-suka-brown/15 hover:bg-suka-cream text-suka-brown disabled:opacity-35 disabled:hover:bg-white rounded-xl font-bold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Halaman Sebelumnya
              </button>
              <span className="text-xs font-bold text-suka-brown/60">
                Halaman {page + 1}
              </span>
              <button
                disabled={(transaksi || []).length < 50}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 flex items-center gap-2 bg-white border border-suka-brown/15 hover:bg-suka-cream text-suka-brown disabled:opacity-35 disabled:hover:bg-white rounded-xl font-bold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
              >
                Halaman Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
