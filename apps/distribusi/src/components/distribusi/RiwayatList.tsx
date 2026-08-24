'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@suka/auth'
import { useRiwayatList } from '@/hooks/useRiwayatList'
import { useFormattedDate } from '@/hooks/useFormattedDate'
import { BottomNav } from './BottomNav'
import { ArrowLeft, History, Calendar, CheckCircle2, AlertTriangle, ChevronRight, Inbox } from 'lucide-react'

function FormattedDate({ iso }: { iso: string | null | undefined }) {
  const text = useFormattedDate(iso, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return <>{text}</>
}

export function RiwayatList() {
  const router = useRouter()
  const { outletStaff } = useAuth()
  const { data, loading } = useRiwayatList()

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-suka-brown font-medium bg-grain relative">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-suka-brown mb-4" />
        <p className="text-xs font-black uppercase tracking-wider animate-pulse">Memuat Riwayat Penerimaan...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-32 relative overflow-hidden bg-grain select-none">
      {/* Header Banner */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-suka-brown/10 px-3 sm:px-6 py-3 flex justify-between items-center shadow-sm relative">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white border border-suka-orange/15 text-suka-orange hover:bg-suka-orange/5 active:scale-95 transition-all shadow-sm shrink-0"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex flex-col min-w-0">
            <h1 className="font-black text-xs sm:text-sm text-suka-brown uppercase tracking-wider font-display leading-none truncate">
              Riwayat Penerimaan
            </h1>
            <p className="text-[9px] sm:text-[10px] text-suka-gray-500 font-bold mt-0.5 truncate">
              {outletStaff?.name || 'Staff'} • {outletStaff?.outlets?.name ?? 'Outlet'}
            </p>
          </div>
        </div>
        <Link
          href="/distribusi/terima"
          className="px-3 py-2 border border-suka-orange/20 text-suka-brown hover:bg-suka-orange/5 bg-white rounded-xl font-extrabold text-xs transition-all shadow-xs active:scale-95 cursor-pointer uppercase tracking-wider flex items-center gap-1.5"
        >
          <Inbox size={14} className="text-suka-orange" /> Inbox Kiriman
        </Link>
      </header>

      {/* Main Container */}
      <main className="p-4 max-w-4xl mx-auto space-y-4 relative z-10 mt-2">
        {data.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-suka-orange/15 p-12 text-center shadow-sm space-y-3">
            <div className="w-14 h-14 bg-suka-orange/10 text-suka-orange rounded-2xl flex items-center justify-center mx-auto">
              <History size={28} />
            </div>
            <div className="space-y-1">
              <p className="text-suka-brown font-black text-sm uppercase tracking-wide">
                Belum Ada Riwayat Selesai
              </p>
              <p className="text-xs text-suka-gray-500 font-medium">
                Penerimaan barang yang telah diverifikasi dan ditandatangani akan tercatat di sini.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((sj) => (
              <div
                key={sj.id}
                onClick={() => router.push(`/distribusi/surat-jalan/${sj.id}`)}
                className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-orange/15 p-5 flex flex-col justify-between shadow-sm hover:border-suka-orange/40 hover:shadow-md active:scale-[0.99] transition-all duration-200 cursor-pointer group"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-suka-brown bg-suka-orange/10 px-2.5 py-1 rounded-lg">
                      SJ: {sj.document_number || sj.id.substring(0, 8).toUpperCase()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${
                        sj.status === 'selesai'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {sj.status === 'selesai' ? 'Selesai' : (sj.has_problem ? 'Diterima Sebagian' : 'Diterima Lengkap')}
                      </span>
                      {sj.status !== 'selesai' && (
                        sj.has_problem ? (
                          <span className="px-2 py-0.5 rounded-lg text-[8px] font-black bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 shrink-0">
                            <AlertTriangle size={10} /> Selisih
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg text-[8px] text-emerald-700 font-black uppercase flex items-center gap-1 bg-emerald-50 border border-emerald-200 shrink-0">
                            <CheckCircle2 size={10} /> Aman
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest">
                      Asal Kiriman
                    </p>
                    <h4 className="font-black text-suka-ink text-xs uppercase tracking-wide group-hover:text-suka-orange transition-colors">
                      {sj.outlets?.name || 'Gudang Pusat (HQ)'}
                    </h4>
                  </div>

                  <div className="text-[10px] text-suka-gray-500 font-semibold flex items-center gap-1.5 pt-1 border-t border-suka-brown/10">
                    <Calendar size={12} className="text-suka-orange" />
                    <span><FormattedDate iso={sj.created_at} /></span>
                  </div>
                </div>

                <div className="pt-4 mt-2">
                  <span className="w-full py-2.5 bg-suka-brown/10 group-hover:bg-suka-orange group-hover:text-white text-suka-brown font-extrabold text-xs uppercase tracking-wider rounded-xl border border-suka-brown/15 transition-all flex items-center justify-center gap-1.5">
                    Lihat Dokumen & Tanda Tangan <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="riwayat" />
    </div>
  )
}
