'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';
import { useLedgerTransaksiList } from '@/hooks/useLedger';
import { LedgerList } from '@/components/stok/LedgerList';
import { OutletSwitcher } from '@/components/common/OutletSwitcher';
import { BottomNav } from '@/components/common/BottomNav';

export default function LedgerPage() {
  const { outletStaff } = useAuth();
  const { selectedOutletId } = useOutletScope();
  const [page, setPage] = useState(0);
  const { transaksi, loading, error } = useLedgerTransaksiList(selectedOutletId, page);

  if (!outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">Memuat Data Karyawan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-32">
      {/* Header Banner */}
      <header className="bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex items-center justify-between shadow-[0_2px_8px_rgba(144,77,0,0.03)] sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Dashboard">
            <span className="text-base">←</span>
          </Link>
          <h1 className="text-xl font-extrabold text-[#701604] tracking-tight truncate">
            Ledger Stok
          </h1>
        </div>
        <div className="flex items-center shrink-0">
          <OutletSwitcher />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
        <Link href="/stok/ledger/new" className="block">
          <button className="w-full py-3.5 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm uppercase tracking-wider active:scale-95 flex items-center justify-center gap-2">
            <span>📝</span> + Buat Entri Manual
          </button>
        </Link>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-700">
            🚨 Error: {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-10 h-10 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-[#701604]/70 font-bold uppercase tracking-wider text-xs mt-4 animate-pulse">Memuat data log pergerakan...</p>
          </div>
        ) : (
          <LedgerList items={transaksi || []} />
        )}

        {/* Pagination Controls */}
        {!loading && (transaksi || []).length > 0 && (
          <div className="flex justify-between items-center bg-white border border-[#d9c2b2]/40 p-4 rounded-2xl shadow-[0px_4px_12px_rgba(144,77,0,0.03)] mt-6">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 bg-white border border-[#d9c2b2]/45 hover:bg-[#fff8f1]/50 text-[#701604] disabled:opacity-35 disabled:hover:bg-white rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              ← Halaman Sebelumnya
            </button>
            <span className="text-xs font-bold text-[#544437]/60">
              Halaman {page + 1}
            </span>
            <button
              disabled={(transaksi || []).length < 50}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 bg-white border border-[#d9c2b2]/45 hover:bg-[#fff8f1]/50 text-[#701604] disabled:opacity-35 disabled:hover:bg-white rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              Halaman Berikutnya →
            </button>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
}
