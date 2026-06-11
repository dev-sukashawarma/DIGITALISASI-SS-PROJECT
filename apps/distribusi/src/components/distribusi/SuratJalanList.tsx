'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSuratJalanList } from '@/hooks/useSuratJalanList'
import { generatePDFContent, generateQRDataUrl, downloadPDF, downloadBarcode } from '@/utils/generatePDF'

type DateFilter = 'all' | 'today' | '7days' | '30days'

export function SuratJalanList() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const { data, loading, draftCount, sentCount } = useSuratJalanList(dateFilter)

  const handleDownloadBarcode = async (sjId: string, docNumber: string) => {
    const url = `${window.location.origin}/distribusi/terima/${sjId}`
    const dataUrl = await generateQRDataUrl(url, 400)
    downloadBarcode(`Barcode-SJ-${docNumber}.png`, dataUrl)
  }

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
      items: itemsWithBahan,
      signatures: sj.signatures || [],
    })

    downloadPDF(`Surat-Jalan-${sj.id.substring(0, 8)}.html`, htmlContent)
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-sm">Memuat daftar surat jalan...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-[#701604] tracking-tight">Daftar Surat Jalan</h2>
            <p className="text-xs text-suka-brown/60 mt-0.5">Sistem Distribusi & Logistik</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/distribusi/surat-jalan/new"
            className="px-4 py-2 bg-suka-orange hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-1.5"
          >
            <span>+</span> Buat Surat Jalan
          </Link>
        </div>
      </header>

      {/* Content container */}
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Summary / Filter Bar */}
        <div className="bg-white rounded-xl border border-suka-brown/10 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'Semua' },
              { key: 'today', label: 'Hari Ini' },
              { key: '7days', label: '7 Hari' },
              { key: '30days', label: '1 Bulan' }
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => setDateFilter(btn.key as DateFilter)}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  dateFilter === btn.key
                    ? 'bg-suka-orange text-white border-2 border-suka-orange shadow-sm'
                    : 'bg-[#fff8f1] border border-suka-brown/10 text-suka-brown hover:bg-suka-cream'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <div className="text-sm font-semibold text-suka-brown/80 bg-[#fff7ed] border border-suka-brown/10 px-4 py-2 rounded-xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f29744] animate-pulse" />
            <span>{draftCount} draft · {sentCount} sedang dikirim</span>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="bg-white rounded-xl border border-suka-brown/10 p-12 text-center shadow-sm">
            <p className="text-suka-brown/50 font-medium text-lg">Belum ada Surat Jalan</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-suka-brown/10 overflow-hidden shadow-[0px_4px_12px_rgba(112,22,4,0.04)]">
            <table className="w-full text-left">
              <thead className="bg-[#faf2e9] border-b border-suka-brown/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Outlet</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Tanggal</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-suka-brown">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-brown/10">
                {data.map((sj) => (
                  <tr key={sj.id} className="hover:bg-suka-cream/10 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-suka-ink">
                      {sj.outlet?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                          sj.status === 'draft'
                            ? 'bg-yellow-50 text-yellow-850 border-yellow-250'
                            : sj.status === 'dikirim'
                              ? 'bg-blue-50 text-blue-800 border-blue-250'
                              : 'bg-green-50 text-green-800 border-green-250'
                        }`}
                      >
                        {sj.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-suka-brown/70 font-medium">
                      {new Date(sj.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {sj.status === 'draft' ? (
                        <Link
                          href={`/distribusi/surat-jalan/${sj.id}`}
                          className="inline-flex px-3 py-1.5 bg-[#701604] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                        >
                          Verifikasi
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleDownloadPDF(sj.id)}
                            className="text-suka-green hover:underline font-bold text-xs flex items-center gap-1"
                          >
                            📥 Download PDF
                          </button>
                          <button
                            onClick={() => handleDownloadBarcode(sj.id, sj.document_number || sj.id.substring(0, 8))}
                            className="text-suka-orange hover:underline font-bold text-xs flex items-center gap-1"
                          >
                            🏷️ QR Code
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
