'use client'
import { useAuth } from '@suka/auth'
import { Loader2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown'
import { NotaVendorBoard } from '@/components/stok/NotaVendorBoard'
import { canLihatNotaVendor, canSahkanNotaVendor } from '@/lib/stok/approver'

export default function NotaVendorPage() {
  const { outletStaff } = useAuth()
  const role = outletStaff?.role

  // Hooks di atas, sebelum early-return apa pun (React #310) -- outletStaff
  // yang belum siap ditangani lewat guard render, bukan dengan menunda hook.
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

  // Guard UI saja -- RPC memeriksa ulang peran di DB (peran_saya()).
  if (!canLihatNotaVendor(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1] text-center px-6">
        <p className="text-xs font-bold text-gray-500">Halaman ini untuk purchasing, kitchen, admin, owner, dan admin finance.</p>
      </div>
    )
  }

  const bolehSahkan = canSahkanNotaVendor(role)

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-24">
        <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-2xs sticky top-0 z-20">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight truncate">
              Cocokkan Nota Vendor
            </h1>
            <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider mt-0.5">
              Tiap tanggal 10, 20, dan akhir bulan: cocokkan catatan crew dengan nota vendor
            </p>
          </div>
          <UserAvatarDropdown />
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 mt-6 space-y-4">
          {!bolehSahkan && (
            <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Mode pantau — pengesahan & penolakan hanya untuk purchasing, kitchen, dan admin.
            </p>
          )}
          <NotaVendorBoard bolehSahkan={bolehSahkan} />
        </main>
      </div>
    </AppLayout>
  )
}
