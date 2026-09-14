'use client'
import { useAuth } from '@suka/auth'
import { Loader2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown'
import { KirimanVendorBoard } from '@/components/stok/KirimanVendorBoard'
import { canLihatKirimanVendor } from '@/lib/stok/kirimanVendor'

export default function KirimanVendorPage() {
  const { outletStaff } = useAuth()

  if (!outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-[#701604] mx-auto" />
          <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">Memuat…</p>
        </div>
      </div>
    )
  }

  // Guard UI saja -- RPC memeriksa ulang peran di DB (_cek_laporan_kiriman_vendor).
  if (!canLihatKirimanVendor(outletStaff.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1] text-center px-6">
        <p className="text-xs font-bold text-gray-500">
          Halaman ini untuk kitchen, purchasing, admin, owner, admin finance, SPV, dan regional manager.
        </p>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-24">
        <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-2xs sticky top-0 z-20">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight truncate">
              Kiriman per Vendor
            </h1>
            <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider mt-0.5">
              Vendor yang dikirim ke tiap outlet, dari surat jalan
            </p>
          </div>
          <UserAvatarDropdown />
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 mt-6">
          <KirimanVendorBoard />
        </main>
      </div>
    </AppLayout>
  )
}
