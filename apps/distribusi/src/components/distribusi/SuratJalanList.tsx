// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient, useAuth } from '@suka/auth'
import { useSuratJalanList } from '@/hooks/useSuratJalanList'
import { useFormattedDate } from '@/hooks/useFormattedDate'
import { useDistribusiRealtime } from '@/hooks/useDistribusiRealtime'
import { BottomNav } from './BottomNav'
import { PrinterStatus } from './PrinterStatus'
import { ArrowLeft, Plus, Calendar, AlertCircle, FileDown, Eye, Check, QrCode, Printer } from 'lucide-react'
import { Skeleton } from '@suka/design-system'

function FormattedDate({ iso }: { iso: string | null | undefined }) {
  const text = useFormattedDate(iso, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return <>{text}</>
}

type DateFilter = 'all' | 'today' | '7days' | '30days' | 'belum_verif' | 'telah_verif'

export function SuratJalanList() {
  const router = useRouter()
  const { outletStaff } = useAuth()
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const { data, loading, draftCount, sentCount, diterimaCount, selesaiCount } = useSuratJalanList(dateFilter)
  useDistribusiRealtime()

  const handleDownloadBarcode = async (sjId: string, docNumber: string) => {
    const { generateQRDataUrl, downloadBarcode } = await import('@/utils/generatePDF')
    const url = `${window.location.origin}/distribusi/terima/${sjId}`
    const dataUrl = await generateQRDataUrl(url, 400)
    downloadBarcode(`Barcode-SJ-${docNumber}.png`, dataUrl)
  }

  const handlePrintBarcode = async (sjId: string, docNumber: string, tanggal: string, tujuanOutlet: string, verificationCode?: string) => {
    const { generateQRDataUrl, printBarcode } = await import('@/utils/generatePDF')
    const { fetchPrintLayout, DEFAULT_PRINT_LAYOUT } = await import('@/utils/printLayout')
    const url = `${window.location.origin}/distribusi/terima/${sjId}`
    const dataUrl = await generateQRDataUrl(url, 400)
    const layout = await fetchPrintLayout(createSupabaseBrowserClient()).catch(() => DEFAULT_PRINT_LAYOUT)
    
    // Check if bluetooth printer is connected
    const { usePrinterStore } = await import('@/utils/printer/printerStore')
    const store = usePrinterStore.getState()
    
    if (store.device && store.characteristic) {
      try {
        const { printQRViaBluetooth } = await import('@/utils/printer/bluetooth-printer')
        await printQRViaBluetooth(docNumber, dataUrl, layout.qr_surat_jalan, { tanggal, tujuanOutlet, verificationCode })
        return
      } catch (err: any) {
        alert('Gagal cetak via Bluetooth: ' + err.message)
      }
    }
    
    // Fallback to browser print if no bluetooth or bluetooth failed
    printBarcode(docNumber, dataUrl, layout.qr_surat_jalan, { tanggal, tujuanOutlet, verificationCode })
  }

  const handleDownloadPDF = async (sjId: string) => {
    const supabase = createSupabaseBrowserClient()

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

    // Fetch items with embedded relation
    const { data: items, error: itemsError } = await supabase
      .from('surat_jalan_item')
      .select('*, bahan_baku(id, nama, satuan)')
      .eq('surat_jalan_id', sjId)

    if (itemsError) throw itemsError

    // Map items with bahan details
    const itemsWithBahan = (items || []).map(item => ({
      ...item,
      nama: item.bahan_baku?.nama || 'Unknown',
      satuan: item.bahan_baku?.satuan || '',
    }))

    // Find outlet name from list data
    const outletData = data.find((d) => d.id === sjId)

    // Load the PDF module (incl. ~320KB embedded logo) only when a PDF is actually generated.
    const isPusat = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(outletStaff?.role || '')
    const hideQR = !isPusat

    const htmlContent = await generatePDFContent({
      id: sj.id,
      document_number: sj.document_number || `SJ-${sj.id.substring(0, 8).toUpperCase()}`,
      outlet_name: outletData?.outlet?.name || 'Unknown',
      sender_outlet: 'GUDANG PUSAT (HQ)',
      status: sj.status,
      created_at: sj.created_at,
      verification_url: `${window.location.origin}/distribusi/terima/${sj.id}`,
      verification_code: sj.verification_code,
      items: itemsWithBahan,
      signatures: sj.signatures || [],
      receipt_signatures: sj.receipt_signatures || [],
    }, { hideQR })

    downloadPDF(`Surat-Jalan-${sj.id.substring(0, 8)}.html`, htmlContent)
  }



  return (
    <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-32 relative overflow-hidden bg-grain select-none">
      {/* Drifting Background Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-suka-orange/5 blur-[120px] pointer-events-none z-0 animate-blob-1" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-suka-brown/5 blur-[120px] pointer-events-none z-0 animate-blob-2" />

      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-suka-brown/10 px-3 sm:px-4 py-3 flex justify-between items-center shadow-sm relative">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/dashboard" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white border border-suka-orange/15 text-suka-orange hover:bg-suka-orange/5 active:scale-95 transition-all shadow-sm shrink-0" title="Kembali ke Dashboard">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex flex-col min-w-0">
            <h1 className="font-black text-xs sm:text-sm text-suka-brown uppercase tracking-wider font-display leading-none truncate">Daftar Surat Jalan</h1>
            <p className="text-[9px] sm:text-[10px] text-suka-gray-500 font-bold mt-0.5">
              {outletStaff?.name || 'Staff'} • {outletStaff?.outlets?.name ?? (['leader', 'kitchen', 'admin', 'admin_hr'].includes(outletStaff?.role || '') ? 'Gudang Pusat' : 'Outlet')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {outletStaff?.role === 'kitchen' && <PrinterStatus />}
          {['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(outletStaff?.role || '') && (
            <Link
              href="/distribusi/surat-jalan/new"
              className="px-3 py-2 bg-suka-orange hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-suka-orange/20 uppercase tracking-widest active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> <span className="hidden sm:inline">Buat SJ</span>
            </Link>
          )}
        </div>
      </header>

      {/* Content container */}
      <div className="p-4 max-w-5xl mx-auto space-y-5 relative z-10">
        
        {/* Summary / Filter Bar */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-suka-orange/10 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
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
                className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                  dateFilter === btn.key
                    ? 'bg-suka-brown border-suka-brown text-white shadow-sm'
                    : 'bg-white border-suka-orange/10 text-suka-gray-600 hover:bg-suka-orange/5'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <div className="text-[9px] font-extrabold text-suka-brown bg-suka-orange/10 border border-suka-orange/20 px-3 py-2 rounded-lg flex items-center gap-1.5 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-suka-orange animate-pulse shrink-0" />
            <span>{draftCount} draft &bull; {sentCount} dikirim &bull; {diterimaCount} belum verif &bull; {selesaiCount} selesai</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white/70 backdrop-blur-md rounded-2xl border border-suka-orange/10 p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-4.5 w-20" />
                  <Skeleton className="h-4.5 w-16" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3.5 w-full" />
                </div>
                <Skeleton className="h-8 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-suka-orange/10 p-16 text-center shadow-sm">
            <span className="text-3xl block mb-2">📭</span>
            <p className="text-suka-gray-500 font-extrabold text-sm uppercase tracking-wider">Belum ada Surat Jalan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((sj) => (
              <div
                key={sj.id}
                onClick={() => router.push(`/distribusi/surat-jalan/${sj.id}`)}
                className="bg-white/70 backdrop-blur-md rounded-2xl border border-suka-orange/10 p-5 flex flex-col justify-between shadow-sm hover:border-suka-orange/45 hover:shadow-lg hover:-translate-y-1 active:scale-[0.99] transition-all duration-300 cursor-pointer group"
              >
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Header Info */}
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-suka-brown bg-suka-orange/10 px-2.5 py-0.5 rounded border border-suka-orange/5">
                        SJ: {sj.document_number || sj.id.substring(0, 8).toUpperCase()}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${
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
                      <p className="text-[8px] font-extrabold text-suka-gray-400 uppercase tracking-widest pl-0.5">Tujuan Outlet</p>
                      <h4 className="font-extrabold text-suka-ink text-xs uppercase tracking-wide leading-tight group-hover:text-suka-orange transition-colors duration-200">
                        {sj.outlet?.name || 'Unknown Outlet'}
                      </h4>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-4 border-t border-suka-orange/10 mt-2 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-[9px] text-suka-gray-500 font-bold uppercase pl-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-suka-orange" />
                        <FormattedDate iso={sj.created_at} />
                      </span>
                      {sj.status !== 'draft' && sj.status !== 'dikirim' && (
                        sj.has_problem ? (
                          <span className="px-2 py-0.5 rounded-lg text-[8px] font-black bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 shrink-0">
                            <AlertCircle size={10} /> Selisih
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg text-[8px] text-suka-green font-black uppercase flex items-center gap-1 bg-emerald-50 border border-emerald-250 shrink-0">
                            <Check size={10} /> Aman
                          </span>
                        )
                      )}
                    </div>

                    {sj.status === 'draft' ? (
                      <span className="w-full text-center py-2.5 bg-suka-brown hover:bg-suka-ink text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-95 block mt-2">
                        Verifikasi & Kirim
                      </span>
                    ) : (sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian') ? (
                      <div className="mt-1 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/distribusi/surat-jalan/${sj.id}`);
                          }}
                          className="flex-1 py-2.5 bg-suka-orange hover:bg-orange-600 active:bg-orange-700 text-white font-extrabold text-[9px] uppercase tracking-widest rounded-xl shadow-md shadow-suka-orange/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 group-hover:scale-[1.01]"
                        >
                          <Eye size={12} /> Detail Verifikasi
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPDF(sj.id);
                          }}
                          className="flex-1 py-2.5 bg-suka-brown hover:bg-suka-ink text-white font-extrabold text-[9px] uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 group-hover:scale-[1.01]"
                        >
                          <FileDown size={12} /> PDF
                        </button>
                        {outletStaff?.role === 'kitchen' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadBarcode(sj.id, sj.document_number || sj.id.substring(0, 8));
                              }}
                              className="flex-1 py-2.5 bg-white border border-suka-brown/20 text-suka-brown hover:bg-suka-brown/5 font-extrabold text-[9px] uppercase tracking-widest rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 group-hover:scale-[1.01]"
                            >
                              <QrCode size={12} /> QR
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const tanggalStr = new Date(sj.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                                handlePrintBarcode(sj.id, sj.document_number || sj.id.substring(0, 8), tanggalStr, sj.outlet?.name || 'Unknown', sj.verification_code);
                              }}
                              className="flex-1 py-2.5 bg-white border border-suka-brown/20 text-suka-brown hover:bg-suka-brown/5 font-extrabold text-[9px] uppercase tracking-widest rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 group-hover:scale-[1.01]"
                            >
                              <Printer size={12} /> Print
                            </button>
                          </>
                        )}
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

