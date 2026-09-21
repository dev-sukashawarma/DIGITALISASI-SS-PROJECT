'use client'

import React from 'react'
import { useAuth } from '@suka/auth'
import { useOutletScope } from '@/hooks/useOutletScope'
import { AppLayout } from '@/components/layout/AppLayout'
import { OutletSwitcher } from '@/components/common/OutletSwitcher'
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown'
import { JurnalMutasiDashboard } from '@/components/jurnal-mutasi/JurnalMutasiDashboard'
import { Loader2, ShieldAlert } from 'lucide-react'

const MANAGEMENT_ROLES = [
  'admin',
  'owner',
  'spv',
  'regional_manager',
  'area_manager',
  'leader',
  'kitchen',
  'purchasing',
  'admin_finance',
  'developer',
]

export default function JurnalMutasiPage() {
  const { outletStaff, loading: authLoading } = useAuth()
  const { selectedOutletId } = useOutletScope()

  if (authLoading || !outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-[#701604] mx-auto" />
          <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">
            Memverifikasi Hak Akses...
          </p>
        </div>
      </div>
    )
  }

  const role = outletStaff.role || ''
  const isAuthorized = MANAGEMENT_ROLES.includes(role)

  if (!isAuthorized) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white p-8 rounded-3xl border border-red-200 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-suka-brown">Akses Khusus Manajemen</h2>
            <p className="text-xs text-suka-brown/70 leading-relaxed">
              Laporan Jurnal & Rekonsiliasi Pergerakan Bahan Baku memuat data valuasi finansial dan harga beli. Halaman ini hanya dapat diakses oleh Owner, Admin, SPV, Area Leader, Kitchen, dan Finance.
            </p>
          </div>
        </div>
      </AppLayout>
    )
  }

  const effectiveOutletId = selectedOutletId || outletStaff.outlet_id

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#fffdfa] text-[#1e1b15]">
        {/* Header Banner */}
        <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-2xs sticky top-0 z-20">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-suka-brown tracking-tight">
              Jurnal & Rekonsiliasi Bahan
            </h1>
            <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider mt-0.5">
              Audit Alur Persediaan & Analisis Selisih Opname
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <OutletSwitcher />
            <UserAvatarDropdown />
          </div>
        </header>

        {/* Main Dashboard */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
          <JurnalMutasiDashboard initialOutletId={effectiveOutletId} />
        </main>
      </div>
    </AppLayout>
  )
}
