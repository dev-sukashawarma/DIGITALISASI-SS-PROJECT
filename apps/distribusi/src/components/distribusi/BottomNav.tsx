'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { getCrossAppUrl } from '@/lib/navigation'

interface BottomNavProps {
  activeTab: 'dashboard' | 'terima' | 'riwayat' | 'surat-jalan' | 'pengiriman' | 'none'
}

export function BottomNav({ activeTab }: BottomNavProps) {
  const router = useRouter()
  const { outletStaff, loading } = useAuth()

  if (loading || !outletStaff) return null

  const isPusat = outletStaff.role === 'kepala_outlet'

  const handleNavigate = (path: string) => {
    const resolvedUrl = getCrossAppUrl(path)
    if (resolvedUrl.startsWith('http')) {
      window.location.href = resolvedUrl
    } else {
      router.push(resolvedUrl)
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-3 pb-safe bg-[#f5ede3] border-t border-[#d9c2b2]/40 shadow-2xl rounded-t-2xl lg:hidden">
      {isPusat ? (
        <>
          {/* Dashboard */}
          <button
            onClick={() => handleNavigate('/dashboard')}
            className={`flex flex-col items-center justify-center active:scale-95 transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#f29744] text-white rounded-xl px-5 py-2 active:scale-95 transition-all duration-200'
                : 'text-[#544437]/75 hover:text-[#701604] px-4 py-1'
            }`}
          >
            <span className="text-xl">📊</span>
            <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Dashboard</span>
          </button>

          {/* Surat Jalan */}
          <button
            onClick={() => handleNavigate('/distribusi/surat-jalan/new')}
            className={`flex flex-col items-center justify-center active:scale-95 transition-all cursor-pointer ${
              activeTab === 'surat-jalan'
                ? 'bg-[#f29744] text-white rounded-xl px-5 py-2 active:scale-95 transition-all duration-200'
                : 'text-[#544437]/75 hover:text-[#701604] px-4 py-1'
            }`}
          >
            <span className="text-xl">➕</span>
            <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Surat Jalan</span>
          </button>

          {/* Riwayat */}
          <button
            onClick={() => handleNavigate('/distribusi/surat-jalan')}
            className={`flex flex-col items-center justify-center active:scale-95 transition-all cursor-pointer ${
              activeTab === 'riwayat'
                ? 'bg-[#f29744] text-white rounded-xl px-5 py-2 active:scale-95 transition-all duration-200'
                : 'text-[#544437]/75 hover:text-[#701604] px-4 py-1'
            }`}
          >
            <span className="text-xl">📚</span>
            <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Riwayat</span>
          </button>
        </>
      ) : (
        <>
          {/* Dashboard */}
          <button
            onClick={() => handleNavigate('/dashboard')}
            className={`flex flex-col items-center justify-center active:scale-95 transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#f29744] text-white rounded-xl px-5 py-2 active:scale-95 transition-all duration-200'
                : 'text-[#544437]/75 hover:text-[#701604] px-4 py-1'
            }`}
          >
            <span className="text-xl">📊</span>
            <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Dashboard</span>
          </button>

          {/* Terima */}
          <button
            onClick={() => handleNavigate('/distribusi/terima')}
            className={`flex flex-col items-center justify-center active:scale-95 transition-all cursor-pointer ${
              activeTab === 'terima'
                ? 'bg-[#f29744] text-white rounded-xl px-5 py-2 active:scale-95 transition-all duration-200'
                : 'text-[#544437]/75 hover:text-[#701604] px-4 py-1'
            }`}
          >
            <span className="text-xl">🚚</span>
            <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Terima</span>
          </button>

          {/* Riwayat */}
          <button
            onClick={() => handleNavigate('/distribusi/riwayat')}
            className={`flex flex-col items-center justify-center active:scale-95 transition-all cursor-pointer ${
              activeTab === 'riwayat'
                ? 'bg-[#f29744] text-white rounded-xl px-5 py-2 active:scale-95 transition-all duration-200'
                : 'text-[#544437]/75 hover:text-[#701604] px-4 py-1'
            }`}
          >
            <span className="text-xl">📚</span>
            <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Riwayat</span>
          </button>
        </>
      )}
    </nav>
  )
}
