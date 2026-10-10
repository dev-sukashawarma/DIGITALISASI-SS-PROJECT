'use client'

import { useState, useEffect, useTransition } from 'react'
import CountUp from 'react-countup'
import { 
  TrendingUp, 
  DollarSign, 
  Store, 
  Activity, 
  Clock, 
  CreditCard,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  RefreshCw
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { PeriodFilterValue } from '@/lib/types'
import { useMitraOutlet } from './MitraOutletContext'
import { useOwnerDashboardRealtime } from '@/hooks/useOwnerDashboardRealtime'
import { previousRange, monthRange } from '@/lib/period'
import { getMitraRoiStats } from '@/app/actions/mitraRoi'
import { getMitraComprehensivePnl, type ComprehensiveMitraPnl } from '@/app/actions/mitraPnl'
import { MitraBiodataModal } from './MitraBiodataModal'
import { MitraProfitLossSection } from './MitraProfitLossSection'

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
  curKpiRows: _curKpiRows = [],
  prevKpiRows: _prevKpiRows = [],
  trendKpiRows = [],
  currentFilter,
  topMenus: _topMenus = [],
  initialTransfers: _initialTransfers = [],
  initialStaff: _initialStaff = [],
  initialRoiStats = { roi: 0, bepPercentage: 0 },
  isAdminMode = false,
  allMitraProfiles = [],
  lastUpdated,
}: any) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { selectedOutletId, setSelectedOutletId } = useMitraOutlet()
  
  const allowedOutletIds = (outlets || []).map((o: any) => o.id)

  const [isBiodataOpen, setIsBiodataOpen] = useState(false)
  const [pnlData, setPnlData] = useState<ComprehensiveMitraPnl | null>(null)
  const [isPnlLoading, setIsPnlLoading] = useState(true)
  const [refreshCount, setRefreshCount] = useState(0)
  // Periode yang ditampilkan: periode utama, pembanding (▲▼%), dan tren
  // bulanan (filter 1 hari → seluruh bulan itu).
  const mitraRange = (() => {
    const from = currentFilter?.from
    const to = currentFilter?.to
    if (!from || !to) return null
    const prevFrom = previousRange({ from, to }).from
    const monthStart = `${from.slice(0, 8)}01`
    const monthEnd = monthRange(Number(from.slice(0, 4)), Number(from.slice(5, 7))).to
    return {
      from: prevFrom < monthStart ? prevFrom : monthStart,
      to: monthEnd > to ? monthEnd : to,
    }
  })()

  // Order hari ini selalu memicu refresh (daftar "order terbaru" ada di sini),
  // dibatasi paling sering sekali per 20 detik; tidak lagi membuang seluruh cache.
  useOwnerDashboardRealtime({
    channelName: 'mitra-sales-realtime-view',
    relevantFrom: mitraRange?.from ?? '0000-01-01',
    relevantTo: mitraRange?.to ?? '9999-12-31',
    alwaysRefreshOnToday: true,
    onRefresh: () => setRefreshCount((c) => c + 1),
  })

  // ROI Stats
  const [roiStats, setRoiStats] = useState<{ roi: number; bepPercentage: number; loading: boolean }>({
    roi: initialRoiStats?.roi || 0,
    bepPercentage: initialRoiStats?.bepPercentage || 0,
    loading: false
  })
  const [isFilterNavigating, setIsFilterNavigating] = useState(false)

  // Reset navigasi filter bila currentFilter props dari server sudah berubah atau transition selesai
  useEffect(() => {
    setIsFilterNavigating(false)
  }, [currentFilter?.from, currentFilter?.to, currentFilter?.outletId])

  useEffect(() => {
    if (!isPending) {
      setIsFilterNavigating(false)
    }
  }, [isPending])

  const isFilterLoading = isFilterNavigating || isPending

  const handleFilterChange = (newFilter: PeriodFilterValue) => {
    if (newFilter.outletId && newFilter.outletId !== selectedOutletId) {
      setSelectedOutletId(newFilter.outletId)
    }
    setIsFilterNavigating(true)
    setIsPnlLoading(true)
    startTransition(() => {
      const params = new URLSearchParams(window.location.search)
      if (newFilter.from) params.set('from', newFilter.from)
      if (newFilter.to) params.set('to', newFilter.to)
      if (newFilter.outletId) params.set('outletId', newFilter.outletId)
      router.push(`?${params.toString()}`)
    })
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
  }, [selectedOutletId, outlets, refreshCount])

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
  }, [selectedOutletId, currentFilter, outlets, refreshCount])

  // Hitung Nilai Investasi
  const currentInvestasi = selectedOutletId && selectedOutletId !== 'all' 
    ? (investasiMap[selectedOutletId] || 0) 
    : Object.values(investasiMap).reduce((sum: number, val: any) => sum + Number(val || 0), 0)

  // Filter baris performa tren harian untuk outlet yang dipilih
  const trendOutletKpi = selectedOutletId === 'all' 
    ? trendKpiRows 
    : trendKpiRows.filter((r: any) => r.outlet_id === selectedOutletId)

  const outletNamesList = (outlets || []).map((o: any) => o.name)

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
        <div className="bg-white/70 backdrop-blur-xl border border-white p-5 sm:p-7 md:p-8 rounded-[32px] shadow-xl shadow-suka-orange/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
          <div className="absolute inset-0 rounded-[32px] overflow-hidden pointer-events-none -z-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-suka-orange/10 rounded-full blur-[60px] translate-x-1/2 -translate-y-1/2" />
          </div>
          
          <div className="space-y-3 w-full md:w-auto">
            {/* Single Unified Verified Badge & Last Updated */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mitra Resmi Terverifikasi</span>
              </span>
              {lastUpdated && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50/80 text-amber-900 border border-amber-200/70 text-xs font-semibold shadow-2xs">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Update: <strong>{formatLastUpdated(lastUpdated)}</strong></span>
                </span>
              )}
            </div>

            {/* Greeting with non-breaking wave emoji */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-suka-brown tracking-tight leading-tight">
              Halo, <span className="text-suka-orange drop-shadow-sm">{mitra?.nama_mitra || 'Mitra'}</span>{' '}
              <span className="inline-block hover:rotate-12 transition-transform cursor-default origin-bottom-right">👋</span>
            </h1>

            {/* Structured Bank Info Micro-card */}
            <div className="pt-0.5">
              <div className="w-full sm:w-auto inline-flex items-center gap-2.5 bg-amber-50/70 border border-amber-200/70 px-3.5 py-2 rounded-2xl shadow-2xs min-h-[50px]">
                <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                </div>
                <div className="text-xs leading-tight min-w-0">
                  <p className="text-[10px] font-extrabold text-amber-800/70 uppercase tracking-wider">Rekening Bagi Hasil</p>
                  <p className="font-extrabold text-suka-brown mt-0.5 truncate">
                    {mitra?.bank_name || 'BCA'}{' '}
                    <span className="font-mono text-suka-orange font-black">{mitra?.bank_account_number || '-'}</span>
                    <span className="text-suka-gray-400 font-normal"> · a.n. {mitra?.bank_account_holder || mitra?.nama_mitra}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Outlet Selector Dropdown (Sama ukuran dan styling dengan box rekening) */}
          {outlets && outlets.length > 0 && (
            <div className="w-full md:w-auto">
              <div className="w-full sm:w-auto min-w-[240px] relative bg-amber-50/70 border border-amber-200/70 hover:border-amber-300 px-3.5 py-2 rounded-2xl shadow-2xs flex items-center gap-2.5 min-h-[50px] transition-all">
                <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Store className="w-3.5 h-3.5 text-amber-700" />
                </div>
                <div className={`flex-1 min-w-0 ${outlets.length > 1 ? 'pr-5' : 'pr-1'} text-xs leading-tight`}>
                  <p className="text-[10px] font-extrabold text-amber-800/70 uppercase tracking-wider">Outlet Aktif</p>
                  {outlets.length > 1 ? (
                    <select 
                      className="w-full bg-transparent text-xs font-extrabold text-suka-brown outline-none cursor-pointer truncate appearance-none mt-0.5"
                      value={selectedOutletId || (outlets.length === 1 ? outlets[0].id : 'all')}
                      onChange={(e) => setSelectedOutletId(e.target.value)}
                    >
                      <option value="all" className="font-bold text-slate-800">
                        Semua Outlet ({outlets.length})
                      </option>
                      {outlets.map((o: any) => (
                        <option key={o.id} value={o.id} className="font-bold text-slate-700">
                          {o.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs font-extrabold text-suka-brown mt-0.5 truncate">
                      {outlets[0]?.name || 'Outlet Kemitraan'}
                    </p>
                  )}
                </div>
                {outlets.length > 1 && (
                  <ChevronDown className="w-3.5 h-3.5 text-amber-700 absolute right-3 pointer-events-none" />
                )}
              </div>
            </div>
          )}
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
            
            {/* 2. COMPREHENSIVE REAL-TIME P&L SECTION */}
            {pnlData && (
              <MitraProfitLossSection
                pnlData={pnlData}
                currentFilter={{
                  ...currentFilter,
                  outletId: selectedOutletId || currentFilter.outletId || (outlets.length === 1 ? outlets[0].id : 'all')
                }}
                onFilterChange={handleFilterChange}
                isLoading={isFilterLoading || isPnlLoading}
                outlets={outlets}
              />
            )}

            {/* 3. METRIK INVESTASI & BEP MITRA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Nilai Investasi & Progres Balik Modal */}
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
                  {isFilterLoading ? (
                    <div className="space-y-3 py-1" aria-busy="true">
                      <div className="h-8 w-44 bg-suka-gray-200/70 rounded-xl animate-pulse" />
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="h-3 w-28 bg-suka-gray-200/60 rounded animate-pulse" />
                          <div className="h-3 w-10 bg-suka-gray-200/60 rounded animate-pulse" />
                        </div>
                        <div className="w-full bg-suka-gray-100 rounded-full h-2.5 overflow-hidden animate-pulse">
                          <div className="h-full bg-suka-orange/30 w-1/2 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* Card 2: ROI Aktual & Bagi Hasil */}
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
                  {isFilterLoading ? (
                    <div className="space-y-2.5 py-1" aria-busy="true">
                      <div className="h-8 w-32 bg-suka-gray-200/70 rounded-xl animate-pulse" />
                      <div className="h-4 w-44 bg-suka-gray-100/80 rounded-md animate-pulse" />
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* 4. TREN PENDAPATAN HARIAN OUTLET */}
            <div className="bg-white/70 backdrop-blur-md border border-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-suka-orange/5 hover:bg-white/90 transition-colors duration-500">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full bg-suka-orange" />
                  <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Tren Pendapatan Harian Outlet</h2>
                </div>
                {isFilterLoading && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-suka-orange bg-suka-orange/10 px-3 py-1 rounded-full border border-suka-orange/20 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 text-suka-orange animate-spin" />
                    <span>Memperbarui grafik...</span>
                  </span>
                )}
              </div>
              {isFilterLoading ? (
                <div className="w-full h-[300px] rounded-2xl bg-suka-gray-50/70 border border-suka-gray-100/60 p-6 flex flex-col justify-between animate-pulse" aria-busy="true">
                  <div className="flex justify-between items-center text-xs text-suka-gray-300 font-medium">
                    <div className="h-3 w-16 bg-suka-gray-200/60 rounded" />
                    <div className="h-3 w-16 bg-suka-gray-200/60 rounded" />
                  </div>
                  <div className="flex items-end justify-between gap-3 h-44 w-full px-2">
                    {[35, 60, 45, 85, 55, 95, 70, 50, 65, 80, 75, 40].map((h, idx) => (
                      <div key={idx} className="flex-1 bg-gradient-to-t from-suka-orange/20 to-suka-orange/5 rounded-t-lg transition-all" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-suka-gray-100">
                    <div className="h-2.5 w-12 bg-suka-gray-200/50 rounded" />
                    <div className="h-2.5 w-12 bg-suka-gray-200/50 rounded" />
                    <div className="h-2.5 w-12 bg-suka-gray-200/50 rounded" />
                    <div className="h-2.5 w-12 bg-suka-gray-200/50 rounded" />
                    <div className="h-2.5 w-12 bg-suka-gray-200/50 rounded" />
                  </div>
                </div>
              ) : (
                <RevenueTrendChart 
                  rows={trendOutletKpi} 
                  isHourly={false} 
                  className="w-full"
                />
              )}
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
