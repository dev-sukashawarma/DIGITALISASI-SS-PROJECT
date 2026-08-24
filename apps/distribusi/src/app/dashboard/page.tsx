// @ts-nocheck
'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useAuth, createSupabaseBrowserClient } from '@suka/auth'
import { useSuratJalanList } from '@/hooks/useSuratJalanList'
import { useDistribusiRealtime } from '@/hooks/useDistribusiRealtime'
import { BottomNav } from '@/components/distribusi/BottomNav'
import { PrinterStatus } from '@/components/distribusi/PrinterStatus'
import { useRouter } from 'next/navigation'
import { getCrossAppUrl } from '@/lib/navigation'
import { Avatar } from '@suka/design-system'
import Link from 'next/link'
import {
  FileText,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  QrCode,
  History,
  Layers,
  ChevronRight,
  LogOut,
  ShieldAlert,
  Search,
  Store,
  TrendingUp,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  Calendar,
  FileDown,
  Printer,
  Eye,
  PackagePlus,
  SlidersHorizontal,
  X,
  Radio,
  Check
} from 'lucide-react'
import { toast } from 'sonner'

type DateRange = 'all' | 'today' | '7days' | '30days'
type StatusTab = 'all' | 'draft' | 'dikirim' | 'belum_verif' | 'selisih' | 'selesai'

