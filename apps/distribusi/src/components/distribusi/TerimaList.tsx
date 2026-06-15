'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@suka/auth'
import { useTerimaList } from '@/hooks/useTerimaList'
import { BottomNav } from './BottomNav'

export function TerimaList() {
  const router = useRouter()
  const { outletStaff } = useAuth()
  const { data, loading } = useTerimaList()

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-wider animate-pulse">Memuat daftar penerimaan...</p>
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
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Penerimaan Barang</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">
              Outlet {outletStaff?.name || 'Staff'} • {outletStaff?.role?.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/distribusi/terima/scan"
            className="px-3 py-1.5 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm uppercase tracking-wider active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span>📷</span> Scan QR
          </Link>
        </div>
      </header>

      {/* Content container */}
      <div className="p-4 max-w-3xl mx-auto space-y-4">
        {data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-8 text-center shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
            <span className="text-3xl">📭</span>
            <p className="text-[#544437]/50 font-bold text-sm mt-2">Belum ada kiriman masuk</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((sj) => {
              const formattedDate = new Date(sj.created_at).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });

              return (
                <div
                  key={sj.id}
                  onClick={() => router.push(`/distribusi/terima/${sj.id}`)}
                  className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-4 flex justify-between items-center shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/45 hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  <div className="space-y-1.5 min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-[#701604]/60 bg-[#faf2e9] px-2 py-0.5 rounded border border-[#d9c2b2]/30">
                        Asal: {sj.outlets?.name || 'Gudang Pusat'}
                      </span>
                    </div>
                    <h4 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wide">
                      No. SJ: {sj.document_number || sj.id.substring(0, 8).toUpperCase()}
                    </h4>
                    <p className="text-[9px] text-[#544437]/60 font-semibold">
                      Tanggal Kirim: {formattedDate}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2.5 shrink-0 pl-2">
                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider border ${
                      (sj.status === 'dikirim' || sj.status === 'dikirim_lengkap')
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : sj.status === 'selesai'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-orange-50 text-orange-700 border-orange-200'
                    }`}>
                      {(sj.status === 'dikirim' || sj.status === 'dikirim_lengkap') && 'Dikirim'}
                      {sj.status === 'selesai' && 'Selesai'}
                      {sj.status === 'diterima_lengkap' && 'Diterima Lengkap'}
                      {sj.status === 'diterima_sebagian' && 'Diterima Sebagian'}
                    </span>
                    <span
                      className="inline-flex px-3 py-1.5 bg-[#701604] hover:bg-[#591002] active:bg-[#430b01] text-white font-bold text-[9px] uppercase tracking-wider rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      Verifikasi
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="terima" />
    </div>
  )
}
