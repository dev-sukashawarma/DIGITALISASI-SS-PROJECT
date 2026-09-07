'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient, useAuth } from '@suka/auth'
import { useSuratJalanList } from '@/hooks/useSuratJalanList'
import { useFormattedDate } from '@/hooks/useFormattedDate'
import { useDistribusiRealtime } from '@/hooks/useDistribusiRealtime'
import { BottomNav } from './BottomNav'
import { PrinterStatus } from './PrinterStatus'
import {
  ArrowLeft,
  Plus,
  Calendar,
  FileDown,
  Eye,
  Check,
  Printer,
  Search,
  X,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  Truck,
  Store,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Package,
  Layers,
  Ban
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@suka/design-system'
import { downloadSuratJalanExcel } from '@/utils/generateSuratJalanExcel'
import { toast } from 'sonner'

function FormattedDate({ iso, showTime }: { iso: string | null | undefined; showTime?: boolean }) {
  const dateText = useFormattedDate(iso, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  
  if (!iso) return <>-</>
  
  if (showTime) {
    const timeText = new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return <>{dateText} • {timeText}</>
  }

  return <>{dateText}</>
}

type DateFilter = 'all' | 'today' | '7days' | '30days' | 'belum_verif' | 'telah_verif'
type StatusTab = 'all' | 'draft' | 'dikirim' | 'belum_verif' | 'selisih' | 'selesai'
type SortOption = 'newest' | 'oldest' | 'outlet_asc' | 'status'
type ViewMode = 'grid' | 'table'

const ITEMS_PER_PAGE = 12

export function SuratJalanList() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { outletStaff } = useAuth()
  
  // States
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Cancel Modal State
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; id: string; docNum: string } | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Realtime sync & Data query
  useDistribusiRealtime()
  const { data = [], loading, draftCount, sentCount, diterimaCount, selesaiCount } = useSuratJalanList(dateFilter)

  const isPusat = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(outletStaff?.role || '')
  const canCancelPO = ['kitchen', 'purchasing', 'admin', 'owner'].includes(outletStaff?.role || '')

  // Discrepancy & Selisih count
  const problemCount = useMemo(() => {
    return data.filter((sj) => sj.has_problem).length
  }, [data])

  // Extract unique outlet list for dropdown filter
  const outletOptions = useMemo(() => {
    const set = new Set<string>()
    data.forEach((sj) => {
      if (sj.outlet?.name) set.add(sj.outlet.name)
    })
    return Array.from(set).sort()
  }, [data])

  // Filter & Sort Pipeline
  const filteredData = useMemo(() => {
    let result = [...data]

    // Status Tab Filter
    if (statusTab === 'draft') {
      result = result.filter((sj) => sj.status === 'draft')
    } else if (statusTab === 'dikirim') {
      result = result.filter((sj) => sj.status === 'dikirim' || sj.status === 'dikirim_lengkap')
    } else if (statusTab === 'belum_verif') {
      result = result.filter((sj) => sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian')
    } else if (statusTab === 'selisih') {
      result = result.filter((sj) => sj.has_problem)
    } else if (statusTab === 'selesai') {
      result = result.filter((sj) => sj.status === 'selesai')
    }

    // Outlet Filter
    if (selectedOutlet !== 'all') {
      result = result.filter((sj) => sj.outlet?.name === selectedOutlet)
    }

    // Search Query (Document number or Outlet Name)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((sj) => {
        const docNum = (sj.document_number || sj.id || '').toLowerCase()
        const outName = (sj.outlet?.name || '').toLowerCase()
        return docNum.includes(q) || outName.includes(q)
      })
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      if (sortBy === 'outlet_asc') {
        const nameA = a.outlet?.name || ''
        const nameB = b.outlet?.name || ''
        return nameA.localeCompare(nameB)
      }
      if (sortBy === 'status') {
        return a.status.localeCompare(b.status)
      }
      return 0
    })

    return result
  }, [data, statusTab, selectedOutlet, searchQuery, sortBy])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE))
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredData.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredData, currentPage])

  // Reset page when filter changes
  const handleTabChange = (tab: StatusTab) => {
    setStatusTab(tab)
    setCurrentPage(1)
  }

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setCurrentPage(1)
  }

  const handleCopyDocNumber = (e: React.MouseEvent, docNum: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(docNum)
    setCopiedId(docNum)
    toast.success(`No. SJ ${docNum} disalin ke clipboard!`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // QR Code & Barcode Handlers
  const handlePrintBarcode = async (
    e: React.MouseEvent,
    sjId: string,
    docNumber: string,
    tanggal: string,
    tujuanOutlet: string,
    verificationCode?: string
  ) => {
    e.stopPropagation()
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
        toast.success('Berhasil mencetak via Bluetooth!')
        return
      } catch (err: any) {
        toast.error(`Gagal cetak via Bluetooth: ${err?.message || 'Error'}`)
      }
    }

    // Fallback to browser print
    printBarcode(docNumber, dataUrl, layout.qr_surat_jalan, { tanggal, tujuanOutlet, verificationCode })
  }

  // PDF Handlers (Default 3-Ply 14x12 cm format)
  const handleDownloadPDF = async (e: React.MouseEvent, sjId: string, docNumber?: string) => {
    e.stopPropagation()
    try {
      toast.info('Menyiapkan file PDF Surat Jalan 3-Ply (14 x 12 cm)...')
      const { generateSuratJalanPDF, downloadPDF } = await import('@/utils/generatePDF')
      const supabase = createSupabaseBrowserClient()

      const { data: sj } = await supabase.from('surat_jalan').select('*').eq('id', sjId).single()
      if (!sj) {
        toast.error('Surat Jalan tidak ditemukan')
        return
      }

      const { data: items, error: itemsError } = await supabase
        .from('surat_jalan_item')
        .select('*, bahan_baku(id, nama, satuan)')
        .eq('surat_jalan_id', sjId)

      if (itemsError) throw itemsError

      const itemsWithBahan = (items || []).map((item) => ({
        ...item,
        nama: item.bahan_baku?.nama || 'Unknown',
        satuan: item.bahan_baku?.satuan || '',
      }))

      const outletData = data.find((d) => d.id === sjId)
      const hideQR = !isPusat

      const pdfBlob = await generateSuratJalanPDF(
        {
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
        },
        { hideQR, copies: 3 }
      )

      downloadPDF(`Surat-Jalan-3Ply-${docNumber || sj.id.substring(0, 8)}.pdf`, pdfBlob)
      toast.success('PDF 3-Ply (14x12 cm) berhasil diunduh!')
    } catch {
      toast.error('Gagal membuat file PDF')
    }
  }

  // Excel Handlers
  const handleDownloadExcel = async (e: React.MouseEvent, sjId: string) => {
    e.stopPropagation()
    try {
      toast.info('Membuat file Excel Surat Jalan...')
      const supabase = createSupabaseBrowserClient()
      const { data: sj, error: suratJalanError } = await supabase
        .from('surat_jalan')
        .select('id, document_number, created_at, verification_code')
        .eq('id', sjId)
        .single()

      if (suratJalanError) throw suratJalanError
      if (!sj) {
        toast.error('Surat Jalan tidak ditemukan')
        return
      }

      const { data: items, error: itemsError } = await supabase
        .from('surat_jalan_item')
        .select('qty_dikirim, bahan_baku(nama, satuan, satuan_distribusi, satuan_tengah, satuan_kecil, faktor_tengah, faktor_tampilan)')
        .eq('surat_jalan_id', sjId)

      if (itemsError) throw itemsError
      const outletData = data.find((entry) => entry.id === sjId)
      await downloadSuratJalanExcel({
        documentNumber: sj.document_number || `SJ-${sj.id.substring(0, 8).toUpperCase()}`,
        outletName: outletData?.outlet?.name || 'Unknown',
        createdAt: sj.created_at,
        verificationCode: sj.verification_code,
        items: items || [],
      })
      toast.success('Excel berhasil diunduh!')
    } catch {
      toast.error('Gagal membuat file Excel')
    }
  }

  const handleCancelPO = async () => {
    if (!cancelModal) return
    setCancelling(true)
    const supabase = createSupabaseBrowserClient()
    try {
      const { data: res, error } = await supabase.rpc('batalkan_surat_jalan_draft', {
        p_surat_jalan_id: cancelModal.id,
        p_alasan: cancelReason.trim() || null,
      })
      if (error) throw error
      if (res && !res.success) {
        throw new Error(res.message || 'Gagal membatalkan PO')
      }
      toast.success(res?.message || 'PO draft berhasil dibatalkan')
      setCancelModal(null)
      setCancelReason('')
      queryClient.invalidateQueries({ queryKey: ['surat_jalan'] })
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membatalkan PO')
    } finally {
      setCancelling(false)
    }
  }

  // Helper status badges
  const getStatusBadge = (status: string, hasProblem?: boolean) => {
    if (status === 'draft') {
      return {
        label: 'Draft Siap Kirim',
        bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        dot: 'bg-amber-500',
      }
    }
    if (status === 'dibatalkan') {
      return {
        label: 'Dibatalkan',
        bg: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
        dot: 'bg-rose-500',
      }
    }
    if (status === 'dikirim' || status === 'dikirim_lengkap') {
      return {
        label: 'Dalam Transit',
        bg: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        dot: 'bg-blue-500 animate-pulse',
      }
    }
    if (status === 'diterima_lengkap' || status === 'diterima_sebagian') {
      return {
        label: hasProblem ? 'Diterima (Selisih)' : 'Tiba di Outlet',
        bg: hasProblem
          ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
          : 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        dot: hasProblem ? 'bg-orange-500' : 'bg-purple-500',
      }
    }
    if (status === 'selesai') {
      return {
        label: 'Selesai & Valid',
        bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        dot: 'bg-emerald-500',
      }
    }
    return {
      label: status,
      bg: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      dot: 'bg-gray-400',
    }
  }

  return (
    <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-32 relative overflow-hidden bg-grain select-none">
      {/* Ambient background glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-suka-orange/5 blur-[140px] pointer-events-none z-0 animate-blob-1" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-suka-brown/5 blur-[140px] pointer-events-none z-0 animate-blob-2" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-8 py-3.5 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-white border border-suka-orange/15 text-suka-orange hover:bg-suka-orange/5 active:scale-95 transition-all shadow-xs shrink-0"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm sm:text-base text-suka-brown uppercase tracking-wider font-display leading-none truncate">
                Daftar Dokumen Surat Jalan
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                3-Ply Ready
              </span>
            </div>
            <p className="text-[10px] text-suka-gray-500 font-bold mt-0.5 truncate">
              {outletStaff?.name || 'Staff'} &bull;{' '}
              {outletStaff?.outlets?.name ?? (isPusat ? 'Gudang Pusat (HQ Logistics)' : 'Outlet Mitra')}
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2">
          {outletStaff?.role === 'kitchen' && <PrinterStatus />}
          {isPusat && (
            <Link
              href="/distribusi/surat-jalan/new"
              className="px-3.5 sm:px-4 py-2 bg-gradient-to-r from-suka-orange to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-suka-orange/20 uppercase tracking-wider active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} /> <span>Buat Surat Jalan</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 relative z-10">

        {/* 1. Interactive Executive KPI HUD Counter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card: Total */}
          <button
            onClick={() => handleTabChange('all')}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer active:scale-98 flex flex-col justify-between backdrop-blur-md ${
              statusTab === 'all'
                ? 'bg-suka-brown text-white border-suka-brown shadow-lg shadow-suka-brown/20 ring-2 ring-suka-brown/30'
                : 'bg-white/80 border-suka-brown/10 text-suka-ink hover:bg-white hover:border-suka-brown/30 shadow-xs'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`text-[10px] font-black uppercase tracking-wider ${statusTab === 'all' ? 'text-white/80' : 'text-suka-gray-500'}`}>
                Semua Dokumen
              </span>
              <Layers size={15} className={statusTab === 'all' ? 'text-suka-orange' : 'text-suka-brown/40'} />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black font-display">{data.length}</p>
              <p className={`text-[9px] font-bold mt-0.5 ${statusTab === 'all' ? 'text-white/70' : 'text-suka-gray-400'}`}>
                Total Surat Jalan
              </p>
            </div>
          </button>

          {/* Card: Draft */}
          <button
            onClick={() => handleTabChange('draft')}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer active:scale-98 flex flex-col justify-between backdrop-blur-md ${
              statusTab === 'draft'
                ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/30'
                : 'bg-white/80 border-amber-500/20 text-suka-ink hover:bg-amber-50/50 shadow-xs'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`text-[10px] font-black uppercase tracking-wider ${statusTab === 'draft' ? 'text-white/90' : 'text-amber-700'}`}>
                Draft
              </span>
              <Clock size={15} className={statusTab === 'draft' ? 'text-white' : 'text-amber-500'} />
            </div>
            <div className="mt-2">
              <p className={`text-2xl font-black font-display ${statusTab === 'draft' ? 'text-white' : 'text-amber-700'}`}>{draftCount}</p>
              <p className={`text-[9px] font-bold mt-0.5 ${statusTab === 'draft' ? 'text-white/80' : 'text-amber-600/70'}`}>
                Siap Verifikasi Kirim
              </p>
            </div>
          </button>

          {/* Card: Dalam Transit */}
          <button
            onClick={() => handleTabChange('dikirim')}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer active:scale-98 flex flex-col justify-between backdrop-blur-md ${
              statusTab === 'dikirim'
                ? 'bg-blue-600 text-white border-blue-700 shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/30'
                : 'bg-white/80 border-blue-500/20 text-suka-ink hover:bg-blue-50/50 shadow-xs'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`text-[10px] font-black uppercase tracking-wider ${statusTab === 'dikirim' ? 'text-white/90' : 'text-blue-700'}`}>
                Transit
              </span>
              <Truck size={15} className={statusTab === 'dikirim' ? 'text-white' : 'text-blue-500'} />
            </div>
            <div className="mt-2">
              <p className={`text-2xl font-black font-display ${statusTab === 'dikirim' ? 'text-white' : 'text-blue-700'}`}>{sentCount}</p>
              <p className={`text-[9px] font-bold mt-0.5 ${statusTab === 'dikirim' ? 'text-white/80' : 'text-blue-600/70'}`}>
                Dalam Perjalanan Kurir
              </p>
            </div>
          </button>

          {/* Card: Belum Verif / Tiba di Outlet */}
          <button
            onClick={() => handleTabChange('belum_verif')}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer active:scale-98 flex flex-col justify-between backdrop-blur-md ${
              statusTab === 'belum_verif'
                ? 'bg-purple-600 text-white border-purple-700 shadow-lg shadow-purple-500/20 ring-2 ring-purple-500/30'
                : 'bg-white/80 border-purple-500/20 text-suka-ink hover:bg-purple-50/50 shadow-xs'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`text-[10px] font-black uppercase tracking-wider ${statusTab === 'belum_verif' ? 'text-white/90' : 'text-purple-700'}`}>
                Perlu Verif
              </span>
              <Store size={15} className={statusTab === 'belum_verif' ? 'text-white' : 'text-purple-500'} />
            </div>
            <div className="mt-2">
              <p className={`text-2xl font-black font-display ${statusTab === 'belum_verif' ? 'text-white' : 'text-purple-700'}`}>{diterimaCount}</p>
              <p className={`text-[9px] font-bold mt-0.5 ${statusTab === 'belum_verif' ? 'text-white/80' : 'text-purple-600/70'}`}>
                Tiba / Pengecekan Fisik
              </p>
            </div>
          </button>

          {/* Card: Selesai Valid */}
          <button
            onClick={() => handleTabChange('selesai')}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer active:scale-98 flex flex-col justify-between backdrop-blur-md col-span-2 sm:col-span-1 ${
              statusTab === 'selesai'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30'
                : 'bg-white/80 border-emerald-500/20 text-suka-ink hover:bg-emerald-50/50 shadow-xs'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`text-[10px] font-black uppercase tracking-wider ${statusTab === 'selesai' ? 'text-white/90' : 'text-emerald-700'}`}>
                Selesai
              </span>
              <ShieldCheck size={15} className={statusTab === 'selesai' ? 'text-white' : 'text-emerald-500'} />
            </div>
            <div className="mt-2">
              <p className={`text-2xl font-black font-display ${statusTab === 'selesai' ? 'text-white' : 'text-emerald-700'}`}>{selesaiCount}</p>
              <p className={`text-[9px] font-bold mt-0.5 ${statusTab === 'selesai' ? 'text-white/80' : 'text-emerald-600/70'}`}>
                100% Sah & Terarsip
              </p>
            </div>
          </button>
        </div>

        {/* 2. Control Bar (Date Filter, Search, Outlet Select, View Mode Switcher) */}
        <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-brown/10 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            
            {/* Search Box */}
            <div className="relative flex-1 min-w-[280px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Cari nomor Surat Jalan (SJ-...) atau nama outlet..."
                className="w-full pl-10 pr-9 py-2.5 bg-[#fff8f1]/60 border border-suka-brown/15 rounded-2xl text-xs font-semibold text-suka-ink placeholder:text-suka-gray-400 focus:outline-hidden focus:ring-2 focus:ring-suka-orange/30 focus:border-suka-orange transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-suka-gray-400 hover:text-suka-brown cursor-pointer p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Controls Group */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Date Filter Pills */}
              <div className="flex bg-[#fff8f1] p-1 rounded-2xl border border-suka-brown/10 overflow-x-auto no-scrollbar">
                {[
                  { key: 'all', label: 'Semua Waktu' },
                  { key: 'today', label: 'Hari Ini' },
                  { key: '7days', label: '7 Hari' },
                  { key: '30days', label: '30 Hari' },
                ].map((btn) => (
                  <button
                    key={btn.key}
                    onClick={() => setDateFilter(btn.key as DateFilter)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      dateFilter === btn.key
                        ? 'bg-suka-brown text-white shadow-xs'
                        : 'text-suka-gray-600 hover:text-suka-brown hover:bg-white/50'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Outlet Filter Dropdown */}
              {outletOptions.length > 0 && (
                <select
                  value={selectedOutlet}
                  onChange={(e) => {
                    setSelectedOutlet(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 bg-[#fff8f1] border border-suka-brown/15 rounded-2xl text-xs font-bold text-suka-brown focus:outline-hidden focus:ring-2 focus:ring-suka-orange/30 cursor-pointer"
                >
                  <option value="all">Semua Outlet ({outletOptions.length})</option>
                  {outletOptions.map((out) => (
                    <option key={out} value={out}>
                      {out}
                    </option>
                  ))}
                </select>
              )}

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 bg-[#fff8f1] border border-suka-brown/15 rounded-2xl text-xs font-bold text-suka-brown focus:outline-hidden focus:ring-2 focus:ring-suka-orange/30 cursor-pointer"
              >
                <option value="newest">Terbaru</option>
                <option value="oldest">Terlama</option>
                <option value="outlet_asc">Outlet (A-Z)</option>
                <option value="status">Status</option>
              </select>

              {/* View Switcher */}
              <div className="flex bg-[#fff8f1] p-1 rounded-2xl border border-suka-brown/10">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                    viewMode === 'grid' ? 'bg-suka-brown text-white shadow-xs' : 'text-suka-gray-500 hover:text-suka-brown'
                  }`}
                  title="Tampilan Grid Kartu"
                >
                  <Grid3X3 size={15} />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                    viewMode === 'table' ? 'bg-suka-brown text-white shadow-xs' : 'text-suka-gray-500 hover:text-suka-brown'
                  }`}
                  title="Tampilan Tabel Rapat"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Status Filter Tabs Pill Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-suka-brown/10">
            {[
              { key: 'all', label: 'Semua', count: data.length },
              { key: 'draft', label: 'Draft', count: draftCount },
              { key: 'dikirim', label: 'Dalam Transit', count: sentCount },
              { key: 'belum_verif', label: 'Perlu Verif', count: diterimaCount },
              { key: 'selisih', label: 'Ada Selisih', count: problemCount, alert: problemCount > 0 },
              { key: 'selesai', label: 'Selesai', count: selesaiCount },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key as StatusTab)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  statusTab === tab.key
                    ? 'bg-suka-orange text-white border-suka-orange shadow-xs scale-102'
                    : 'bg-white/80 border-suka-brown/10 text-suka-gray-600 hover:bg-suka-orange/5 hover:text-suka-brown'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                    statusTab === tab.key
                      ? 'bg-white/20 text-white'
                      : tab.alert
                        ? 'bg-red-100 text-red-700'
                        : 'bg-suka-brown/10 text-suka-brown'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Document Content Display (Grid or Table) */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white/70 backdrop-blur-md rounded-3xl border border-suka-brown/10 p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-5 w-28 rounded-lg" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-6 w-3/4 rounded-lg" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
                <Skeleton className="h-10 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-suka-brown/10 p-16 text-center shadow-sm space-y-3">
            <div className="w-16 h-16 bg-suka-orange/10 text-suka-orange rounded-full flex items-center justify-center mx-auto text-2xl">
              📦
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-suka-brown uppercase tracking-wider font-display">
                Tidak Ada Dokumen Surat Jalan
              </h3>
              <p className="text-xs text-suka-gray-500 font-medium max-w-md mx-auto">
                {searchQuery || selectedOutlet !== 'all' || statusTab !== 'all'
                  ? 'Tidak ditemukan dokumen yang sesuai dengan kriteria filter pencarian Anda.'
                  : 'Belum ada data Surat Jalan yang tercatat dalam sistem.'}
              </p>
            </div>
            {(searchQuery || selectedOutlet !== 'all' || statusTab !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedOutlet('all')
                  setStatusTab('all')
                  setDateFilter('all')
                }}
                className="mt-2 px-4 py-2 bg-suka-brown text-white text-xs font-bold uppercase rounded-xl hover:bg-suka-ink transition-all cursor-pointer"
              >
                Reset Semua Filter
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedData.map((sj) => {
              const badge = getStatusBadge(sj.status, sj.has_problem)
              const docNum = sj.document_number || `SJ-${sj.id.substring(0, 8).toUpperCase()}`
              const isDraft = sj.status === 'draft'
              const itemCount = sj.surat_jalan_item?.length || 0

              return (
                <div
                  key={sj.id}
                  onClick={() => router.push(`/distribusi/surat-jalan/${sj.id}`)}
                  className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-brown/10 p-5 flex flex-col justify-between shadow-xs hover:border-suka-orange/40 hover:shadow-xl hover:-translate-y-1 active:scale-[0.99] transition-all duration-300 cursor-pointer group relative overflow-hidden"
                >
                  {/* Top Bar inside Card */}
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-start gap-2">
                      {/* Document Number with 1-click Copy */}
                      <button
                        onClick={(e) => handleCopyDocNumber(e, docNum)}
                        className="flex items-center gap-1.5 text-[10px] font-black font-mono uppercase tracking-wider text-suka-brown bg-[#fff8f1] px-2.5 py-1 rounded-xl border border-suka-brown/10 hover:bg-suka-orange/10 hover:text-suka-orange transition-colors cursor-pointer"
                        title="Klik untuk salin No. SJ"
                      >
                        <span>{docNum}</span>
                        {copiedId === docNum ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} className="text-suka-gray-400" />}
                      </button>

                      {/* Status Badge */}
                      <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${badge.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                    </div>

                    {/* Route Info */}
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-suka-gray-400 uppercase tracking-widest pl-0.5 flex items-center gap-1">
                        <Store size={12} className="text-suka-orange" /> Tujuan Outlet
                      </p>
                      <h3 className="font-extrabold text-suka-ink text-sm uppercase tracking-wide leading-tight group-hover:text-suka-orange transition-colors">
                        {sj.outlet?.name || 'Unknown Outlet'}
                      </h3>
                    </div>

                    {/* Meta summary chips */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[10px] text-suka-gray-600 font-bold bg-[#fff8f1] px-2.5 py-1 rounded-lg border border-suka-brown/5 flex items-center gap-1">
                        <Calendar size={11} className="text-suka-orange" />
                        <FormattedDate iso={sj.created_at} />
                      </span>
                      {itemCount > 0 && (
                        <span className="text-[10px] text-suka-gray-600 font-bold bg-[#fff8f1] px-2.5 py-1 rounded-lg border border-suka-brown/5 flex items-center gap-1">
                          <Package size={11} className="text-suka-orange" />
                          {itemCount} Bahan
                        </span>
                      )}
                      {sj.has_problem ? (
                        <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200 flex items-center gap-1">
                          <AlertTriangle size={11} /> Ada Selisih
                        </span>
                      ) : (
                        sj.status !== 'draft' && sj.status !== 'dibatalkan' && (
                          <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                            <Check size={11} /> Aman
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Suite */}
                  <div className="pt-4 border-t border-suka-brown/10 mt-4 space-y-2">
                    {isDraft ? (
                      <div className="flex items-center gap-2">
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/distribusi/surat-jalan/${sj.id}`)
                          }}
                          className="flex-1 text-center py-2.5 bg-gradient-to-r from-suka-brown to-[#4d1003] hover:from-[#4d1003] hover:to-black text-white font-black text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 cursor-pointer block"
                        >
                          📝 Verifikasi & Kirim
                        </span>
                        {canCancelPO && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCancelModal({ isOpen: true, id: sj.id, docNum })
                            }}
                            className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 shrink-0"
                            title="Batalkan PO Draft"
                          >
                            <Ban size={12} /> Batal PO
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5">
                        {/* Detail */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/distribusi/surat-jalan/${sj.id}`)
                          }}
                          className="py-2 bg-suka-orange hover:bg-orange-600 text-white rounded-xl font-bold text-[9px] uppercase tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                          title="Lihat Detail Surat Jalan"
                        >
                          <Eye size={12} /> Detail
                        </button>

                        {/* PDF 3-Ply */}
                        <button
                          onClick={(e) => handleDownloadPDF(e, sj.id, docNum)}
                          className="py-2 bg-suka-brown hover:bg-suka-ink text-white rounded-xl font-bold text-[9px] uppercase tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                          title="Unduh PDF 3-Ply (14x12 cm)"
                        >
                          <FileDown size={12} /> 3-Ply
                        </button>

                        {/* Excel */}
                        <button
                          onClick={(e) => handleDownloadExcel(e, sj.id)}
                          className="py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-[9px] uppercase tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                          title="Unduh Spreadsheet Excel"
                        >
                          <FileDown size={12} /> XLS
                        </button>

                        {/* QR / Thermal Print */}
                        <button
                          onClick={(e) => {
                            const tgl = new Date(sj.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                            handlePrintBarcode(e, sj.id, docNum, tgl, sj.outlet?.name || 'Unknown', (sj as any).verification_code)
                          }}
                          className="py-2 bg-white border border-suka-brown/20 text-suka-brown hover:bg-suka-brown/5 rounded-xl font-bold text-[9px] uppercase tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                          title="Cetak Struk QR / Thermal"
                        >
                          <Printer size={12} /> QR
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Table View (Dense High-Density Layout) */
          <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#fff8f1] border-b border-suka-brown/10 text-[10px] font-black uppercase text-suka-brown tracking-wider">
                    <th className="py-3.5 px-4">No. Surat Jalan</th>
                    <th className="py-3.5 px-4">Tujuan Outlet</th>
                    <th className="py-3.5 px-4">Tanggal & Jam</th>
                    <th className="py-3.5 px-4 text-center">Item</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-suka-brown/5">
                  {paginatedData.map((sj) => {
                    const badge = getStatusBadge(sj.status, sj.has_problem)
                    const docNum = sj.document_number || `SJ-${sj.id.substring(0, 8).toUpperCase()}`
                    const itemCount = sj.surat_jalan_item?.length || 0

                    return (
                      <tr
                        key={sj.id}
                        onClick={() => router.push(`/distribusi/surat-jalan/${sj.id}`)}
                        className="hover:bg-suka-orange/5 transition-colors cursor-pointer group"
                      >
                        {/* No. SJ */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-black text-suka-ink group-hover:text-suka-orange transition-colors">
                            {docNum}
                          </span>
                        </td>

                        {/* Outlet */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <Store size={14} className="text-suka-orange shrink-0" />
                            <span className="font-extrabold text-suka-brown uppercase truncate max-w-[200px]">
                              {sj.outlet?.name || 'Unknown Outlet'}
                            </span>
                          </div>
                        </td>

                        {/* Tanggal */}
                        <td className="py-3.5 px-4 text-suka-gray-600 font-medium text-[11px]">
                          <FormattedDate iso={sj.created_at} showTime />
                        </td>

                        {/* Items */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-[10px] font-black bg-[#fff8f1] border border-suka-brown/10 px-2 py-0.5 rounded-lg text-suka-brown">
                            {itemCount} item
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${badge.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {badge.label}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => router.push(`/distribusi/surat-jalan/${sj.id}`)}
                              className="px-2.5 py-1.5 bg-suka-orange hover:bg-orange-600 text-white rounded-xl font-bold text-[9px] uppercase tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                              title="Lihat Detail"
                            >
                              <Eye size={12} /> Detail
                            </button>
                            {sj.status === 'draft' && canCancelPO && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCancelModal({ isOpen: true, id: sj.id, docNum })
                                }}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-[9px] uppercase tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                                title="Batalkan PO Draft"
                              >
                                <Ban size={12} /> Batal PO
                              </button>
                            )}
                            {sj.status !== 'draft' && sj.status !== 'dibatalkan' && (
                              <>
                                <button
                                  onClick={(e) => handleDownloadPDF(e, sj.id, docNum)}
                                  className="px-2.5 py-1.5 bg-suka-brown hover:bg-suka-ink text-white rounded-xl font-bold text-[9px] uppercase tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                                  title="Unduh PDF 3-Ply (14x12 cm)"
                                >
                                  <FileDown size={12} /> PDF
                                </button>
                                <button
                                  onClick={(e) => handleDownloadExcel(e, sj.id)}
                                  className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-[9px] uppercase tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                                  title="Unduh Excel"
                                >
                                  <FileDown size={12} /> XLS
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Pagination Controls */}
        {filteredData.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/80 backdrop-blur-md rounded-2xl border border-suka-brown/10 px-5 py-3.5 shadow-xs">
            <p className="text-xs text-suka-gray-500 font-bold">
              Menampilkan{' '}
              <span className="text-suka-brown font-black">
                {Math.min(filteredData.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)} -{' '}
                {Math.min(filteredData.length, currentPage * ITEMS_PER_PAGE)}
              </span>{' '}
              dari <span className="text-suka-brown font-black">{filteredData.length}</span> dokumen
            </p>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-suka-brown/15 text-suka-brown hover:bg-suka-brown/5 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-xs"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const p = idx + 1
                  if (
                    p === 1 ||
                    p === totalPages ||
                    (p >= currentPage - 1 && p <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          currentPage === p
                            ? 'bg-suka-brown text-white shadow-sm'
                            : 'bg-white border border-suka-brown/10 text-suka-gray-600 hover:bg-suka-orange/5'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  }
                  if (p === currentPage - 2 || p === currentPage + 2) {
                    return <span key={p} className="text-xs text-suka-gray-400 font-bold px-1">...</span>
                  }
                  return null
                })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-suka-brown/15 text-suka-brown hover:bg-suka-brown/5 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-xs"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal Konfirmasi Pembatalan PO Draft */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-suka-brown/10 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-suka-brown/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                  <Ban size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-suka-ink uppercase tracking-wide font-display">
                    Batalkan PO Draft
                  </h3>
                  <p className="text-[10px] font-mono text-suka-gray-500 font-bold">
                    {cancelModal.docNum}
                  </p>
                </div>
              </div>
              <button
                disabled={cancelling}
                onClick={() => {
                  setCancelModal(null)
                  setCancelReason('')
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-suka-gray-400 hover:text-suka-ink hover:bg-suka-brown/5 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-suka-gray-600 font-medium leading-relaxed">
              Apakah Anda yakin ingin membatalkan dokumen PO / Surat Jalan berstatus draft ini? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-brown">
                Alasan Pembatalan (Opsional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Salah input jumlah bahan, outlet membatalkan pesanan, dsb."
                disabled={cancelling}
                rows={3}
                className="w-full text-xs font-medium p-3 rounded-xl border border-suka-brown/20 bg-[#fff8f1]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 text-suka-ink placeholder:text-suka-gray-400 resize-none transition-all"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => {
                  setCancelModal(null)
                  setCancelReason('')
                }}
                className="flex-1 py-2.5 bg-white border border-suka-brown/20 hover:bg-suka-brown/5 text-suka-brown font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelPO}
                className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-98"
              >
                {cancelling ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Membatalkan...</span>
                  </>
                ) : (
                  <>
                    <Ban size={14} />
                    <span>Ya, Batalkan PO</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="riwayat" />
    </div>
  )
}
