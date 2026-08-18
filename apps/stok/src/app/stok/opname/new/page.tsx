'use client';

import React from 'react';
import { useAuth } from '@suka/auth';
import { OpnameForm } from '@/components/stok/OpnameForm';
import { AppLayout } from '@/components/layout/AppLayout';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewOpnamePage() {
  const { outletStaff } = useAuth();

  if (!outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-suka-brown font-bold uppercase tracking-wider text-sm">Memuat Data Karyawan...</p>
        </div>
      </div>
    );
  }

  if (!outletStaff.outlet_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <p className="text-red-600 font-bold uppercase tracking-wider text-sm">Akun tidak terhubung ke outlet manapun</p>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-16">
        {/* Header Banner */}
        <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-2xs sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/stok/opname"
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-suka-cream/50 hover:bg-suka-cream text-suka-brown active:scale-95 transition-all shadow-2xs"
              title="Kembali ke Riwayat Opname"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-suka-brown tracking-tight truncate">
                Form Opname Baru
              </h1>
              <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider mt-0.5">
                Input Stok Fisik Aktual
              </p>
            </div>
          </div>
        </header>

        {/* Main Form Container */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-6">
          <OpnameForm outletId={outletStaff.outlet_id} createdBy={outletStaff.id} role={outletStaff.role} />
        </main>
      </div>
    </AppLayout>
  );
}
