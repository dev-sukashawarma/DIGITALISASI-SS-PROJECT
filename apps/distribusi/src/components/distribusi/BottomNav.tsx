'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { getCrossAppUrl } from '@/lib/navigation'

import { LayoutDashboard, FilePlus2, PackageCheck, History, QrCode } from 'lucide-react'

interface BottomNavProps {
  activeTab: 'dashboard' | 'terima' | 'riwayat' | 'surat-jalan' | 'pengiriman' | 'terima-supplier' | 'scan' | 'none'
}

export function BottomNav({ activeTab }: BottomNavProps) {
  const router = useRouter()
  const { outletStaff, loading } = useAuth()

  if (loading || !outletStaff) return null

  const isPusat = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(outletStaff.role)
  const isKitchen = outletStaff.role === 'kitchen'

  const handleNavigate = (path: string) => {
    const resolvedUrl = getCrossAppUrl(path)
    if (resolvedUrl.startsWith('http')) {
      window.location.href = resolvedUrl
    } else {
      router.push(resolvedUrl)
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-3 py-2.5 pb-safe bg-white/90 backdrop-blur-xl border-t border-suka-brown/10 shadow-[0_-8px_25px_rgba(112,22,4,0.06)] rounded-t-2xl lg:hidden">
      {isPusat ? (
        <>
          {/* Dashboard */}
          <button
            onClick={() => handleNavigate('/dashboard')}
            className={`flex flex-col items-center justify-center transition-all duration-200 cursor-pointer min-w-[64px] py-1 px-3 rounded-xl ${
              activeTab === 'dashboard'
                ? 'bg-suka-orange text-white shadow-md shadow-suka-orange/25 scale-[1.02]'
                : 'text-suka-gray-500 hover:text-suka-brown active:scale-95'
            }`}
          >
            <LayoutDashboard size={18} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1 leading-none">Dashboard</span>
          </button>

          {/* Surat Jalan */}
          <button
            onClick={() => handleNavigate('/distribusi/surat-jalan/new')}
            className={`flex flex-col items-center justify-center transition-all duration-200 cursor-pointer min-w-[64px] py-1 px-3 rounded-xl ${
              activeTab === 'surat-jalan'
                ? 'bg-suka-orange text-white shadow-md shadow-suka-orange/25 scale-[1.02]'
                : 'text-suka-gray-500 hover:text-suka-brown active:scale-95'
            }`}
          >
            <FilePlus2 size={18} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1 leading-none">Buat SJ</span>
          </button>

          {/* Terima Bahan (khusus kitchen) */}
          {isKitchen && (
            <button
              onClick={() => handleNavigate('/distribusi/terima-bahan')}
              className={`flex flex-col items-center justify-center transition-all duration-200 cursor-pointer min-w-[64px] py-1 px-3 rounded-xl ${
                activeTab === 'terima-supplier'
                  ? 'bg-suka-orange text-white shadow-md shadow-suka-orange/25 scale-[1.02]'
                  : 'text-suka-gray-500 hover:text-suka-brown active:scale-95'
              }`}
            >
              <PackageCheck size={18} />
              <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1 leading-none">PO Bahan</span>
            </button>
          )}

          {/* Riwayat */}
          <button
            onClick={() => handleNavigate('/distribusi/surat-jalan')}
            className={`flex flex-col items-center justify-center transition-all duration-200 cursor-pointer min-w-[64px] py-1 px-3 rounded-xl ${
              activeTab === 'riwayat'
                ? 'bg-suka-orange text-white shadow-md shadow-suka-orange/25 scale-[1.02]'
                : 'text-suka-gray-500 hover:text-suka-brown active:scale-95'
            }`}
          >
            <History size={18} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1 leading-none">Riwayat</span>
          </button>
        </>
      ) : (
        <>
          {/* Dashboard */}
          <button
            onClick={() => handleNavigate('/dashboard')}
            className={`flex flex-col items-center justify-center transition-all duration-200 cursor-pointer min-w-[64px] py-1 px-3 rounded-xl ${
              activeTab === 'dashboard'
                ? 'bg-suka-orange text-white shadow-md shadow-suka-orange/25 scale-[1.02]'
                : 'text-suka-gray-500 hover:text-suka-brown active:scale-95'
            }`}
          >
            <LayoutDashboard size={18} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1 leading-none">Dashboard</span>
          </button>

          {/* Scan */}
          <button
            onClick={() => handleNavigate('/distribusi/terima/scan')}
            className={`flex flex-col items-center justify-center transition-all duration-200 cursor-pointer min-w-[64px] py-1 px-3 rounded-xl ${
              activeTab === 'scan'
                ? 'bg-suka-orange text-white shadow-md shadow-suka-orange/25 scale-[1.02]'
                : 'text-suka-gray-500 hover:text-suka-brown active:scale-95'
            }`}
          >
            <QrCode size={18} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1 leading-none">Scan QR</span>
          </button>

          {/* Riwayat */}
          <button
            onClick={() => handleNavigate('/distribusi/riwayat')}
            className={`flex flex-col items-center justify-center transition-all duration-200 cursor-pointer min-w-[64px] py-1 px-3 rounded-xl ${
              activeTab === 'riwayat'
                ? 'bg-suka-orange text-white shadow-md shadow-suka-orange/25 scale-[1.02]'
                : 'text-suka-gray-500 hover:text-suka-brown active:scale-95'
            }`}
          >
            <History size={18} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1 leading-none">Riwayat</span>
          </button>
        </>
      )}
    </nav>
  )
}