export default function DashboardPage() {
  const router = useRouter()
  const { outletStaff, loading: authLoading, signOut } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mobileDropdownRef = useRef<HTMLDivElement>(null)

  // Filter States
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 8

  // Realtime subscription
  useDistribusiRealtime(outletStaff?.outlet_id)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const isOutsideDesktop = dropdownRef.current ? !dropdownRef.current.contains(target) : true
      const isOutsideMobile = mobileDropdownRef.current ? !mobileDropdownRef.current.contains(target) : true

      if (isOutsideDesktop && isOutsideMobile) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  let resolvedPortalUrl = portalUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedPortalUrl = 'http://localhost:3010'
  }

  const isPusat = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(outletStaff?.role || '')

  // Fetch shipments using the enhanced hook
  const {
    data: allShipments,
    loading: listLoading,
    draftCount,
    sentCount,
    diterimaCount,
    selesaiCount,
  } = useSuratJalanList(dateRange)

  // Time-aware greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Selamat Pagi'
    if (hour < 15) return 'Selamat Siang'
    if (hour < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }, [])

  // Discrepancy & Accuracy stats
  const problemShipments = useMemo(() => {
    return allShipments.filter((sj) => sj.has_problem)
  }, [allShipments])

  const accuracyRate = useMemo(() => {
    if (allShipments.length === 0) return 100
    const verifiedCount = allShipments.filter(
      (sj) => sj.status === 'selesai' || sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian'
    ).length
    if (verifiedCount === 0) return 100
    const accurateCount = verifiedCount - problemShipments.length
    return Math.max(0, Math.round((accurateCount / verifiedCount) * 100))
  }, [allShipments, problemShipments])

  // Volume distribution by outlet
  const outletBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; count: number; activeCount: number; problemCount: number }>()

    allShipments.forEach((sj) => {
      const name = sj.outlet?.name || (isPusat ? 'Outlet Tidak Diketahui' : 'Gudang Pusat (HQ)')
      const existing = map.get(name) || { name, count: 0, activeCount: 0, problemCount: 0 }
      existing.count += 1
      if (sj.status === 'dikirim' || sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian') {
        existing.activeCount += 1
      }
      if (sj.has_problem) {
        existing.problemCount += 1
      }
      map.set(name, existing)
    })

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [allShipments, isPusat])

  // Filtered shipments based on tab, search query, and outlet
  const filteredShipments = useMemo(() => {
    return allShipments.filter((sj) => {
      // Tab filter
      if (statusTab === 'draft' && sj.status !== 'draft') return false
      if (statusTab === 'dikirim' && sj.status !== 'dikirim') return false
      if (statusTab === 'belum_verif' && !['diterima_lengkap', 'diterima_sebagian'].includes(sj.status)) return false
      if (statusTab === 'selisih' && !sj.has_problem) return false
      if (statusTab === 'selesai' && sj.status !== 'selesai') return false

      // Outlet filter
      if (selectedOutletFilter) {
        const outletName = sj.outlet?.name || ''
        if (outletName !== selectedOutletFilter) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const docNum = (sj.document_number || sj.id || '').toLowerCase()
        const outletName = (sj.outlet?.name || '').toLowerCase()
        if (!docNum.includes(q) && !outletName.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [allShipments, statusTab, selectedOutletFilter, searchQuery])

  // Paginated shipments
  const paginatedShipments = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return filteredShipments.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredShipments, page])

  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / ITEMS_PER_PAGE))

  // PDF & QR Helpers
  const handleQuickDownloadPDF = async (e: React.MouseEvent, sjId: string, docNumber?: string) => {
    e.stopPropagation()
    try {
      toast.info('Menyiapkan file PDF...')
      const { generateSuratJalanPDF, downloadPDF } = await import('@/utils/generatePDF')
      const supabase = createSupabaseBrowserClient()

      const { data: sj } = await supabase.from('surat_jalan').select('*').eq('id', sjId).single()
      if (!sj) {
        toast.error('Dokumen tidak ditemukan')
        return
      }

      const { data: items } = await supabase
        .from('surat_jalan_item')
        .select('*, bahan_baku(id, nama, satuan)')
        .eq('surat_jalan_id', sjId)

      const itemsWithBahan = (items || []).map((item) => ({
        ...item,
        nama: item.bahan_baku?.nama || 'Unknown',
        satuan: item.bahan_baku?.satuan || '',
      }))

      const outletData = allShipments.find((d) => d.id === sjId)

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
        { hideQR: !isPusat }
      )

      downloadPDF(`Surat-Jalan-${docNumber || sj.id.substring(0, 8)}.pdf`, pdfBlob)
      toast.success('PDF berhasil diunduh!')
    } catch (err) {
      toast.error('Gagal membuat file PDF')
    }
  }

  const handleQuickPrintQR = async (e: React.MouseEvent, sjId: string, docNumber?: string) => {
    e.stopPropagation()
    try {
      toast.info('Menghubungkan ke printer...')
      const { generateQRDataUrl, printBarcode } = await import('@/utils/generatePDF')
      const { fetchPrintLayout, DEFAULT_PRINT_LAYOUT } = await import('@/utils/printLayout')
      const url = `${window.location.origin}/distribusi/terima/${sjId}`
      const dataUrl = await generateQRDataUrl(url, 400)
      const layout = await fetchPrintLayout(createSupabaseBrowserClient()).catch(() => DEFAULT_PRINT_LAYOUT)

      const { usePrinterStore } = await import('@/utils/printer/printerStore')
      const store = usePrinterStore.getState()

      if (store.device && store.characteristic) {
        try {
          const { printQRViaBluetooth } = await import('@/utils/printer/bluetooth-printer')
          await printQRViaBluetooth(docNumber || sjId.substring(0, 8), dataUrl, layout.qr_surat_jalan)
          toast.success('Berhasil cetak via Bluetooth!')
          return
        } catch (bluetoothErr: any) {
          toast.error('Gagal Bluetooth: ' + bluetoothErr.message)
        }
      }

      printBarcode(docNumber || sjId.substring(0, 8), dataUrl, layout.qr_surat_jalan)
    } catch (err) {
      toast.error('Gagal memproses QR')
    }
  }

  const handleNavigate = (path: string) => {
    const resolvedUrl = getCrossAppUrl(path)
    if (resolvedUrl.startsWith('http')) {
      window.location.href = resolvedUrl
    } else {
      router.push(resolvedUrl)
    }
  }

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-suka-brown font-medium bg-grain relative">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-suka-brown mb-4" />
        <p className="text-xs font-black uppercase tracking-wider animate-pulse">Memuat Pusat Komando Distribusi...</p>
      </div>
    )
  }

  if (!outletStaff) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-4 bg-grain">
        <div className="bg-red-50/90 border border-red-200 backdrop-blur-md p-6 rounded-3xl flex items-center gap-4 max-w-md shadow-xl">
          <ShieldAlert className="text-red-600 shrink-0" size={28} />
          <div>
            <h3 className="font-black text-sm text-red-900 uppercase tracking-wide">Akses Ditolak</h3>
            <p className="text-xs text-red-700 font-semibold mt-1">Sesi login tidak ditemukan. Silakan masuk kembali melalui portal.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1]/60 text-[#1e1b15] pb-32 relative overflow-hidden bg-grain select-none">
      {/* Ambient Spatial Lighting */}
      <div className="absolute top-[-5%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-suka-orange/8 blur-[140px] pointer-events-none z-0 animate-blob-1" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[45vw] h-[45vw] rounded-full bg-suka-brown/8 blur-[140px] pointer-events-none z-0 animate-blob-2" />
      <div className="absolute top-[40%] left-[20%] w-[35vw] h-[35vw] rounded-full bg-amber-400/5 blur-[150px] pointer-events-none z-0" />

      {/* Sticky Global Glass Header */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-suka-brown/10 px-4 sm:px-8 py-3.5 flex flex-col md:flex-row md:justify-between md:items-center shadow-sm relative gap-3 md:gap-0">
        <div className="flex justify-between items-center w-full md:w-auto">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 bg-white rounded-2xl p-1.5 shadow-sm border border-suka-orange/15 flex items-center justify-center shrink-0">
              <img alt="Suka Shawarma Logo" className="w-full h-full object-contain" src="/logo.png" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-lg text-suka-brown leading-tight font-display tracking-tight">
                  Pusat Komando Distribusi
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-[10px] text-suka-gray-500 font-extrabold tracking-widest uppercase mt-0.5">
                {isPusat ? 'Central Warehouse & Logistics HQ' : `Outlet Supply Unit • ${outletStaff.outlets?.name ?? 'Outlet'}`}
              </p>
            </div>
          </div>

          {/* Mobile Right Bar */}
          <div className="md:hidden flex items-center gap-2">
            {isPusat && <PrinterStatus />}
            <div className="relative" ref={mobileDropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-9 h-9 rounded-full ring-2 ring-suka-orange/20 overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
              >
                <Avatar name={outletStaff.name} size={36} />
              </button>
              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-2xl shadow-2xl border border-suka-brown/10 py-2 z-50 flex flex-col">
                  <a href={resolvedPortalUrl} className="px-4 py-2.5 text-xs font-bold text-suka-ink hover:bg-[#faf2e9] transition-colors">
                    ← Portal Utama
                  </a>
                  <button
                    onClick={signOut}
                    className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 text-left flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut size={13} /> Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          <button
            onClick={() => handleNavigate('/dashboard')}
            className="text-xs font-extrabold text-suka-orange border-b-2 border-suka-orange pb-1 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Layers size={14} /> Dashboard Utama
          </button>
          <button
            onClick={() => handleNavigate(isPusat ? '/distribusi/surat-jalan' : '/distribusi/terima')}
            className="text-xs font-bold text-suka-gray-600 hover:text-suka-orange pb-1 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {isPusat ? <Truck size={14} /> : <QrCode size={14} />}
            {isPusat ? 'Surat Jalan Pengiriman' : 'Inbox Penerimaan'}
          </button>
          <button
            onClick={() => handleNavigate('/distribusi/riwayat')}
            className="text-xs font-bold text-suka-gray-600 hover:text-suka-orange pb-1 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <History size={14} /> Riwayat & Arsip
          </button>
        </nav>

        {/* Desktop User Session Bar */}
        <div className="hidden md:flex items-center gap-4">
          {isPusat && <PrinterStatus />}
          <div className="flex flex-col text-right">
            <span className="text-xs font-black text-suka-ink">{outletStaff.name}</span>
            <span className="text-[10px] text-suka-orange font-extrabold uppercase tracking-wider">
              {isPusat ? 'SPV PUSAT (GUDANG)' : (outletStaff.outlets?.name ?? 'OUTLET')}
            </span>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-10 h-10 rounded-full ring-2 ring-suka-orange/20 overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-sm"
            >
              <Avatar name={outletStaff.name} size={40} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-suka-brown/10 py-2 z-50 flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                <a href={resolvedPortalUrl} className="px-4 py-2.5 text-xs font-bold text-suka-ink hover:bg-[#faf2e9] transition-colors">
                  ← Portal Utama
                </a>
                <button
                  onClick={signOut}
                  className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 text-left flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut size={14} /> Keluar Sistem
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-8 relative z-10">

        {/* Hero Control Banner */}
        <section className="bg-gradient-to-r from-suka-brown via-[#4d1003] to-[#701604] rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-suka-brown/15 relative overflow-hidden border border-white/10">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-suka-orange/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-1/4 -bottom-16 w-48 h-48 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-amber-200 border border-white/10">
                  {greeting}
                </span>
                <span className="text-white/60 text-xs font-semibold">
                  • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black font-display tracking-tight leading-tight">
                {isPusat ? 'Pantau & Kelola Seluruh Pengiriman Outlet' : `Penerimaan Logistik ${outletStaff.outlets?.name ?? 'Outlet'}`}
              </h2>
              <p className="text-xs sm:text-sm text-white/80 font-medium leading-relaxed">
                {isPusat
                  ? 'Verifikasi ketersediaan stok fisik, buat dokumen surat jalan digital, pantau status kurir di jalan, dan awasi selisih barang secara real-time.'
                  : 'Pastikan barang fisik yang tiba dicocokkan dengan manifes surat jalan dan bubuhkan tanda tangan penerima sebelum dimasukkan ke kartu stok outlet.'}
              </p>
            </div>

            {/* Quick Filter & Global Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              {/* Date Filter Pills */}
              <div className="bg-black/30 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 flex items-center gap-1">
                {[
                  { key: 'all', label: 'Semua' },
                  { key: 'today', label: 'Hari Ini' },
                  { key: '7days', label: '7 Hari' },
                  { key: '30days', label: '1 Bulan' },
                ].map((range) => (
                  <button
                    key={range.key}
                    onClick={() => {
                      setDateRange(range.key as DateRange)
                      setPage(1)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      dateRange === range.key
                        ? 'bg-suka-orange text-white shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              {isPusat ? (
                <button
                  onClick={() => router.push('/distribusi/surat-jalan/new')}
                  className="px-5 py-3 bg-white hover:bg-amber-50 text-suka-brown font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus size={16} className="text-suka-orange" /> Buat Surat Jalan
                </button>
              ) : (
                <button
                  onClick={() => router.push('/distribusi/terima/scan')}
                  className="px-5 py-3 bg-suka-orange hover:bg-orange-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <QrCode size={16} /> Scan QR Kedatangan
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 5-Column Executive Logistics HUD */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
          {/* HUD 1: Draft */}
          <div
            onClick={() => {
              setStatusTab(statusTab === 'draft' ? 'all' : 'draft')
              setPage(1)
            }}
            className={`bg-white/80 backdrop-blur-xl rounded-3xl p-5 border shadow-sm transition-all duration-300 cursor-pointer group hover:-translate-y-1 hover:shadow-lg ${
              statusTab === 'draft' ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/40' : 'border-suka-orange/15 hover:border-amber-400/40'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                Siap Kirim
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText size={16} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-black text-suka-brown font-display">
                {listLoading ? '...' : draftCount}
              </h3>
              <p className="text-[10px] text-suka-gray-500 font-bold mt-1 leading-tight">
                {isPusat ? 'Draft siap verifikasi & kirim' : 'Draft pesanan pending'}
              </p>
            </div>
          </div>

          {/* HUD 2: Dalam Transit */}
          <div
            onClick={() => {
              setStatusTab(statusTab === 'dikirim' ? 'all' : 'dikirim')
              setPage(1)
            }}
            className={`bg-white/80 backdrop-blur-xl rounded-3xl p-5 border shadow-sm transition-all duration-300 cursor-pointer group hover:-translate-y-1 hover:shadow-lg ${
              statusTab === 'dikirim' ? 'border-blue-400 ring-2 ring-blue-400/20 bg-blue-50/40' : 'border-suka-orange/15 hover:border-blue-400/40'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                Dalam Transit
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Truck size={16} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-black text-blue-900 font-display">
                {listLoading ? '...' : sentCount}
              </h3>
              <p className="text-[10px] text-suka-gray-500 font-bold mt-1 leading-tight">
                Sedang di jalan menuju outlet
              </p>
            </div>
          </div>

          {/* HUD 3: Menunggu Verifikasi */}
          <div
            onClick={() => {
              setStatusTab(statusTab === 'belum_verif' ? 'all' : 'belum_verif')
              setPage(1)
            }}
            className={`bg-white/80 backdrop-blur-xl rounded-3xl p-5 border shadow-sm transition-all duration-300 cursor-pointer group hover:-translate-y-1 hover:shadow-lg ${
              statusTab === 'belum_verif' ? 'border-purple-400 ring-2 ring-purple-400/20 bg-purple-50/40' : 'border-suka-orange/15 hover:border-purple-400/40'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
                Tiba di Outlet
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock size={16} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-black text-purple-900 font-display">
                {listLoading ? '...' : diterimaCount}
              </h3>
              <p className="text-[10px] text-suka-gray-500 font-bold mt-1 leading-tight">
                Menunggu hitung fisik & TTD
              </p>
            </div>
          </div>

          {/* HUD 4: Pengiriman Selesai */}
          <div
            onClick={() => {
              setStatusTab(statusTab === 'selesai' ? 'all' : 'selesai')
              setPage(1)
            }}
            className={`bg-white/80 backdrop-blur-xl rounded-3xl p-5 border shadow-sm transition-all duration-300 cursor-pointer group hover:-translate-y-1 hover:shadow-lg ${
              statusTab === 'selesai' ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/40' : 'border-suka-orange/15 hover:border-emerald-400/40'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                Tervalidasi
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-800 font-display">
                {listLoading ? '...' : selesaiCount}
              </h3>
              <p className="text-[10px] text-suka-gray-500 font-bold mt-1 leading-tight">
                Selesai & stok otomatis update
              </p>
            </div>
          </div>

          {/* HUD 5: Tingkat Akurasi (Zero Selisih) */}
          <div
            onClick={() => {
              setStatusTab(statusTab === 'selisih' ? 'all' : 'selisih')
              setPage(1)
            }}
            className={`col-span-2 sm:col-span-1 bg-white/80 backdrop-blur-xl rounded-3xl p-5 border shadow-sm transition-all duration-300 cursor-pointer group hover:-translate-y-1 hover:shadow-lg ${
              statusTab === 'selisih' ? 'border-red-400 ring-2 ring-red-400/20 bg-red-50/40' : 'border-suka-orange/15 hover:border-emerald-400/40'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                problemShipments.length > 0
                  ? 'text-red-700 bg-red-50 border-red-200'
                  : 'text-teal-700 bg-teal-50 border-teal-200'
              }`}>
                {problemShipments.length > 0 ? `${problemShipments.length} Selisih` : 'Zero Selisih'}
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                problemShipments.length > 0 ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'
              }`}>
                {problemShipments.length > 0 ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
              </div>
            </div>
            <div className="mt-3">
              <h3 className={`text-2xl sm:text-3xl font-black font-display ${
                problemShipments.length > 0 ? 'text-red-700' : 'text-teal-800'
              }`}>
                {accuracyRate}%
              </h3>
              <p className="text-[10px] text-suka-gray-500 font-bold mt-1 leading-tight">
                {problemShipments.length > 0 ? 'Perlu investigasi SPV' : 'Tingkat akurasi sempurna'}
              </p>
            </div>
          </div>
        </section>

        {/* Master Content Grid (8 Cols Left + 4 Cols Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column (8 Cols): Analytics & Live Feed */}
          <div className="lg:col-span-8 space-y-8">

            {/* Outlet Shipment Breakdown Chart/Cards */}
            {isPusat && outletBreakdown.length > 0 && (
              <div className="bg-white/85 backdrop-blur-xl rounded-3xl border border-suka-orange/15 p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-suka-brown/10 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-suka-orange/10 text-suka-orange flex items-center justify-center">
                      <BarChart3 size={18} />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-suka-brown uppercase tracking-wider font-display">
                        Distribusi Kiriman Berdasarkan Outlet
                      </h3>
                      <p className="text-[10px] text-suka-gray-500 font-semibold">
                        Volume dokumen pengiriman logistik ({allShipments.length} total)
                      </p>
                    </div>
                  </div>
                  {selectedOutletFilter && (
                    <button
                      onClick={() => setSelectedOutletFilter(null)}
                      className="text-[10px] font-black text-suka-orange hover:text-orange-700 bg-suka-orange/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 uppercase tracking-wider self-start cursor-pointer"
                    >
                      <X size={12} /> Hapus Filter ({selectedOutletFilter})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {outletBreakdown.map((item) => {
                    const percentage = allShipments.length > 0 ? Math.round((item.count / allShipments.length) * 100) : 0
                    const isSelected = selectedOutletFilter === item.name

                    return (
                      <div
                        key={item.name}
                        onClick={() => {
                          setSelectedOutletFilter(isSelected ? null : item.name)
                          setPage(1)
                        }}
                        className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-suka-brown text-white border-suka-brown shadow-md scale-[1.02]'
                            : 'bg-[#fff8f1]/50 border-suka-brown/10 hover:border-suka-orange/40 hover:bg-white'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex justify-between items-start gap-1">
                            <h4 className={`text-xs font-black uppercase tracking-wide truncate ${
                              isSelected ? 'text-white' : 'text-suka-ink'
                            }`}>
                              {item.name}
                            </h4>
                            <span className={`text-[10px] font-black shrink-0 ${
                              isSelected ? 'text-amber-300' : 'text-suka-orange'
                            }`}>
                              {percentage}%
                            </span>
                          </div>
                          <p className={`text-[10px] font-semibold ${
                            isSelected ? 'text-white/70' : 'text-suka-gray-500'
                          }`}>
                            {item.count} Dokumen SJ &bull; {item.activeCount} Aktif
                          </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isSelected ? 'bg-amber-300' : 'bg-suka-orange'
                            }`}
                            style={{ width: `${Math.max(8, percentage)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Master Logistics Document Manifest Card */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl border border-suka-orange/15 shadow-sm overflow-hidden space-y-4 p-6">
              {/* Header with Search and Status Tabs */}
              <div className="flex flex-col gap-4 border-b border-suka-brown/10 pb-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-suka-brown/10 text-suka-brown flex items-center justify-center">
                      <Layers size={18} />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-suka-brown uppercase tracking-wider font-display">
                        Manifes Dokumen Distribusi Terkini
                      </h3>
                      <p className="text-[10px] text-suka-gray-500 font-semibold">
                        Menampilkan {filteredShipments.length} dari {allShipments.length} dokumen
                      </p>
                    </div>
                  </div>

                  <Link
                    href={isPusat ? '/distribusi/surat-jalan' : '/distribusi/terima'}
                    className="text-xs font-black text-suka-orange hover:text-orange-700 flex items-center gap-1 uppercase tracking-wider self-start sm:self-auto"
                  >
                    Buka Daftar Lengkap <ChevronRight size={14} />
                  </Link>
                </div>

                {/* Search and Tabs Row */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-gray-400" size={15} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setPage(1)
                      }}
                      placeholder="Cari No. SJ atau Nama Outlet..."
                      className="w-full pl-9 pr-8 py-2.5 bg-white border border-suka-brown/15 rounded-xl text-xs font-semibold text-suka-ink placeholder:text-suka-gray-400 focus:outline-none focus:ring-2 focus:ring-suka-orange/30 focus:border-suka-orange transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-suka-gray-400 hover:text-suka-ink"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Status Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                    {[
                      { key: 'all', label: 'Semua' },
                      { key: 'draft', label: 'Draft' },
                      { key: 'dikirim', label: 'Transit' },
                      { key: 'belum_verif', label: 'Perlu Verif' },
                      { key: 'selisih', label: 'Selisih' },
                      { key: 'selesai', label: 'Selesai' },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => {
                          setStatusTab(tab.key as StatusTab)
                          setPage(1)
                        }}
                        className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border whitespace-nowrap cursor-pointer ${
                          statusTab === tab.key
                            ? 'bg-suka-brown text-white border-suka-brown shadow-sm'
                            : 'bg-white text-suka-gray-600 border-suka-brown/10 hover:bg-suka-orange/5'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shipments List Table / Rows */}
              {listLoading ? (
                <div className="py-16 text-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-suka-brown mx-auto" />
                  <p className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider animate-pulse">
                    Memuat data manifes surat jalan...
                  </p>
                </div>
              ) : filteredShipments.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-14 h-14 bg-suka-orange/10 text-suka-orange rounded-2xl flex items-center justify-center mx-auto">
                    <FileText size={26} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-suka-brown uppercase tracking-wider">
                      Tidak ada dokumen surat jalan ditemukan
                    </p>
                    <p className="text-xs text-suka-gray-500 font-medium max-w-sm mx-auto">
                      Coba ubah kata kunci pencarian, filter status, atau rentang tanggal pada panel kontrol.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedShipments.map((sj) => {
                    const formattedDate = new Date(sj.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })

                    const itemCount = sj.surat_jalan_item?.length || 0

                    return (
                      <div
                        key={sj.id}
                        onClick={() => router.push(isPusat ? `/distribusi/surat-jalan/${sj.id}` : `/distribusi/terima/${sj.id}`)}
                        className="bg-white rounded-2xl border border-suka-brown/10 p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xs hover:border-suka-orange/40 hover:shadow-md active:scale-[0.99] transition-all duration-200 cursor-pointer group"
                      >
                        {/* Left: Document Info */}
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono font-black text-suka-brown bg-suka-orange/10 px-2.5 py-0.5 rounded-lg border border-suka-orange/15 group-hover:bg-suka-orange group-hover:text-white transition-colors">
                              {sj.document_number || sj.id.substring(0, 8).toUpperCase()}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                              sj.status === 'draft'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : sj.status === 'dikirim'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : sj.status === 'selesai'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                              {sj.status === 'draft' && 'Draft Siap Kirim'}
                              {sj.status === 'dikirim' && 'Dalam Transit'}
                              {sj.status === 'selesai' && 'Selesai'}
                              {(sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian') && 'Tiba di Outlet'}
                            </span>

                            {sj.has_problem && (
                              <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                                <AlertTriangle size={11} /> Ada Selisih
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                            <h4 className="font-extrabold text-suka-ink text-xs uppercase tracking-wide group-hover:text-suka-orange transition-colors truncate">
                              {isPusat ? `Tujuan: ${sj.outlet?.name || 'Unknown'}` : `Dari: ${sj.outlets?.name || 'Gudang Pusat (HQ)'}`}
                            </h4>
                            <span className="text-[10px] text-suka-gray-500 font-semibold flex items-center gap-1 shrink-0">
                              <Calendar size={11} className="text-suka-orange" /> {formattedDate}
                            </span>
                          </div>

                          {itemCount > 0 && (
                            <p className="text-[10px] text-suka-gray-500 font-medium">
                              Memuat <span className="font-bold text-suka-ink">{itemCount} jenis bahan baku</span>
                            </p>
                          )}
                        </div>

                        {/* Right: Quick Action Controls */}
                        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto border-t md:border-t-0 pt-3 md:pt-0 border-suka-brown/5 w-full md:w-auto justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(isPusat ? `/distribusi/surat-jalan/${sj.id}` : `/distribusi/terima/${sj.id}`)
                            }}
                            className="px-3.5 py-2 bg-suka-brown hover:bg-suka-ink text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Eye size={13} /> Detail
                          </button>

                          <button
                            onClick={(e) => handleQuickDownloadPDF(e, sj.id, sj.document_number)}
                            title="Unduh Dokumen PDF"
                            className="p-2 bg-white border border-suka-brown/15 hover:bg-suka-orange/5 text-suka-brown font-extrabold text-[10px] rounded-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs"
                          >
                            <FileDown size={14} />
                          </button>

                          {isPusat && (
                            <button
                              onClick={(e) => handleQuickPrintQR(e, sj.id, sj.document_number)}
                              title="Cetak QR Code"
                              className="p-2 bg-white border border-suka-brown/15 hover:bg-suka-orange/5 text-suka-orange font-extrabold text-[10px] rounded-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs"
                            >
                              <QrCode size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Pagination Bar */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-suka-brown/10">
                      <p className="text-[10px] font-bold text-suka-gray-500 uppercase tracking-wider">
                        Halaman {page} dari {totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1.5 bg-white border border-suka-brown/15 text-suka-ink font-black text-xs rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-suka-orange/5 cursor-pointer"
                        >
                          Sebelumnya
                        </button>
                        <button
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className="px-3 py-1.5 bg-white border border-suka-brown/15 text-suka-ink font-black text-xs rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-suka-orange/5 cursor-pointer"
                        >
                          Selanjutnya
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (4 Cols): Action Center, Discrepancy Radar, SOP */}
          <div className="lg:col-span-4 space-y-6">

            {/* Quick Actions Panel */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl border border-suka-orange/20 shadow-md p-6 space-y-4 relative overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-suka-brown/10 pb-3.5">
                <div className="w-8 h-8 rounded-xl bg-suka-orange/10 text-suka-orange flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <h3 className="font-black text-sm text-suka-brown uppercase tracking-wider font-display">
                  Pintasan Aksi Cepat
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {isPusat ? (
                  <>
                    <button
                      onClick={() => router.push('/distribusi/surat-jalan/new')}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-suka-orange to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-between shadow-md shadow-suka-orange/20 transition-all cursor-pointer group"
                    >
                      <span className="flex items-center gap-2.5">
                        <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> Buat Surat Jalan Baru
                      </span>
                      <ChevronRight size={16} />
                    </button>

                    <button
                      onClick={() => router.push('/distribusi/terima-bahan')}
                      className="w-full py-3 px-4 bg-[#fff8f1] hover:bg-orange-50 active:scale-[0.98] border border-suka-orange/20 text-suka-brown rounded-2xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <PackagePlus size={16} className="text-suka-orange" /> Terima PO Bahan Supplier
                      </span>
                      <ChevronRight size={14} className="text-suka-gray-400" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => router.push('/distribusi/terima/scan')}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-suka-orange to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-between shadow-md shadow-suka-orange/20 transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <QrCode size={18} /> Scan QR Kedatangan
                      </span>
                      <ChevronRight size={16} />
                    </button>

                    <button
                      onClick={() => router.push('/distribusi/terima')}
                      className="w-full py-3 px-4 bg-[#fff8f1] hover:bg-orange-50 active:scale-[0.98] border border-suka-orange/20 text-suka-brown rounded-2xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Truck size={16} className="text-suka-orange" /> Inbox Kiriman Masuk
                      </span>
                      <ChevronRight size={14} className="text-suka-gray-400" />
                    </button>
                  </>
                )}

                <button
                  onClick={() => router.push('/distribusi/riwayat')}
                  className="w-full py-3 px-4 bg-white hover:bg-suka-gray-50 active:scale-[0.98] border border-suka-brown/15 text-suka-ink rounded-2xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-2.5">
                    <History size={16} className="text-suka-gray-500" /> Buku Arsip & Riwayat
                  </span>
                  <ChevronRight size={14} className="text-suka-gray-400" />
                </button>
              </div>
            </div>

            {/* Discrepancy & Attention Radar */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl border border-suka-orange/15 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-suka-brown/10 pb-3.5">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    problemShipments.length > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {problemShipments.length > 0 ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                  </div>
                  <h3 className="font-black text-sm text-suka-brown uppercase tracking-wider font-display">
                    Pengawasan Selisih
                  </h3>
                </div>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  problemShipments.length > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {problemShipments.length} Kasus
                </span>
              </div>

              {problemShipments.length === 0 ? (
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/60 text-center space-y-1">
                  <p className="text-xs font-black text-emerald-800 uppercase tracking-wide">
                    100% Pengiriman Akurat
                  </p>
                  <p className="text-[10px] text-emerald-700/80 font-medium">
                    Tidak ada catatan barang rusak atau selisih kuantitas saat penerimaan.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">
                    Perlu Peninjauan Supervisor:
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {problemShipments.slice(0, 4).map((sj) => (
                      <div
                        key={sj.id}
                        onClick={() => router.push(isPusat ? `/distribusi/surat-jalan/${sj.id}` : `/distribusi/terima/${sj.id}`)}
                        className="p-3 bg-red-50/70 rounded-xl border border-red-200 flex justify-between items-center text-xs hover:bg-red-100/80 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-black text-red-900 uppercase tracking-wide truncate">
                            {sj.document_number || sj.id.substring(0, 8)}
                          </p>
                          <p className="text-[9px] text-red-700 font-semibold truncate">
                            {sj.outlet?.name || 'Outlet'}
                          </p>
                        </div>
                        <span className="text-[9px] font-extrabold text-red-700 uppercase bg-white px-2 py-0.5 rounded border border-red-200 shrink-0">
                          Review
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SOP & Flow Checklist */}
            <div className="bg-white/85 backdrop-blur-xl rounded-3xl border border-suka-orange/15 shadow-sm overflow-hidden">
              <div className="px-6 py-4.5 border-b border-suka-brown/10 bg-white/50 flex items-center gap-2">
                <Radio size={16} className="text-suka-orange animate-pulse" />
                <h3 className="font-black text-xs text-suka-brown uppercase tracking-wider font-display">
                  {isPusat ? 'SOP Distribusi Gudang Pusat' : 'SOP Penerimaan Logistik Outlet'}
                </h3>
              </div>

              <div className="divide-y divide-suka-orange/10 text-xs">
                {isPusat ? (
                  <>
                    <div className="p-4 flex items-start gap-3 bg-white/40">
                      <span className="text-[11px] font-black text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">1</span>
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-suka-ink">Pengecekan Kebutuhan & Stok</h5>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Cek pengajuan permintaan bahan dari outlet yang telah disetujui supervisor.</p>
                      </div>
                    </div>
                    <div className="p-4 flex items-start gap-3 bg-transparent">
                      <span className="text-[11px] font-black text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">2</span>
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-suka-ink">Pembuatan Surat Jalan</h5>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Input Qty riil bahan yang dikirim, tanda tangani, lalu cetak QR & PDF manifes.</p>
                      </div>
                    </div>
                    <div className="p-4 flex items-start gap-3 bg-white/40">
                      <span className="text-[11px] font-black text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">3</span>
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-suka-ink">Serah Terima ke Kurir/Supir</h5>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Serahkan dokumen cetak dan bahan ke supir pengirim untuk dibawa ke outlet tujuan.</p>
                      </div>
                    </div>
                    <div className="p-4 flex items-start gap-3 bg-transparent">
                      <span className="text-[11px] font-black text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">4</span>
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-suka-ink">Monitoring Tiba & Verifikasi</h5>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Pantau konfirmasi tanda tangan outlet hingga status dokumen menjadi selesai.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 flex items-start gap-3 bg-white/40">
                      <span className="text-[11px] font-black text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">1</span>
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-suka-ink">Scan QR Kedatangan Logistik</h5>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Arahkan kamera HP ke lembar cetak QR code yang dibawa kurir logistik.</p>
                      </div>
                    </div>
                    <div className="p-4 flex items-start gap-3 bg-transparent">
                      <span className="text-[11px] font-black text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">2</span>
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-suka-ink">Hitung Fisik & Verifikasi Qty</h5>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Cek kesesuaian fisik. Gunakan tombol 'Sesuai' jika lengkap atau catat jika ada selisih/rusak.</p>
                      </div>
                    </div>
                    <div className="p-4 flex items-start gap-3 bg-white/40">
                      <span className="text-[11px] font-black text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">3</span>
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-suka-ink">Tanda Tangan Digital Penerima</h5>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Bubuhkan tanda tangan staf penerima dan supir pengirim pada layar canvas.</p>
                      </div>
                    </div>
                    <div className="p-4 flex items-start gap-3 bg-transparent">
                      <span className="text-[11px] font-black text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">4</span>
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-suka-ink">Sinkronisasi Kartu Stok Otomatis</h5>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Saldo stok gudang outlet bertambah otomatis secara real-time di sistem.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Ecosystem & Hardware Connection Card */}
            <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-suka-brown/10 p-4 flex items-center justify-between text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <p className="font-extrabold text-suka-ink text-[11px]">Realtime Data Engine</p>
                  <p className="text-[9px] text-suka-gray-400 font-semibold">WebSockets Supabase Terhubung</p>
                </div>
              </div>
              <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                Online
              </span>
            </div>

          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab="dashboard" />
    </div>
  )
}

