'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLedgerList } from '@/hooks/useLedger';
import { LedgerList } from '@/components/stok/LedgerList';
import { getCrossAppUrl } from '@/lib/navigation';

export default function LedgerPage() {
  const router = useRouter();
  const { outletStaff } = useAuth();
  const [page, setPage] = useState(0);
  const { ledger, loading, error } = useLedgerList(outletStaff?.outlet_id, page);

  const handleNavigate = (path: string) => {
    const resolvedUrl = getCrossAppUrl(path);
    if (resolvedUrl.startsWith('http')) {
      window.location.href = resolvedUrl;
    } else {
      router.push(resolvedUrl);
    }
  };

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
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Dashboard">
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Ledger Pergerakan Stok</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">
              Outlet {outletStaff.name} • {outletStaff.role?.toUpperCase()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link href="/stok/ledger/new">
            <button className="px-3.5 py-1.5 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm uppercase tracking-wider active:scale-95">
              + Entri Manual
            </button>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
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
          <LedgerList items={ledger || []} />
        )}

        {/* Pagination Controls */}
        {!loading && (ledger || []).length > 0 && (
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
              disabled={(ledger || []).length < 50}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 bg-white border border-[#d9c2b2]/45 hover:bg-[#fff8f1]/50 text-[#701604] disabled:opacity-35 disabled:hover:bg-white rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              Halaman Berikutnya →
            </button>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-3 pb-safe bg-[#f5ede3] border-t border-[#d9c2b2]/40 shadow-2xl rounded-t-2xl lg:hidden">
        <button
          onClick={() => handleNavigate('/dashboard')}
          className="flex flex-col items-center justify-center text-[#544437]/75 hover:text-[#701604] px-4 py-1 active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-xl">📊</span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Dashboard</span>
        </button>
        <button
          onClick={() => handleNavigate('/stok/ledger')}
          className="flex flex-col items-center justify-center bg-[#f29744] text-white rounded-xl px-5 py-2 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <span className="text-xl">📒</span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Ledger</span>
        </button>
        <button
          onClick={() => handleNavigate('/stok/opname')}
          className="flex flex-col items-center justify-center text-[#544437]/75 hover:text-[#701604] px-4 py-1 active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-xl">📋</span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Opname</span>
        </button>
        <button
          onClick={() => handleNavigate('/distribusi/terima')}
          className="flex flex-col items-center justify-center text-[#544437]/75 hover:text-[#701604] px-4 py-1 active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-xl">🚚</span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Terima</span>
        </button>
      </nav>
    </div>
  );
}
