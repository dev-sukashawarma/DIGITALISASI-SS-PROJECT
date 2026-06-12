'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { OpnameForm } from '@/components/stok/OpnameForm';
import Link from 'next/link';

export default function NewOpnamePage() {
  const { outletStaff } = useAuth();

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
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      {/* Header Banner */}
      <header className="bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex items-center justify-between shadow-[0_2px_8px_rgba(144,77,0,0.03)] sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/stok/opname" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Riwayat Opname">
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Form Opname Baru</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">
              Petugas: {outletStaff.name} • {outletStaff.role?.toUpperCase()}
            </p>
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="max-w-3xl mx-auto px-4 mt-6">
        <OpnameForm outletId={outletStaff.outlet_id} createdBy={outletStaff.id} />
      </main>
    </div>
  );
}
