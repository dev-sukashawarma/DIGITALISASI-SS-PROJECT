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
    <div className="min-h-screen bg-[#fff8f1] text-[#400a07] pb-12">
      {/* Header Banner */}
      <header className="bg-white border-b border-[#701604]/10 px-8 py-5 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Link href="/stok/opname" className="text-[#701604]/60 hover:text-[#701604] transition-colors text-sm font-bold flex items-center gap-1">
              ← Kembali ke Daftar
            </Link>
          </div>
          <h1 className="text-xl font-extrabold text-[#701604] tracking-tight uppercase mt-1">
            FORM OPNAME BARU
          </h1>
        </div>
        <div className="bg-[#faf2e9] border border-[#701604]/10 px-4 py-2 rounded-xl text-xs font-bold text-[#701604]/80 shadow-sm">
          Petugas: <span className="text-[#701604] font-extrabold uppercase">{outletStaff.name}</span>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="max-w-3xl mx-auto px-4 mt-8">
        <OpnameForm outletId={outletStaff.outlet_id} createdBy={outletStaff.id} />
      </main>
    </div>
  );
}
