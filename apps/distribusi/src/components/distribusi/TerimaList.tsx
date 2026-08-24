'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@suka/auth'
import { useTerimaList } from '@/hooks/useTerimaList'
import { useFormattedDate } from '@/hooks/useFormattedDate'
import { useDistribusiRealtime } from '@/hooks/useDistribusiRealtime'
import { BottomNav } from './BottomNav'
import { ArrowLeft, QrCode, Calendar, Truck, Store, Inbox, ChevronRight, CheckCircle2, Clock } from 'lucide-react'

function FormattedDate({ iso }: { iso: string | null | undefined }) {
  const text = useFormattedDate(iso, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return <>{text}</>
}

export function TerimaList() {
  const router = useRouter()
  const { outletStaff } = useAuth()
  const { data, loading } = useTerimaList()
  useDistribusiRealtime(outletStaff?.outlet_id)

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-suka-brown font-medium bg-grain relative">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-suka-brown mb-4" />
        <p className="text-xs font-black uppercase tracking-wider animate-pulse">Memuat Daftar Penerimaan...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-32 relative overflow-hidden bg-grain select-none">
      {/* Header */}
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
              Inbox Penerimaan Barang
            </h1>
            <p className="text-[9px] sm:text-[10px] text-suka-gray-500 font-bold mt-0.5 truncate">
              {outletStaff?.name || 'Staff'} • {outletStaff?.outlets?.name ?? 'Outlet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/distribusi/terima/scan"
            className="px-3 py-2 bg-suka-orange hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-extrabold text-xs transition-all shadow-sm uppercase tracking-wider active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode size={14} /> Scan QR
          </Link>
        </div>
      </header>

      {/* Content container */}
      <main className="p-4 max-w-4xl mx-auto space-y-4 relative z-10 mt-2">
        {data.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-suka-orange/15 p-12 text-center shadow-sm space-y-3">
            <div className="w-14 h-14 bg-suka-orange/10 text-suka-orange rounded-2xl flex items-center justify-center mx-auto">
              <Inbox size={28} />
            </div>
            <div className="space-y-1">
              <p className="text-suka-brown font-black text-sm uppercase tracking-wide">
                Belum Ada Kiriman Masuk
              </p>
              <p className="text-xs text-suka-gray-500 font-medium">
                Surat jalan yang dikirim dari Gudang Pusat akan otomatis muncul di sini.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((sj) => {
              const sudahSelesai = ['selesai', 'diterima_lengkap', 'diterima_sebagian'].includes(sj.status)
              return (
                <div
                  key={sj.id}
                  onClick={() => !sudahSelesai && router.push(`/distribusi/terima/${sj.id}`)}
                  className={`bg-white/85 backdrop-blur-md rounded-3xl border p-5 flex flex-col justify-between shadow-sm transition-all duration-200 ${
                    sudahSelesai
                      ? 'border-suka-brown/10 opacity-75 cursor-default'
                      : 'border-suka-orange/15 hover:border-suka-orange/40 hover:shadow-md active:scale-[0.99] cursor-pointer'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-suka-brown bg-suka-orange/10 px-2.5 py-1 rounded-lg">
                        SJ: {sj.document_number || sj.id.substring(0, 8).toUpperCase()}
                      </span>
                      <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${
                        (sj.status === 'dikirim' || sj.status === 'dikirim_lengkap')
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : sj.status === 'selesai'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {(sj.status === 'dikirim' || sj.status === 'dikirim_lengkap') && 'Dalam Transit'}
                        {sj.status === 'selesai' && 'Selesai'}
                        {sj.status === 'diterima_lengkap' && 'Diterima Lengkap'}
                        {sj.status === 'diterima_sebagian' && 'Diterima Sebagian'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest flex items-center gap-1">
                        <Truck size={11} className="text-suka-orange" /> Asal Pengiriman
                      </p>
                      <h4 className="font-black text-suka-ink text-xs uppercase tracking-wide">
                        {sj.outlets?.name || 'GUDANG PUSAT (HQ)'}
                      </h4>
                    </div>

                    <div className="text-[10px] text-suka-gray-500 font-semibold flex items-center gap-1.5 pt-1 border-t border-suka-brown/10">
                      <Calendar size={12} className="text-suka-orange" />
                      <span><FormattedDate iso={sj.created_at} /></span>
                    </div>
                  </div>

                  <div className="pt-4 mt-2">
                    {sudahSelesai ? (
                      <Link
                        href={`/distribusi/riwayat/${sj.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full py-2.5 bg-suka-brown/10 hover:bg-suka-brown/15 text-suka-brown font-extrabold text-xs uppercase tracking-wider rounded-xl border border-suka-brown/15 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        Lihat Riwayat Selesai <ChevronRight size={14} />
                      </Link>
                    ) : (
                      <button
                        onClick={() => router.push(`/distribusi/terima/${sj.id}`)}
                        className="w-full py-3 bg-suka-orange hover:bg-orange-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={15} /> Verifikasi Sekarang
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="terima" />
    </div>
  )
}
