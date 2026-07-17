'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';
import { MutasiForm } from '@/components/stok/MutasiForm';
import { BottomNav } from '@/components/common/BottomNav';

export default function NewMutasiPage() {
  const { outletStaff } = useAuth();
  const { selectedOutletId } = useOutletScope();

  if (!outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">Memuat Data...</p>
        </div>
      </div>
    );
  }

  if (!selectedOutletId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4 p-4">
          <p className="text-red-600 font-bold uppercase tracking-wider text-sm">Pilih outlet terlebih dahulu</p>
          <Link href="/stok/mutasi">
            <button className="bg-[#f29744] text-white px-6 py-2 rounded-xl font-bold mt-4">Kembali</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-32">
      <header className="bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex items-center justify-between shadow-[0_2px_8px_rgba(144,77,0,0.03)] sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/stok/mutasi" className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm">
            <span className="text-base">←</span>
          </Link>
          <h1 className="text-xl font-extrabold text-[#701604] tracking-tight truncate">
            Ajukan Mutasi
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6">
        <Suspense fallback={<div className="text-center py-10 text-sm font-bold text-[#544437]/60">Memuat form...</div>}>
          <MutasiForm outletId={selectedOutletId} />
        </Suspense>
      </main>

      <BottomNav />
    </div>
  );
}
