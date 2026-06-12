'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { usePengirimanList } from '@/hooks/usePengirimanList'
import { BottomNav } from './BottomNav'


export function PengirimanList() {
  const router = useRouter()
  const { outletStaff, loading: authLoading } = useAuth()
  const { data, loading } = usePengirimanList()

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-wider animate-pulse">Memuat session auth...</p>
      </div>
    )
  }

  if (outletStaff?.role !== 'kepala_outlet') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff8f1] text-center px-6">
        <span className="text-4xl mb-3">⚠️</span>
        <p className="text-[#701604] font-bold text-base uppercase tracking-wider">Akses Ditolak</p>
        <p className="text-[#544437]/70 text-xs font-semibold mt-1 mb-6">Halaman ini hanya dapat diakses oleh SPV Pusat.</p>
        <Link href="/dashboard" className="px-5 py-2.5 bg-[#701604] hover:bg-[#591002] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all">
          ← Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Dashboard">
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Pantau Pengiriman</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">
              Outlet {outletStaff?.name} • SPV Pusat
            </p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="p-4 max-w-5xl mx-auto space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-[#544437]/40 font-bold uppercase tracking-wider animate-pulse">
            Memuat daftar pengiriman...
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-12 text-center shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
            <span className="text-3xl">📭</span>
            <p className="text-[#544437]/50 font-bold text-sm mt-2">Belum ada pengiriman surat jalan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((sj) => (
              <div
                key={sj.id}
                onClick={() => router.push(`/distribusi/surat-jalan/${sj.id}`)}
                className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-4 flex flex-col justify-between shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/45 hover:shadow-md active:scale-[0.99] transition-all duration-200 cursor-pointer"
              >
                <div className="space-y-3">
                  {/* Badge & Status Row */}
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#701604]/70 bg-[#faf2e9] px-2.5 py-0.5 rounded border border-[#d9c2b2]/30">
                      SJ: {sj.document_number || sj.id.substring(0, 8).toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider border ${
                      sj.status === 'draft'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : sj.status === 'dikirim' || sj.status === 'dikirim_lengkap'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : sj.status === 'selesai'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                    }`}>
                      {sj.status === 'draft' && 'Draft'}
                      {(sj.status === 'dikirim' || sj.status === 'dikirim_lengkap') && 'Dikirim'}
                      {sj.status === 'selesai' && 'Selesai'}
                      {(sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian') && (
                        sj.has_problem ? 'Diterima Sebagian' : 'Diterima Lengkap'
                      )}
                    </span>
                  </div>

                  {/* Destination Info */}
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-[#544437]/40 uppercase tracking-widest pl-0.5">Tujuan Outlet</p>
                    <h4 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wide leading-tight">
                      {sj.outlets?.name || 'Unknown Outlet'}
                    </h4>
                  </div>

                  {/* Footer Stats */}
                  <div className="flex justify-between items-center pt-3 border-t border-[#d9c2b2]/15 text-[10px] text-[#544437]/60 font-semibold mt-1">
                    <span>
                      {new Date(sj.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>

                    {sj.status !== 'draft' && sj.status !== 'dikirim' && sj.status !== 'dikirim_lengkap' && (
                      sj.has_problem ? (
                        <span className="px-2 py-0.5 rounded-lg text-[8px] font-bold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 shrink-0">
                          <span>⚠️</span> Selisih
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg text-[8px] text-[#0a7d2c] font-bold uppercase flex items-center gap-1 bg-emerald-50 border border-emerald-200 shrink-0">
                          <span>✓</span> Aman
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="pengiriman" />
    </div>
  )
}
