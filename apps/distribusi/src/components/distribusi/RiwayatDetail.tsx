'use client'

import Link from 'next/link'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'
import { useAuth } from '@suka/auth'
import { ArrowLeft, AlertTriangle, Check, FileText } from 'lucide-react'

function SignatureBlock({ title, sigs }: { title: string; sigs: any[] }) {
  return (
    <div className="bg-white/80 border border-suka-orange/15 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-center border-b border-suka-brown/10 pb-2">
        <p className="text-[10px] font-black text-suka-brown uppercase tracking-wider leading-none">
          {title}
        </p>
        <span className="text-[9px] font-extrabold text-suka-orange bg-suka-orange/10 px-2 py-0.5 rounded-full">
          {sigs.length} TTD
        </span>
      </div>

      {sigs.length === 0 ? (
        <p className="text-[10px] text-suka-gray-400 font-bold italic py-2 text-center">
          Belum ada tanda tangan
        </p>
      ) : (
        <div className="space-y-2.5">
          {sigs.map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-[#fff8f1]/60 rounded-xl border border-suka-brown/5">
              {s.signature_image && (
                <img
                  src={s.signature_image}
                  alt={s.role}
                  className="h-10 w-16 bg-white border border-suka-brown/15 rounded-lg p-1 object-contain shrink-0 shadow-xs"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-suka-ink uppercase tracking-wide truncate">
                  {s.signed_by}
                </p>
                <p className="text-[10px] text-suka-gray-500 font-semibold mt-0.5 truncate">
                  {s.role} &bull; {new Date(s.signed_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RiwayatDetail({ id }: { id: string }) {
  const { outletStaff } = useAuth()
  const { data, loading, error } = useSuratJalanDetail(id)

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-suka-brown font-medium bg-grain relative">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-suka-brown mb-4" />
        <p className="text-xs font-black uppercase tracking-wider animate-pulse">Memuat Detail Dokumen...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-4 bg-grain">
        <div className="p-5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-2xl max-w-md text-center shadow-sm">
          <AlertTriangle size={24} className="mx-auto mb-2 text-red-500" />
          <p>Gagal memuat: {error || 'Data tidak ditemukan'}</p>
        </div>
      </div>
    )
  }

  const hasProblem = data.surat_jalan_item?.some(
    (item) => item.kondisi === 'rusak' || (item.qty_terima != null && item.qty_terima < item.qty_dikirim)
  )

  return (
    <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-24 relative overflow-hidden bg-grain select-none">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-suka-brown/10 px-3 sm:px-6 py-3 flex justify-between items-center shadow-sm relative">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/distribusi/riwayat"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white border border-suka-orange/15 text-suka-orange hover:bg-suka-orange/5 active:scale-95 transition-all shadow-sm shrink-0"
            title="Kembali ke Riwayat"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex flex-col min-w-0">
            <h1 className="font-black text-xs sm:text-sm text-suka-brown uppercase tracking-wider font-display leading-none truncate">
              Detail Penerimaan Riwayat
            </h1>
            <p className="text-[9px] sm:text-[10px] text-suka-gray-500 font-bold mt-0.5 truncate">
              {outletStaff?.name || 'Staff'} • {outletStaff?.outlets?.name ?? 'Outlet'}
            </p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 max-w-3xl mx-auto space-y-4 mt-2 relative z-10">
        <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-orange/15 p-5 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-suka-brown/10 pb-4">
            <div>
              <span className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest leading-none">
                NOMOR SURAT JALAN
              </span>
              <p className="text-base font-mono font-black text-suka-ink mt-0.5">
                {data.document_number || id.substring(0, 8).toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                data.status === 'selesai'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-orange-50 text-orange-700 border-orange-200'
              }`}>
                {data.status === 'selesai' ? 'Selesai & Diverifikasi' : (hasProblem ? 'Diterima Sebagian' : 'Diterima Lengkap')}
              </span>
              {data.status !== 'selesai' && (
                hasProblem ? (
                  <span className="px-2.5 py-1 rounded-xl text-[9px] font-black bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 shrink-0">
                    <AlertTriangle size={11} /> Ada Selisih
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-xl text-[9px] text-emerald-700 font-black uppercase flex items-center gap-1 bg-emerald-50 border border-emerald-200 shrink-0">
                    <Check size={11} /> Sesuai
                  </span>
                )
              )}
            </div>
          </div>

          <div>
            <h3 className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest pl-0.5 mb-3 flex items-center gap-1.5">
              <FileText size={13} className="text-suka-orange" /> Rincian Item Fisik Diterima
            </h3>
            <div className="space-y-2.5">
              {data.surat_jalan_item.map((item) => {
                const kurang = item.qty_terima != null && item.qty_terima < item.qty_dikirim
                const rusak = item.kondisi === 'rusak'
                return (
                  <div key={item.id} className="p-3.5 bg-[#fff8f1]/60 rounded-2xl border border-suka-orange/15 flex justify-between items-center text-xs">
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <p className="font-extrabold text-suka-ink uppercase tracking-wide truncate">
                        {item.bahan_baku?.nama}
                      </p>
                      <p className="text-[10px] text-suka-gray-500 font-semibold">
                        Dikirim: {item.qty_dikirim} {item.bahan_baku?.satuan}
                      </p>
                      {item.catatan && (
                        <p className="text-[10px] text-red-600 font-bold italic mt-0.5">* Catatan: {item.catatan}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border inline-block ${
                        rusak || kurang
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {item.kondisi === 'rusak' ? 'Rusak/Reject' : (kurang ? 'Kurang Kirim' : 'Sesuai')}
                      </span>
                      <p className={`font-black text-xs ${kurang ? 'text-red-600' : 'text-emerald-700'}`}>
                        Terima: {item.qty_terima ?? '-'} {item.bahan_baku?.satuan}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-suka-brown/10 pt-4">
            <SignatureBlock title="Tanda Tangan Pengirim (Pusat)" sigs={data.signatures || []} />
            <SignatureBlock title="Tanda Tangan Penerima (Outlet & Supir)" sigs={data.receipt_signatures || []} />
          </div>
        </div>
      </main>
    </div>
  )
}
