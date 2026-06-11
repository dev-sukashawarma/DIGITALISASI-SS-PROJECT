'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLedgerList } from '@/hooks/useLedger';
import { LedgerList } from '@/components/stok/LedgerList';

export default function LedgerPage() {
  const { outletStaff } = useAuth();
  const [page, setPage] = useState(0);
  const { ledger, loading, error } = useLedgerList(outletStaff?.outlet_id, page);

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
    <div className="min-h-screen bg-[#fff8f1] text-[#400a07] pb-12">
      {/* Header Banner */}
      <header className="bg-white border-b border-[#701604]/10 px-8 py-5 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-[#701604]/60 hover:text-[#701604] transition-colors text-sm font-bold flex items-center gap-1">
                ← Kembali ke Dashboard
              </Link>
            </div>
            <h1 className="text-xl font-extrabold text-[#701604] tracking-tight uppercase mt-1">
              LOG PERGERAKAN STOK (LEDGER)
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-[#faf2e9] border border-[#701604]/10 px-4 py-2 rounded-xl text-xs font-bold text-[#701604]/80 shadow-sm hidden sm:block">
            Outlet: <span className="text-[#701604] font-extrabold uppercase">{outletStaff.name}</span>
          </div>
          <Link href="/stok/ledger/new">
            <button className="px-4 py-2 bg-[#701604] hover:bg-[#591002] text-white rounded-xl font-bold text-xs transition-colors shadow-sm">
              + Entri Manual
            </button>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 mt-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-700">
            🚨 Error: {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-10 h-10 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-[#701604]/70 font-bold uppercase tracking-wider text-xs mt-4">Memuat data log pergerakan...</p>
          </div>
        ) : (
          <LedgerList items={ledger} />
        )}

        {/* Pagination Controls */}
        {!loading && (
          <div className="flex justify-between items-center bg-white border border-[#701604]/10 p-4 rounded-2xl shadow-sm mt-6">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-4.5 py-2.5 bg-white border border-[#701604]/15 hover:bg-[#faf2e9]/50 text-[#701604] disabled:opacity-30 disabled:hover:bg-white rounded-xl font-bold text-xs transition-all shadow-sm"
            >
              ← Halaman Sebelumnya
            </button>
            <span className="text-xs font-bold text-[#701604]/60">
              Halaman {page + 1}
            </span>
            <button
              disabled={ledger.length < 50}
              onClick={() => setPage((p) => p + 1)}
              className="px-4.5 py-2.5 bg-white border border-[#701604]/15 hover:bg-[#faf2e9]/50 text-[#701604] disabled:opacity-30 disabled:hover:bg-white rounded-xl font-bold text-xs transition-all shadow-sm"
            >
              Halaman Berikutnya →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
