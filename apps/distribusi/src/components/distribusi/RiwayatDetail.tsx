'use client'

import Link from 'next/link'
import { useSuratJalanDetail } from '@/hooks/useSuratJalanDetail'

function SignatureBlock({ title, sigs }: { title: string; sigs: any[] }) {
  return (
    <div className="bg-[#fff8f1]/50 border border-[#d9c2b2]/45 rounded-xl p-4 shadow-sm">
      <p className="text-[9px] font-bold text-[#544437]/50 uppercase tracking-wider mb-3 leading-none">{title} ({sigs.length})</p>
      {sigs.length === 0 ? (
        <p className="text-[10px] text-[#544437]/40 font-bold italic">Belum ada tanda tangan</p>
      ) : (
        <div className="space-y-3">
          {sigs.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              {s.signature_image && (
                <img src={s.signature_image} alt={s.role} className="h-10 w-auto bg-white border border-[#d9c2b2]/30 rounded p-1 object-contain shadow-xs" />
              )}
              <div>
                <p className="text-xs font-bold text-[#1e1b15] uppercase tracking-wide">{s.signed_by}</p>
                <p className="text-[10px] text-[#544437]/65 mt-0.5 font-semibold">
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
  const { data, loading, error } = useSuratJalanDetail(id)

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-wider animate-pulse">Memuat Detail...</p>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-4">
        <p className="p-4 text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl">
          Gagal memuat: {error}
        </p>
      </div>
    )
  }

  const hasProblem = data.surat_jalan_item?.some(
    (item) => item.kondisi === 'rusak' || (item.qty_terima != null && item.qty_terima < item.qty_dikirim)
  )

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      {/* Header Banner */}
      <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/distribusi/riwayat" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Riwayat">
            <span className="text-base">←</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Detail Penerimaan</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">Sistem Distribusi & Logistik</p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="p-4 max-w-3xl mx-auto space-y-4 mt-2">
        <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-5 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] space-y-5">
          <div className="flex justify-between items-center border-b border-[#d9c2b2]/20 pb-4">
            <div>
              <span className="text-[9px] font-black text-[#544437]/50 uppercase tracking-widest leading-none">NO. SURAT JALAN</span>
              <p className="text-xs font-mono font-bold text-gray-500 mt-1.5 leading-none truncate max-w-[150px] lg:max-w-xs">{data.document_number || id.substring(0, 8).toUpperCase()}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${
                data.status === 'selesai'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-orange-50 text-orange-700 border-orange-200'
              }`}>
                {data.status === 'selesai' ? 'Selesai' : (hasProblem ? 'Diterima Sebagian' : 'Diterima Lengkap')}
              </span>
              {data.status !== 'selesai' && (
                hasProblem ? (
                  <span className="px-2 py-1 rounded-lg text-[8px] font-bold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 shrink-0">
                    <span>⚠️</span> Selisih
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-lg text-[8px] text-[#0a7d2c] font-bold uppercase flex items-center gap-1 bg-emerald-50 border border-emerald-250 shrink-0">
                    <span>✓</span> Aman
                  </span>
                )
              )}
            </div>
          </div>

          <div>
            <h3 className="text-[9px] font-black text-[#544437]/50 uppercase tracking-widest pl-1 mb-3">Item Diterima</h3>
            <div className="space-y-2.5">
              {data.surat_jalan_item.map((item) => {
                const kurang = item.qty_terima != null && item.qty_terima < item.qty_dikirim
                const rusak = item.kondisi === 'rusak'
                return (
                  <div key={item.id} className="p-3 bg-[#fff8f1]/30 rounded-xl border border-[#d9c2b2]/30 flex justify-between items-center text-xs">
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <p className="font-bold text-[#1e1b15] uppercase tracking-wide truncate">{item.bahan_baku?.nama}</p>
                      <p className="text-[9px] text-[#544437]/60">
                        Dikirim: {item.qty_dikirim} {item.bahan_baku?.satuan}
                      </p>
                      {item.catatan && (
                        <p className="text-[9px] text-[#ba1a1a] font-semibold italic mt-0.5">* {item.catatan}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider border inline-block ${
                        rusak
                          ? 'bg-red-50 text-red-750 border-red-200 animate-pulse-subtle'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}>
                        {item.kondisi || 'baik'}
                      </span>
                      <p className={`font-black text-xs mt-1 ${kurang ? 'text-[#ba1a1a]' : 'text-[#0a7d2c]'}`}>
                        Terima: {item.qty_terima ?? '-'} {item.bahan_baku?.satuan}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#d9c2b2]/20 pt-4">
            <SignatureBlock title="TTD Pengirim" sigs={data.signatures || []} />
            <SignatureBlock title="TTD Penerima" sigs={data.receipt_signatures || []} />
          </div>
        </div>
      </div>
    </div>
  )
}
