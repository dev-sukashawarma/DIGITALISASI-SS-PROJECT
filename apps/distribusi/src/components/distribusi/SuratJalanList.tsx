'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSuratJalanList } from '@/hooks/useSuratJalanList'
import { generatePDFContent, downloadPDF } from '@/utils/generatePDF'
import { BottomNav } from './BottomNav'

type DateFilter = 'all' | 'today' | '7days' | '30days' | 'belum_verif' | 'telah_verif'

export function SuratJalanList() {
  const router = useRouter()
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const { data, loading, draftCount, sentCount, diterimaCount, selesaiCount } = useSuratJalanList(dateFilter)

  const handleDownloadPDF = async (sjId: string) => {
    const supabase = createClient()

    // Fetch full surat jalan detail with items
    const { data: sj } = await supabase
      .from('surat_jalan')
      .select('*')
      .eq('id', sjId)
      .single()

    if (!sj) {
      alert('Surat Jalan tidak ditemukan')
      return
    }

    // Fetch items
    const { data: items } = await supabase
      .from('surat_jalan_item')
      .select('*')
      .eq('surat_jalan_id', sjId)

    // Fetch bahan for each item
    const itemsWithBahan = await Promise.all(
      (items || []).map(async (item) => {
        const { data: bahan } = await supabase
          .from('bahan_baku')
          .select('nama, satuan')
          .eq('id', item.bahan_baku_id)
          .single()
        return { ...item, ...bahan }
      })
    )

    // Find outlet name from list data
    const outletData = data.find((d) => d.id === sjId)

    const htmlContent = await generatePDFContent({
      id: sj.id,
      document_number: sj.document_number || `SJ-${sj.id.substring(0, 8).toUpperCase()}`,
      outlet_name: outletData?.outlet?.name || 'Unknown',
      sender_outlet: 'Outlet Kitchen Bogor',
      status: sj.status,
      created_at: sj.created_at,
      verification_url: `${window.location.origin}/distribusi/terima/${sj.id}`,
      verification_code: sj.verification_code,
      items: itemsWithBahan,
      signatures: sj.signatures || [],
      receipt_signatures: sj.receipt_signatures || [],
    })

    downloadPDF(`Surat-Jalan-${sj.id.substring(0, 8)}.html`, htmlContent)
  }


  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-wider animate-pulse">Memuat daftar surat jalan...</p>
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
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Daftar Surat Jalan</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">Sistem Distribusi & Logistik</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/distribusi/surat-jalan/new"
            className="px-3 py-1.5 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm uppercase tracking-wider active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span>+</span> Buat SJ
          </Link>
        </div>
      </header>

      {/* Content container */}
      <div className="p-4 max-w-5xl mx-auto space-y-4">
        {/* Summary / Filter Bar */}
        <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {[
              { key: 'all', label: 'Semua' },
              { key: 'today', label: 'Hari Ini' },
              { key: '7days', label: '7 Hari' },
              { key: '30days', label: '1 Bulan' },
              { key: 'belum_verif', label: 'Belum Verif' },
              { key: 'telah_verif', label: 'Telah Diverif' }
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => setDateFilter(btn.key as DateFilter)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                  dateFilter === btn.key
                    ? 'bg-[#701604] border-[#701604] text-white shadow-sm'
                    : 'bg-white border-[#d9c2b2]/40 text-[#544437]/80 hover:bg-[#fff8f1]/50'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <div className="text-[9px] font-extrabold text-[#701604]/80 bg-[#faf2e9] border border-[#d9c2b2]/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5 uppercase tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#f29744] animate-pulse shrink-0" />
            <span>{draftCount} draft &bull; {sentCount} dikirim &bull; {diterimaCount} belum verif &bull; {selesaiCount} selesai</span>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-12 text-center shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
            <span className="text-3xl">📭</span>
            <p className="text-[#544437]/50 font-bold text-sm mt-2">Belum ada Surat Jalan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((sj) => (
              <div
                key={sj.id}
                onClick={() => router.push(`/distribusi/surat-jalan/${sj.id}`)}
                className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-4 flex flex-col justify-between shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/45 hover:shadow-md active:scale-[0.99] transition-all duration-200 cursor-pointer"
              >
                <div className="space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    {/* Header Info */}
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#701604]/70 bg-[#faf2e9] px-2 py-0.5 rounded border border-[#d9c2b2]/30">
                        SJ: {sj.document_number || sj.id.substring(0, 8).toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider border ${
                        sj.status === 'draft'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : sj.status === 'dikirim'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : sj.status === 'selesai'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {sj.status === 'draft' && 'Draft'}
                        {sj.status === 'dikirim' && 'Dikirim'}
                        {sj.status === 'selesai' && 'Selesai'}
                        {(sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian') && (
                          sj.has_problem ? 'Diterima Sebagian' : 'Diterima Lengkap'
                        )}
                      </span>
                    </div>

                    {/* Outlet Name */}
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-[#544437]/40 uppercase tracking-widest pl-0.5">Tujuan Outlet</p>
                      <h4 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wide leading-tight">
                        {sj.outlet?.name || 'Unknown Outlet'}
                      </h4>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-[#d9c2b2]/15 mt-3 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-[9px] text-[#544437]/60 font-bold uppercase pl-0.5">
                      <span>
                        {new Date(sj.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {sj.status !== 'draft' && sj.status !== 'dikirim' && (
                        sj.has_problem ? (
                          <span className="px-2 py-0.5 rounded-lg text-[8px] font-bold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 shrink-0">
                            <span>⚠️</span> Selisih
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg text-[8px] text-[#0a7d2c] font-bold uppercase flex items-center gap-1 bg-emerald-50 border border-emerald-250 shrink-0">
                            <span>✓</span> Aman
                          </span>
                        )
                      )}
                    </div>

                    {sj.status === 'draft' ? (
                      <span className="w-full text-center py-2 bg-[#701604] hover:bg-[#591002] active:bg-[#430b01] text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-xs transition-all active:scale-95 block mt-1">
                        Verifikasi & Kirim
                      </span>
                    ) : (sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian') ? (
                      <div className="mt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/distribusi/surat-jalan/${sj.id}`);
                          }}
                          className="w-full py-2 bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white font-bold text-[9px] uppercase tracking-wider rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                        >
                          🔍 Cek dan Verifikasi
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPDF(sj.id);
                          }}
                          className="w-full py-2 bg-[#701604] hover:bg-[#591002] active:bg-[#430b01] text-white font-bold text-[9px] uppercase tracking-wider rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                        >
                          📥 Download Surat Jalan
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="riwayat" />
    </div>
  )
}
