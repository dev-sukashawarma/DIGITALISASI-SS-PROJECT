'use client'

import { useAuth } from '@suka/auth'
import { Loader2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown'
import { FormPengajuanRefund } from '@/components/refund/FormPengajuanRefund'

export default function BuatReturPage() {
  const { outletStaff } = useAuth()
  const outletId = outletStaff?.outlet_id

  if (!outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-amber-800 mx-auto" />
          <p className="text-amber-800 font-bold uppercase tracking-wider text-xs">Memuat data...</p>
        </div>
      </div>
    )
  }

  if (!outletId) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f1] px-6 text-center">
          <p className="text-xs font-bold text-gray-500">
            Akun ini tidak terhubung ke outlet mana pun untuk mengajukan retur bahan.
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-24">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-2xs sticky top-0 z-20">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight">
              Ajukan Retur Bahan
            </h1>
            <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider mt-0.5">
              Input berat timbangan & bukti foto untuk klaim ganti fisik
            </p>
          </div>
          <UserAvatarDropdown />
        </header>

        {/* Content Form */}
        <main className="max-w-xl mx-auto px-4 sm:px-6 mt-6">
          <FormPengajuanRefund outletId={outletId} />
        </main>
      </div>
    </AppLayout>
  )
}
