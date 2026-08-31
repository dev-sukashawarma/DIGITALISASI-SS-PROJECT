// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import CountUp from 'react-countup'
import { 
  TrendingUp, 
  DollarSign, 
  Store, 
  Activity, 
  ShoppingBag, 
  Clock, 
  CheckCircle,
  CreditCard,
  FileText,
  User,
  Users,
  UserCircle,
  ShieldCheck,
  Building,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Download,
  ArrowRightLeft,
  MessageSquare,
  Send,
  HelpCircle,
  Receipt,
  Utensils,
  RefreshCw
} from 'lucide-react'
import { deltaPct } from '@/lib/format'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { PeriodFilterValue } from '@/lib/types'
import { useMitraOutlet } from './MitraOutletContext'
import { getMitraRoiStats } from '@/app/actions/mitraRoi'
import { getMitraComprehensivePnl, type ComprehensiveMitraPnl } from '@/app/actions/mitraPnl'
import { MitraBiodataModal } from './MitraBiodataModal'
import { MitraProfitLossSection } from './MitraProfitLossSection'
import { createClient } from '@/lib/supabase'
import OrderSourceBadge from '@/components/OrderSourceBadge'
import { toast } from 'sonner'

const RevenueTrendChart = dynamic(
  () => import('@/components/RevenueTrendChart').then((m) => m.RevenueTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

function formatLastUpdated(dateIso?: string) {
  if (!dateIso) return ''
  try {
    const d = new Date(dateIso)
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d) + ' WIB'
  } catch {
    return ''
  }
}

export function MitraDashboardView({ 
  mitra, 
  outlets = [],
  investasiMap = {},
  curKpiRows = [],
  prevKpiRows = [],
  trendKpiRows = [],
  trendFilter,
  currentFilter,
  topMenus = [],
  recentOrders = [],
  initialTransfers = [],
  initialStaff = [],
  initialSuggestions = [],
  initialRoiStats = { roi: 0, bepPercentage: 0 },
  isAdminMode = false,
  allMitraProfiles = [],
  lastUpdated,
  isCached,
}: any) {
  const router = useRouter()
  const supabase = createClient()
  const { selectedOutlet, selectedOutletId, setSelectedOutletId } = useMitraOutlet()
  
  const allowedOutletIds = (outlets || []).map((o: any) => o.id)

  const [isBiodataOpen, setIsBiodataOpen] = useState(false)
  const [pnlData, setPnlData] = useState<ComprehensiveMitraPnl | null>(null)
  const [isPnlLoading, setIsPnlLoading] = useState(true)

  // Saran State
  const [saranList, setSaranList] = useState<any[]>(initialSuggestions)
  const [isiSaran, setIsiSaran] = useState('')
  const [isSubmittingSaran, setIsSubmittingSaran] = useState(false)

  // ROI Stats
  const [roiStats, setRoiStats] = useState<{ roi: number; bepPercentage: number; loading: boolean }>({
    roi: initialRoiStats?.roi || 0,
    bepPercentage: initialRoiStats?.bepPercentage || 0,
    loading: false
  })

  const handleFilterChange = (newFilter: PeriodFilterValue) => {
    if (newFilter.outletId && newFilter.outletId !== selectedOutletId) {
      setSelectedOutletId(newFilter.outletId)
    }
    const params = new URLSearchParams()
    if (newFilter.from) params.set('from', newFilter.from)
    if (newFilter.to) params.set('to', newFilter.to)
    router.push(`?${params.toString()}`)
  }

  // Load ROI Stats
  useEffect(() => {
    let active = true
    async function loadStats() {
      if (allowedOutletIds.length === 0) return
      try {
        const stats = await getMitraRoiStats(selectedOutletId || 'all', allowedOutletIds)
        if (active) {
          setRoiStats({ roi: stats.roi, bepPercentage: stats.bepPercentage, loading: false })
        }
      } catch (e) {
        console.error('Error loading ROI stats:', e)
        if (active) setRoiStats(prev => ({ ...prev, loading: false }))
      }
    }
    loadStats()
    return () => { active = false }
  }, [selectedOutletId, outlets])

  // Load Dynamic Comprehensive P&L
  useEffect(() => {
    let active = true
    async function loadPnl() {
      setIsPnlLoading(true)
      try {
        if (allowedOutletIds.length === 0) return
        const res = await getMitraComprehensivePnl(
          currentFilter,
          selectedOutletId || 'all',
          allowedOutletIds
        )
        if (active) {
          setPnlData(res)
          setIsPnlLoading(false)
        }
      } catch (e) {
        console.error('Error loading comprehensive PnL:', e)
        if (active) setIsPnlLoading(false)
      }
    }
    loadPnl()
    return () => { active = false }
  }, [selectedOutletId, currentFilter, outlets])

  // Handle Download Bukti Transfer
  const handleDownloadTransfer = async (url: string) => {
    try {
      const { data } = await supabase.storage.from('mitra-transfers').createSignedUrl(url, 60)
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      } else {
        toast.error('Gagal mengambil file bukti transfer.')
      }
    } catch {
      toast.error('Terjadi kendala saat membuka bukti transfer.')
    }
  }

  // Handle Submit Saran
  const handleSubmitSaran = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isiSaran.trim() || !mitra?.user_id) return
    
    setIsSubmittingSaran(true)
    try {
      const targetOid = selectedOutletId === 'all' ? (outlets[0]?.id || null) : selectedOutletId
      const { data, error } = await supabase
        .from('mitra_suggestions')
        .insert({
          user_id: mitra.user_id,
          outlet_id: targetOid,
          isi_saran: isiSaran.trim()
        })
        .select()
        .single()
        
      if (!error && data) {
        setIsiSaran('')
        setSaranList(prev => [data, ...prev])
        toast.success('Saran / pertanyaan Anda berhasil dikirim ke Admin Pusat.')
      } else {
        toast.error('Gagal mengirim saran.')
      }
    } catch {
      toast.error('Terjadi kesalahan saat mengirim saran.')
    } finally {
      setIsSubmittingSaran(false)
    }
  }

  // Hitung Nilai Investasi
  const currentInvestasi = selectedOutletId && selectedOutletId !== 'all' 
    ? (investasiMap[selectedOutletId] || 0) 
    : Object.values(investasiMap).reduce((sum: number, val: any) => sum + Number(val || 0), 0)

  // Filter baris performa hanya untuk outlet yang dipilih
  const curOutletKpi = selectedOutletId === 'all' 
    ? curKpiRows 
    : curKpiRows.filter((r: any) => r.outlet_id === selectedOutletId)
  const currentOmzet = curOutletKpi.reduce((sum: number, r: any) => sum + r.omzet + (r.total_deductions || 0), 0)

  const prevOutletKpi = selectedOutletId === 'all' 
    ? prevKpiRows 
    : prevKpiRows.filter((r: any) => r.outlet_id === selectedOutletId)
  const prevOmzet = prevOutletKpi.reduce((sum: number, r: any) => sum + r.omzet + (r.total_deductions || 0), 0)

  const trendOutletKpi = selectedOutletId === 'all' 
    ? trendKpiRows 
    : trendKpiRows.filter((r: any) => r.outlet_id === selectedOutletId)

  // Filter staff by selected outlet
  const filteredStaff = selectedOutletId === 'all'
    ? initialStaff
    : initialStaff.filter((s: any) => s.outlet_id === selectedOutletId)

  // Filter transfers by selected outlet
  const filteredTransfers = selectedOutletId === 'all'
    ? initialTransfers
    : initialTransfers.filter((t: any) => t.outlet_id === selectedOutletId)

  // Filter recent orders by selected outlet
  const filteredOrders = selectedOutletId === 'all'
    ? recentOrders
    : recentOrders.filter((o: any) => o.outlet_id === selectedOutletId)

  const dOmzet = deltaPct(currentOmzet, prevOmzet)

  const renderDelta = (delta: number | null) => {
    if (delta === null) return null
    const isUp = delta > 0
    return (
      <span className={`inline-flex items-center text-xs font-bold ${isUp ? 'text-green-500' : 'text-red-500'}`}>
        {isUp ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1 rotate-180" />}
        {Math.abs(delta).toFixed(1)}% vs lalu
      </span>
    )
  }

  const outletNamesList = (outlets || []).map((o: any) => o.name)

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val || 0).toLocaleString('id-ID')
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Premium Glassmorphic Background Elements */}
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-br from-suka-orange/10 via-suka-brown/5 to-transparent pointer-events-none" />
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-suka-orange/20 blur-[120px] pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-suka-brown/10 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8 relative z-10 animate-fade-in">
        
        {/* ADMIN PREVIEW MODE BANNER */}
        {isAdminMode && (
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-300/80 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-amber-950 text-sm">Mode Tinjauan Admin: Preview Portal Mitra</h4>
                <p className="text-xs text-amber-800/80 font-medium">Anda sedang melihat dashboard dalam perspektif Mitra. Pilih profil mitra di samping untuk beralih.</p>
              </div>
            </div>

            {allMitraProfiles.length > 0 ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-amber-900 shrink-0">Pilih Mitra:</span>
                <select
                  value={mitra?.id || ''}
                  onChange={(e) => {
                    const params = new URLSearchParams(window.location.search)
                    params.set('mitraId', e.target.value)
                    router.push(`?${params.toString()}`)
                  }}
                  className="bg-white border border-amber-300 text-xs font-black text-amber-950 rounded-xl px-3 py-2 outline-none cursor-pointer shadow-sm focus:ring-2 focus:ring-amber-500/20"
                >
                  {allMitraProfiles.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.nama_mitra} ({p.outlet_ids?.length || 0} Outlet)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <a
                href="/dashboard/owner/kelola-mitra"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-amber-600 transition-colors shrink-0"
              >
                <span>Kelola / Tambah Mitra</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* 1. HERO / HEADER SECTION */}
        <div className="bg-white/70 backdrop-blur-xl border border-white p-6 sm:p-8 rounded-[32px] shadow-xl shadow-suka-orange/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
          <div className="absolute inset-0 rounded-[32px] overflow-hidden pointer-events-none -z-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-suka-orange/10 rounded-full blur-[60px] translate-x-1/2 -translate-y-1/2" />
          </div>
          
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-suka-orange/10 text-suka-orange text-xs font-black uppercase tracking-widest border border-suka-orange/20">
                <span className="w-1.5 h-1.5 rounded-full bg-suka-orange mr-2 animate-pulse" />
                Dashboard Kemitraan Komprehensif
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" /> Mitra Terverifikasi
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-suka-brown tracking-tighter">
              Halo, <span className="text-suka-orange drop-shadow-sm">{mitra?.nama_mitra || 'Mitra'}</span> 👋
            </h1>

            {/* Quick Biodata & Bank Summary Bar */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-suka-gray-500 font-medium pt-1">
              <div className="flex items-center gap-1.5 bg-white/90 border border-suka-gray-200 px-3 py-1.5 rounded-xl shadow-sm">
                <CreditCard className="w-3.5 h-3.5 text-suka-orange" />
                <span>
                  Rekening Bagi Hasil: <strong>{mitra?.bank_name || 'BCA'} {mitra?.bank_account_number || '-'}</strong> ({mitra?.bank_account_holder || mitra?.nama_mitra})
                </span>
              </div>
            </div>
          </div>
          
          {/* Outlet Selector Dropdown */}
          {outlets && outlets.length > 0 && (
            <div className="w-full md:w-auto relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-suka-orange to-suka-brown rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
              <div className="relative w-full bg-white/90 backdrop-blur-md rounded-2xl border border-white shadow-sm p-2 flex items-center">
                <div className="p-2 bg-suka-orange/10 rounded-xl mr-3">
                  <Store className="w-5 h-5 text-suka-orange" />
                </div>
                <select 
                  className="w-full min-h-[44px] bg-transparent text-sm font-extrabold text-suka-brown outline-none cursor-pointer pr-8 appearance-none"
                  value={selectedOutletId || (outlets.length === 1 ? outlets[0].id : 'all')}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                >
                  {outlets.length > 1 && (
                    <option value="all" className="font-bold text-slate-800">
                      Semua Outlet ({outlets.length})
                    </option>
                  )}
                  {outlets.map((o: any) => (
                    <option key={o.id} value={o.id} className="font-medium text-slate-700">
                      Outlet: {o.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 pointer-events-none">
                  <svg className="w-4 h-4 text-suka-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Sinkronisasi / Last Updated */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 -mt-4 mb-2 text-xs">
          <div className="flex items-center gap-2">
            {isCached ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 font-bold text-[11px] shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Terakhir diperbarui: <strong>{formatLastUpdated(lastUpdated)}</strong> (Data Lampau Tersimpan)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 font-bold text-[11px] shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Realtime · Sinkronisasi POS: <strong>{formatLastUpdated(lastUpdated)}</strong></span>
              </span>
            )}
          </div>
          <button
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-suka-brown hover:text-suka-ink bg-white/90 hover:bg-white border border-suka-gray-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Muat ulang data dari database"
          >
            <RefreshCw className="w-3 h-3 text-suka-orange" />
            <span>Segarkan Data</span>
          </button>
        </div>

        {!outlets || outlets.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-12 text-center border border-white shadow-xl shadow-suka-orange/5 animate-fade-in">
            <div className="bg-suka-orange/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Store className="w-12 h-12 text-suka-orange" />
            </div>
            <h3 className="text-2xl font-extrabold text-suka-brown mb-3">Belum Ada Outlet Aktif</h3>
            <p className="text-suka-gray-500 max-w-md mx-auto font-medium text-base leading-relaxed">
              Profil kemitraan Anda saat ini belum dikaitkan dengan outlet mana pun. Silakan hubungi admin pusat untuk proses aktivasi akses outlet.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            
            {/* 2. TOP 3 KPI FINANCIAL CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1: Omzet Penjualan */}
              <div className="group bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl hover:shadow-suka-orange/10 hover:bg-white/90 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-100/30 rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-500" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">
                      {(!currentFilter?.from || currentFilter.from === currentFilter.to) ? 'Omzet Kemarin' : 'Total Omzet Periode'}
                    </p>
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1">Penjualan kotor seluruh channel</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100 shadow-sm group-hover:rotate-12 transition-transform duration-300">
                    <TrendingUp className="w-6 h-6 text-suka-green" />
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-3">
                  <h3 className="text-2xl sm:text-3xl xl:text-2xl 2xl:text-3xl font-black text-suka-brown tracking-tight tabular-nums drop-shadow-sm leading-tight whitespace-nowrap">
                    Rp <CountUp end={currentOmzet} duration={1.5} separator="." decimals={0} />
                  </h3>
                  <div className="mt-1">
                    {renderDelta(dOmzet)}
                  </div>
                </div>
              </div>

              {/* Card 2: Nilai Investasi & Progres Balik Modal */}
              <div className="group bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl hover:shadow-suka-orange/10 hover:bg-white/90 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-100/30 rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-500" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">Modal Investasi</p>
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1">Modal awal outlet disetor</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-red-50 to-red-100/50 border border-red-100 shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <DollarSign className="w-6 h-6 text-suka-brown" />
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-4">
                  <h3 className="text-2xl sm:text-3xl xl:text-2xl 2xl:text-3xl font-black text-suka-brown tracking-tight tabular-nums drop-shadow-sm leading-tight whitespace-nowrap">
                    Rp <CountUp end={currentInvestasi} duration={1.5} separator="." decimals={0} />
                  </h3>
                  
                  {/* Visual Indicator of BEP Progress */}
                  <div className="w-full relative group/bep">
                    <div className="flex justify-between items-end text-[10px] font-extrabold text-suka-gray-500 mb-2 uppercase tracking-wider">
                      <span>Progres Balik Modal (BEP)</span>
                      <span className="text-suka-orange font-black">{roiStats.bepPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-suka-gray-100/80 rounded-full h-2.5 overflow-hidden shadow-inner backdrop-blur-sm relative">
                      <div className="absolute inset-0 bg-white/20" />
                      <div 
                        className={`h-full rounded-full transition-all duration-[2000ms] ease-out shadow-sm ${
                          roiStats.bepPercentage >= 100 
                            ? 'bg-gradient-to-r from-suka-green/80 to-suka-green' 
                            : 'bg-gradient-to-r from-suka-orange/80 to-suka-orange'
                        }`}
                        style={{ width: `${Math.min(roiStats.bepPercentage, 100)}%` }}
                      >
                        <div className="w-full h-full bg-white/20 animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: ROI Aktual & Bagi Hasil */}
              <div className="group bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl hover:shadow-suka-orange/10 hover:bg-white/90 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100/30 rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-500" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">ROI Kumulatif</p>
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1">Rasio pengembalian modal</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-100 shadow-sm group-hover:rotate-12 transition-transform duration-300">
                    <Activity className="w-6 h-6 text-suka-orange" />
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-3">
                  <h3 className="text-2xl sm:text-3xl xl:text-2xl 2xl:text-3xl font-black text-suka-brown tracking-tight tabular-nums drop-shadow-sm leading-tight whitespace-nowrap">
                    {roiStats.loading ? (
                      <span className="text-suka-gray-300">...</span>
                    ) : (
                      <><CountUp end={roiStats.roi} duration={1.5} separator="." decimals={1} decimal="," />%</>
                    )}
                  </h3>
                  <div className="mt-1">
                    <span className="inline-flex items-center text-xs font-bold text-suka-orange">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Akumulasi Bagi Hasil Terus Bertumbuh
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 3. TREN PENDAPATAN HARIAN */}
            <div className="bg-white/70 backdrop-blur-md border border-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-suka-orange/5 hover:bg-white/90 transition-colors duration-500">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-8 rounded-full bg-suka-orange" />
                <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Tren Pendapatan Harian Outlet</h2>
              </div>
              <RevenueTrendChart 
                rows={trendOutletKpi} 
                isHourly={false} 
                className="w-full"
              />
            </div>

            {/* 4. COMPREHENSIVE REAL-TIME P&L SECTION */}
            {pnlData && (
              <MitraProfitLossSection
                pnlData={pnlData}
                currentFilter={{
                  ...currentFilter,
                  outletId: selectedOutletId || currentFilter.outletId || (outlets.length === 1 ? outlets[0].id : 'all')
                }}
                onFilterChange={handleFilterChange}
                isLoading={isPnlLoading}
                outlets={outlets}
              />
            )}

            {/* 5. RIWAYAT TRANSFER BAGI HASIL BULANAN */}
            <div className="bg-white/70 backdrop-blur-md border border-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-suka-orange/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
                    <ArrowRightLeft className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">
                      Riwayat Transfer Bagi Hasil Bulanan
                    </h2>
                    <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
                      Daftar dan bukti transfer resmi bagi hasil yang telah dikirim oleh Admin Pusat
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 w-fit">
                  {filteredTransfers.length} Bukti Transfer
                </span>
              </div>

              {filteredTransfers.length === 0 ? (
                <div className="p-8 text-center bg-suka-gray-50/60 rounded-2xl border border-dashed border-suka-gray-200 text-xs text-suka-gray-400">
                  Belum ada riwayat transfer bagi hasil tercatat untuk outlet ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTransfers.map((t) => (
                    <div 
                      key={t.id} 
                      className="p-5 bg-white rounded-2xl border border-suka-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="text-[10px] font-bold text-suka-gray-400 uppercase tracking-wider block">
                            Periode Bagi Hasil
                          </span>
                          <span className="font-extrabold text-sm text-suka-brown">
                            {new Date(t.bulan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                        <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                          <FileText className="w-4 h-4" />
                        </span>
                      </div>

                      <div className="py-2 border-t border-b border-dashed border-suka-gray-100 mb-4">
                        <span className="text-[10px] text-suka-gray-400 font-bold block uppercase">Nominal Ditransfer</span>
                        <span className="font-black text-lg text-emerald-600">
                          {formatRupiah(t.nominal)}
                        </span>
                        {t.catatan && (
                          <p className="text-[11px] text-suka-gray-500 italic mt-1">{t.catatan}</p>
                        )}
                      </div>

                      <button
                        onClick={() => handleDownloadTransfer(t.bukti_url)}
                        className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 font-bold text-xs rounded-xl transition-colors border border-blue-200 hover:border-blue-600 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Buka / Unduh Bukti Transfer</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. TIM & KRU OUTLET */}
            <div className="bg-white/70 backdrop-blur-md border border-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-suka-orange/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">
                    Tim & Kru Pengelola Outlet
                  </h2>
                  <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
                    Daftar personel Leader dan Crew aktif yang bertugas di outlet Anda
                  </p>
                </div>
              </div>

              {filteredStaff.length === 0 ? (
                <div className="p-8 text-center bg-suka-gray-50/60 rounded-2xl border border-dashed border-suka-gray-200 text-xs text-suka-gray-400">
                  Belum ada data staf terdaftar di outlet ini.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredStaff.map((s) => (
                    <div 
                      key={s.id} 
                      className="p-4 bg-white rounded-2xl border border-suka-gray-100 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-all group"
                    >
                      <div className="w-12 h-12 rounded-full bg-suka-orange/10 flex items-center justify-center text-suka-orange mb-3 border border-suka-orange/20 group-hover:scale-110 transition-transform">
                        <UserCircle className="w-7 h-7" />
                      </div>
                      <h4 className="font-extrabold text-xs text-suka-brown truncate w-full mb-1">
                        {s.name || 'Staf Outlet'}
                      </h4>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-suka-orange/10 text-suka-orange mb-2">
                        {s.role?.replace('_', ' ')}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold rounded-full ${
                        s.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {s.status === 'active' ? '● Aktif Bertugas' : 'Nonaktif'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 7. ORDERAN TERKINI & TOP MENU */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Orderan Terkini (2 Cols) */}
              <div className="lg:col-span-2 bg-white/70 backdrop-blur-md border border-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-suka-orange/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-suka-orange/10 text-suka-orange rounded-xl">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-suka-brown tracking-tight">Orderan Terkini Outlet</h3>
                        <p className="text-xs text-suka-gray-400">10 transaksi terbaru yang selesai</p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-suka-gray-100 space-y-2">
                    {filteredOrders.slice(0, 7).map((ord) => (
                      <div key={ord.id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-suka-gray-50 flex items-center justify-center font-mono font-bold text-[10px] text-suka-gray-500 shrink-0">
                            #{ord.receipt_number ? ord.receipt_number.slice(-4) : 'ORD'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-suka-brown block truncate">
                              {ord.customer_name || 'Pelanggan Walk-in'}
                            </span>
                            <span className="text-[10px] text-suka-gray-400">
                              {new Date(ord.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {new Date(ord.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-3">
                          <OrderSourceBadge source={ord.sales_source || 'pos'} />
                          <span className="font-black text-suka-brown text-sm">
                            {formatRupiah(ord.total_amount)}
                          </span>
                        </div>
                      </div>
                    ))}

                    {filteredOrders.length === 0 && (
                      <div className="p-8 text-center text-xs text-suka-gray-400">
                        Belum ada orderan terbaru pada outlet ini.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Menu Terlaris (1 Col) */}
              <div className="bg-white/70 backdrop-blur-md border border-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-suka-orange/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-suka-brown tracking-tight">Menu Terlaris</h3>
                    <p className="text-xs text-suka-gray-400">Top seller outlet</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {(topMenus || []).slice(0, 5).map((m: any, i: number) => (
                    <div key={i} className="p-3 bg-white rounded-xl border border-suka-gray-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="w-5 h-5 rounded-full bg-suka-orange/10 text-suka-orange font-black text-[10px] flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-bold text-suka-brown truncate">{m.name}</span>
                      </div>
                      <span className="font-black text-suka-orange shrink-0">
                        {m.quantity || m.qty || 0} Porsi
                      </span>
                    </div>
                  ))}

                  {(!topMenus || topMenus.length === 0) && (
                    <div className="p-8 text-center text-xs text-suka-gray-400">
                      Belum ada data penjualan menu.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* 8. KOTAK SARAN & KOMUNIKASI ADMIN */}
            <div className="bg-white/70 backdrop-blur-md border border-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-suka-orange/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">
                    Kotak Saran & Komunikasi dengan Pusat
                  </h2>
                  <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
                    Kirimkan pertanyaan, kendala, atau saran pengembangan outlet langsung ke Admin Suka Shawarma
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Form Kirim */}
                <div className="lg:col-span-1">
                  <form onSubmit={handleSubmitSaran} className="bg-white p-5 rounded-2xl border border-suka-gray-100 shadow-sm space-y-4">
                    <h4 className="font-bold text-sm text-suka-brown flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-suka-orange" />
                      Tulis Masukan / Pertanyaan
                    </h4>
                    
                    <textarea
                      rows={4}
                      value={isiSaran}
                      onChange={(e) => setIsiSaran(e.target.value)}
                      placeholder="Tulis keluhan operasional, saran promosi, atau pertanyaan seputar bagi hasil..."
                      className="w-full bg-suka-gray-50 border border-suka-gray-200 rounded-xl p-3 text-xs font-medium text-suka-brown focus:ring-2 focus:ring-suka-orange focus:border-suka-orange outline-none resize-none"
                      required
                    />

                    <button
                      type="submit"
                      disabled={isSubmittingSaran || !isiSaran.trim()}
                      className="w-full flex items-center justify-center py-2.5 px-4 bg-gradient-to-r from-suka-orange to-suka-brown hover:from-suka-brown hover:to-suka-ink text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-md shadow-suka-orange/20"
                    >
                      {isSubmittingSaran ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <Send className="w-3.5 h-3.5 mr-2" />
                      )}
                      <span>Kirim ke Admin Pusat</span>
                    </button>
                  </form>
                </div>

                {/* History Tanggapan */}
                <div className="lg:col-span-2 space-y-3">
                  <span className="text-[11px] font-bold text-suka-gray-400 uppercase tracking-wider block">
                    Riwayat Komunikasi & Tanggapan ({saranList.length})
                  </span>

                  <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                    {saranList.map((s) => (
                      <div key={s.id} className="bg-white p-4 rounded-2xl border border-suka-gray-100 shadow-sm space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-suka-gray-400">
                            {new Date(s.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full ${
                            s.status === 'baru' ? 'bg-amber-100 text-amber-800' :
                            s.status === 'dibaca' ? 'bg-blue-100 text-blue-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {s.status}
                          </span>
                        </div>

                        <p className="text-suka-brown font-medium">{s.isi_saran}</p>

                        {s.tanggapan && (
                          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-blue-900 mt-2">
                            <span className="font-bold text-[10px] uppercase text-blue-700 block mb-1">
                              Tanggapan Admin Pusat:
                            </span>
                            <p className="font-medium text-xs">{s.tanggapan}</p>
                          </div>
                        )}
                      </div>
                    ))}

                    {saranList.length === 0 && (
                      <div className="p-8 text-center text-xs text-suka-gray-400 bg-suka-gray-50 rounded-2xl">
                        Belum ada riwayat saran atau pertanyaan yang dikirim.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>

      {/* Biodata & Legalitas Modal */}
      <MitraBiodataModal
        isOpen={isBiodataOpen}
        onClose={() => setIsBiodataOpen(false)}
        biodata={mitra}
        outletNames={outletNamesList}
      />
    </div>
  )
}
