'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Landmark, Banknote, Clock, Search, 
  ArrowUpRight, ArrowDownLeft, Store, ArrowRight,
  Coins, ChevronRight, Filter, Calendar, RotateCcw,
  ChevronDown, ArrowUpDown
} from 'lucide-react'
import NumberFlow from '@number-flow/react'

import { Spinner, EmptyState } from '@suka/design-system'
import { useCashOverview, useCashTransactions } from '@/hooks/useCashData'
import { usePettyCashRequests } from '@/hooks/usePettyCash'
import { useOutlets } from '@/hooks/useOutlets'
import { summarizeBalances, countPendingApproval } from '@/lib/cashSummary'
import { isTestOutlet, isExcludedOutlet } from '@/lib/outletFilters'
import { tanggal, rupiah } from '@/lib/format'
import { TxStatusBadge } from '@/components/ui'
import { TransaksiView } from './transaksi/components/TransaksiView'
import OutletRevenueTab from '@/components/OutletRevenueTab'
import PettyCashExpensesTab from '@/components/PettyCashExpensesTab'
import StokInventoryTab from '@/components/StokInventoryTab'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const itemAnim = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 140, damping: 18 } }
}

export default function DashboardClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') ?? 'overview'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [outletSearch, setOutletSearch] = useState('')

  // Filter States
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'last_7_days' | 'this_month' | 'last_month' | 'custom'>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedOutlet, setSelectedOutlet] = useState('all')
  const [selectedType, setSelectedType] = useState<'all' | 'in' | 'petty_cash' | 'out'>('all')
  const [metricMode, setMetricMode] = useState<'deposit' | 'balance'>('deposit')
  
  // Sync state if URL changes
  useEffect(() => {
    const tab = searchParams.get('tab')
    setActiveTab(tab ?? 'overview')
  }, [searchParams])

  const { locations, isLoading, error } = useCashOverview()
  const { data: txs = [], isLoading: loadingTx } = useCashTransactions(1000)
  const { data: pettyCashRequests } = usePettyCashRequests('forwarded_to_finance')
  const { data: outletList = [] } = useOutlets()

  const summary = summarizeBalances(locations)
  const pending = countPendingApproval(txs)
  const pettyPending = pettyCashRequests?.length || 0
  const totalTasks = pending + pettyPending

  // Filter pusat vs outlet (hilangkan outlet test & outlet nonaktif)
  const pusatLocations = useMemo(() => {
    return locations.filter((l) => l.scope !== 'outlet' && l.is_active !== false)
  }, [locations])

  const outletLocations = useMemo(() => {
    return locations.filter(
      (l) => l.scope === 'outlet' && l.is_active !== false && !isTestOutlet(l.label) && !isExcludedOutlet(l.label)
    )
  }, [locations])

  const isFiltered = datePreset !== 'all' || selectedOutlet !== 'all' || selectedType !== 'all' || !!customStartDate || !!customEndDate

  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset as any)
    const now = new Date()
    if (preset === 'today') {
      const d = formatLocalDate(now)
      setCustomStartDate(d)
      setCustomEndDate(d)
    } else if (preset === 'last_7_days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      setCustomStartDate(formatLocalDate(past))
      setCustomEndDate(formatLocalDate(now))
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setCustomStartDate(formatLocalDate(firstDay))
      setCustomEndDate(formatLocalDate(lastDay))
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      setCustomStartDate(formatLocalDate(firstDay))
      setCustomEndDate(formatLocalDate(lastDay))
    } else if (preset === 'all') {
      setCustomStartDate('')
      setCustomEndDate('')
    }
  }

  const handleResetFilter = () => {
    setDatePreset('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setSelectedOutlet('all')
    setSelectedType('all')
    setOutletSearch('')
  }

  const periodLabel = useMemo(() => {
    if (datePreset === 'today') return 'Hari Ini'
    if (datePreset === 'last_7_days') return '7 Hari Terakhir'
    if (datePreset === 'this_month') return 'Bulan Ini'
    if (datePreset === 'last_month') return 'Bulan Lalu'
    if (customStartDate && customEndDate) {
      if (customStartDate === customEndDate) return customStartDate
      return `${customStartDate} s/d ${customEndDate}`
    }
    if (customStartDate) return `Sejak ${customStartDate}`
    if (customEndDate) return `Sampai ${customEndDate}`
    return 'Semua Waktu'
  }, [datePreset, customStartDate, customEndDate])

  const outletLabel = useMemo(() => {
    if (selectedOutlet === 'all') return 'Semua Cabang'
    if (selectedOutlet === 'pusat_only') return 'Kantor Pusat'
    return selectedOutlet
  }, [selectedOutlet])

  // Filtered transactions for the overview table & calculations
  const filteredTxs = useMemo(() => {
    return txs.filter((t) => {
      // 1. Date filter
      if (customStartDate) {
        const txDate = (t.occurred_at || '').slice(0, 10)
        if (txDate < customStartDate) return false
      }
      if (customEndDate) {
        const txDate = (t.occurred_at || '').slice(0, 10)
        if (txDate > customEndDate) return false
      }

      // 2. Outlet filter
      if (selectedOutlet !== 'all') {
        if (selectedOutlet === 'pusat_only') {
          if (t.outlet?.name) return false
        } else {
          const outletName = (t.outlet?.name || '').toLowerCase()
          const selected = selectedOutlet.toLowerCase()
          if (!outletName.includes(selected)) return false
        }
      }

      // 3. Type filter
      if (selectedType === 'in') {
        if (t.direction !== 'in') return false
      } else if (selectedType === 'petty_cash') {
        if (t.source_type !== 'petty_cash_topup') return false
      } else if (selectedType === 'out') {
        if (t.direction !== 'out') return false
      }

      return true
    })
  }, [txs, customStartDate, customEndDate, selectedOutlet, selectedType])

  // Setoran masuk (direction: 'in') yang difilter oleh Periode Tanggal & Cabang
  const depositStats = useMemo(() => {
    let list = txs.filter((t) => t.direction === 'in')

    if (customStartDate) {
      list = list.filter((t) => (t.occurred_at || '').slice(0, 10) >= customStartDate)
    }
    if (customEndDate) {
      list = list.filter((t) => (t.occurred_at || '').slice(0, 10) <= customEndDate)
    }
    if (selectedOutlet !== 'all') {
      if (selectedOutlet === 'pusat_only') {
        list = list.filter((t) => !t.outlet?.name)
      } else {
        const selected = selectedOutlet.toLowerCase()
        list = list.filter((t) => (t.outlet?.name || '').toLowerCase().includes(selected))
      }
    }

    const bankList = list.filter((t) => t.cash_location?.kind === 'bank')
    const cashList = list.filter((t) => t.cash_location?.kind === 'cash')

    return {
      bankTotal: bankList.reduce((sum, t) => sum + (t.amount || 0), 0),
      bankCount: bankList.length,
      cashTotal: cashList.reduce((sum, t) => sum + (t.amount || 0), 0),
      cashCount: cashList.length,
    }
  }, [txs, customStartDate, customEndDate, selectedOutlet])

  // Total mutasi masuk tercatat sepanjang waktu (all-time in)
  const allTimeStats = useMemo(() => {
    const bankList = txs.filter((t) => t.direction === 'in' && t.cash_location?.kind === 'bank')
    const cashList = txs.filter((t) => t.direction === 'in' && t.cash_location?.kind === 'cash')
    return {
      bankTotal: bankList.reduce((sum, t) => sum + (t.amount || 0), 0),
      bankCount: bankList.length,
      cashTotal: cashList.reduce((sum, t) => sum + (t.amount || 0), 0),
      cashCount: cashList.length,
    }
  }, [txs])

  const selectedOutletLocation = useMemo(() => {
    if (selectedOutlet === 'all' || selectedOutlet === 'pusat_only') return null
    return outletLocations.find((l) => l.label.toLowerCase().includes(selectedOutlet.toLowerCase()))
  }, [outletLocations, selectedOutlet])

  // Mode tampilan nilai card:
  // Jika filter aktif, otomatis tampilkan nilai uang yang disetor pada filter tersebut.
  // User juga bisa bebas toggle antara "Uang Telah Disetor" vs "Saldo Rekening & Kas".
  const isShowingDeposit = metricMode === 'deposit' || (isFiltered && metricMode !== 'balance')

  const bankCardValue = isShowingDeposit 
    ? (isFiltered ? depositStats.bankTotal : (allTimeStats.bankTotal > 0 ? allTimeStats.bankTotal : summary.totalBank))
    : summary.totalBank

  const cashCardValue = isShowingDeposit 
    ? (isFiltered ? depositStats.cashTotal : (allTimeStats.cashTotal > 0 ? allTimeStats.cashTotal : summary.totalCashPusat))
    : summary.totalCashPusat

  const filteredOutlets = useMemo(() => {
    let list = outletLocations
    if (selectedOutlet !== 'all' && selectedOutlet !== 'pusat_only') {
      const q = selectedOutlet.toLowerCase()
      list = list.filter((o) => o.label.toLowerCase().includes(q))
    }
    if (!outletSearch.trim()) return list
    const q = outletSearch.toLowerCase()
    return list.filter((o) => o.label.toLowerCase().includes(q))
  }, [outletLocations, outletSearch, selectedOutlet])

  // Notification flag & sound on new tasks
  const prevTasksRef = useRef(totalTasks)
  useEffect(() => {
    if (totalTasks > 0) {
      document.title = `(${totalTasks}) SS Digital Treasury`
    } else {
      document.title = 'SS Digital Dashboard'
    }

    if (totalTasks > prevTasksRef.current) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(audioCtx.destination)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime)
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
        oscillator.start()
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5)
        oscillator.stop(audioCtx.currentTime + 0.5)
      } catch (e) {
        console.warn('Could not play notification sound', e)
      }
    }
    prevTasksRef.current = totalTasks
  }, [totalTasks])

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Gagal memuat data kas: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans text-suka-ink bg-suka-cream min-h-screen -mx-4 sm:-mx-6 -mt-6 sm:-mt-8 pb-20">
      
      {/* Clean & Informative Executive Header */}
      <header className="bg-gradient-to-r from-suka-primary via-suka-primary to-suka-brown text-white p-6 md:p-8 rounded-b-[36px] shadow-lg shadow-suka-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-10 w-36 h-36 bg-suka-brown opacity-20 rounded-full blur-xl"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 100 }}>
            <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-wider mb-1.5">
              <span>Perbendaharaan &amp; Treasury</span>
              <span>•</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] text-white">Posisi Likuiditas</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl tracking-wide font-bold">Ringkasan Kas &amp; Setoran</h1>
            <p className="text-white/75 text-xs md:text-sm mt-1">
              Konsolidasi uang penjualan yang telah disetor ke rekening bank (BCA) dan disetor cash ke kantor pusat
            </p>
          </motion.div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'overview', label: 'Overview Kas' },
            { id: 'transaksi', label: 'Transaksi Manual' },
            { id: 'tugas', label: 'Tugas Approval', badge: totalTasks > 0 ? totalTasks : undefined },
            { id: 'omzet', label: 'Omzet Outlet' },
            { id: 'petty-cash', label: 'Petty Cash Outlet' },
            { id: 'stok', label: 'Stok & Persediaan' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                const url = tab.id === 'overview' ? '/' : `/?tab=${tab.id}`
                window.history.pushState(null, '', url)
              }}
              className="relative px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold capitalize transition-colors whitespace-nowrap flex items-center gap-2 shadow-sm"
            >
              {activeTab === tab.id ? (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-suka-brown rounded-full shadow-md"
                  transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                />
              ) : (
                <div className="absolute inset-0 bg-white rounded-full border border-suka-brown/10 hover:border-suka-brown/25" />
              )}
              <span className={`relative z-10 ${activeTab === tab.id ? 'text-white' : 'text-suka-ink/70 hover:text-suka-ink'}`}>
                {tab.label}
              </span>
              {tab.badge !== undefined && (
                <span className={`relative z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-suka-orange text-white' 
                    : 'bg-red-500 text-white'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              variants={container}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -15, transition: { duration: 0.15 } }}
              className="space-y-6"
            >
              {/* Comprehensive Filter Bar */}
              <motion.div 
                variants={itemAnim}
                className="bg-white rounded-3xl p-5 shadow-sm border border-suka-brown/5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-suka-brown/5">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-suka-orange/10 p-2 rounded-2xl text-suka-orange">
                      <Filter size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-suka-ink">Filter Data Kas &amp; Mutasi</h4>
                      <p className="text-[11px] text-suka-gray-400">Filter berdasarkan periode tanggal, cabang outlet, dan jenis aliran dana</p>
                    </div>
                  </div>

                  {isFiltered && (
                    <button
                      onClick={handleResetFilter}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      <RotateCcw size={13} />
                      <span>Reset Filter</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* 1. Periode Preset */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1.5">
                      Periode Tanggal
                    </label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
                      <select
                        value={datePreset}
                        onChange={(e) => handlePresetChange(e.target.value)}
                        className="w-full pl-8 pr-8 py-2 text-xs font-semibold rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:border-suka-primary/40 focus:bg-white transition-all appearance-none cursor-pointer"
                      >
                        <option value="all">Semua Waktu (Saldo Realtime)</option>
                        <option value="today">Hari Ini</option>
                        <option value="last_7_days">7 Hari Terakhir</option>
                        <option value="this_month">Bulan Ini</option>
                        <option value="last_month">Bulan Lalu</option>
                        <option value="custom">Kustom Tanggal...</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* 2. Cabang / Outlet Filter */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1.5">
                      Cabang / Outlet
                    </label>
                    <div className="relative">
                      <Store size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
                      <select
                        value={selectedOutlet}
                        onChange={(e) => setSelectedOutlet(e.target.value)}
                        className="w-full pl-8 pr-8 py-2 text-xs font-semibold rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:border-suka-primary/40 focus:bg-white transition-all appearance-none cursor-pointer truncate"
                      >
                        <option value="all">Semua Cabang &amp; Pusat</option>
                        <option value="pusat_only">Hanya Kantor Pusat (BCA &amp; Kas Setoran)</option>
                        <optgroup label="Daftar Cabang Outlet">
                          {outletList.map((o) => (
                            <option key={o.id} value={o.name}>
                              {o.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* 3. Jenis Transaksi */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1.5">
                      Jenis Aliran Kas
                    </label>
                    <div className="relative">
                      <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
                      <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value as any)}
                        className="w-full pl-8 pr-8 py-2 text-xs font-semibold rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:border-suka-primary/40 focus:bg-white transition-all appearance-none cursor-pointer"
                      >
                        <option value="all">Semua Aliran Kas</option>
                        <option value="in">Uang Masuk / Setoran Outlet</option>
                        <option value="petty_cash">Pencairan Kas Kecil (Topup)</option>
                        <option value="out">Semua Pengeluaran / Outflow</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* 4. Custom Date Range Inputs atau Status Filter */}
                  {datePreset === 'custom' ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1.5">Dari</label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:bg-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1.5">Sampai</label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:bg-white"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1.5">
                        Status Filter
                      </label>
                      <div className="py-2 px-3 rounded-xl bg-suka-cream/80 border border-suka-brown/5 text-xs text-suka-brown font-semibold flex items-center justify-between">
                        <span>{isFiltered ? 'Filter Aktif' : 'Default Realtime'}</span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-suka-primary font-bold shadow-xs">
                          {filteredTxs.length} Data
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Header Informasi Filter & Switcher Mode Card */}
              <motion.div variants={itemAnim} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${isFiltered ? 'bg-suka-orange animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                      <span className="text-xs sm:text-sm font-bold text-suka-ink">
                        {isFiltered 
                          ? `Hasil Filter: ${periodLabel} • ${outletLabel}` 
                          : 'Ringkasan Setoran & Saldo Treasury'}
                      </span>
                    </div>
                    {isFiltered && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-suka-orange/10 text-suka-orange border border-suka-orange/20 shadow-2xs">
                        Dinamis
                      </span>
                    )}
                  </div>

                  <div className="inline-flex p-1 rounded-2xl bg-white border border-suka-brown/10 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setMetricMode('deposit')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isShowingDeposit
                          ? 'bg-suka-brown text-white shadow-xs'
                          : 'text-suka-gray-500 hover:text-suka-ink'
                      }`}
                    >
                      Uang Telah Disetor
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetricMode('balance')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        !isShowingDeposit
                          ? 'bg-suka-brown text-white shadow-xs'
                          : 'text-suka-gray-500 hover:text-suka-ink'
                      }`}
                    >
                      Posisi Saldo Realtime
                    </button>
                  </div>
                </div>

                {/* Banner Info Cabang Terpilih (jika spesifik outlet difilter) */}
                {selectedOutletLocation && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <Store size={16} className="text-emerald-700" />
                      <span>Cabang Terpilih: <b>{selectedOutletLocation.label}</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-700 font-medium">Saldo Petty Cash Cabang Saat Ini:</span>
                      <span className="font-extrabold text-sm text-emerald-800 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200 shadow-2xs">
                        {rupiah(selectedOutletLocation.saldo)}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* 2 Main Metric Cards: Uang yang telah disetor ke bank & Uang yang telah disetor cash */}
              <motion.div variants={itemAnim} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* 1. Uang yang Telah Disetor ke Bank */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl">
                      <Landmark size={24} />
                    </div>
                    <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border ${
                      isShowingDeposit
                        ? (isFiltered ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-blue-50 text-blue-700 border-blue-200')
                        : 'bg-suka-cream text-suka-brown border-suka-brown/20'
                    }`}>
                      {isShowingDeposit
                        ? (isFiltered ? `SETORAN BANK (${periodLabel.toUpperCase()})` : 'TOTAL SETORAN BANK')
                        : 'SALDO REKENING BANK'}
                    </span>
                  </div>

                  <p className="text-suka-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                    Uang yang telah di setor ke bank
                  </p>

                  <h3 className="font-display text-3xl sm:text-4xl text-suka-ink font-bold flex items-baseline">
                    <span className="text-base mr-1 font-sans font-bold text-suka-gray-400">Rp</span>
                    <NumberFlow value={bankCardValue} />
                  </h3>

                  <div className="mt-2 text-xs text-suka-gray-500 font-medium min-h-[20px]">
                    {isShowingDeposit ? (
                      isFiltered ? (
                        <span>
                          {depositStats.bankCount > 0 
                            ? `✓ ${depositStats.bankCount} transaksi disetor ke BCA pada periode ini`
                            : `Belum ada setoran masuk ke BCA pada periode ${periodLabel.toLowerCase()}`}
                        </span>
                      ) : (
                        <span>{allTimeStats.bankCount} transaksi masuk tercatat di rekening BCA</span>
                      )
                    ) : (
                      <span>BCA 48523399425 · PT SUKA PROFIT BERKAH</span>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-suka-brown/5 flex items-center justify-between text-xs text-suka-gray-400">
                    <span>
                      {isShowingDeposit ? (
                        <>Saldo BCA saat ini: <b className="text-suka-ink font-semibold">{rupiah(summary.totalBank)}</b></>
                      ) : (
                        <>Setoran masuk ({periodLabel}): <b className="text-suka-ink font-semibold">{rupiah(depositStats.bankTotal)}</b></>
                      )}
                    </span>
                    <span className="font-semibold text-blue-600">BCA Pusat</span>
                  </div>
                </div>

                {/* 2. Uang yang Telah Disetor Cash */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-orange-50 text-suka-orange p-3 rounded-2xl">
                      <Banknote size={24} />
                    </div>
                    <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border ${
                      isShowingDeposit
                        ? (isFiltered ? 'bg-suka-orange text-white border-suka-orange shadow-xs' : 'bg-orange-50 text-suka-orange border-orange-200')
                        : 'bg-suka-cream text-suka-brown border-suka-brown/20'
                    }`}>
                      {isShowingDeposit
                        ? (isFiltered ? `SETORAN CASH (${periodLabel.toUpperCase()})` : 'TOTAL SETORAN CASH')
                        : 'SALDO KAS FISIK'}
                    </span>
                  </div>

                  <p className="text-suka-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                    Uang yang telah di setor cash
                  </p>

                  <h3 className="font-display text-3xl sm:text-4xl text-suka-ink font-bold flex items-baseline">
                    <span className="text-base mr-1 font-sans font-bold text-suka-gray-400">Rp</span>
                    <NumberFlow value={cashCardValue} />
                  </h3>

                  <div className="mt-2 text-xs text-suka-gray-500 font-medium min-h-[20px]">
                    {isShowingDeposit ? (
                      isFiltered ? (
                        <span>
                          {depositStats.cashCount > 0 
                            ? `✓ ${depositStats.cashCount} transaksi disetor tunai pada periode ini`
                            : `Belum ada setoran cash fisik pada periode ${periodLabel.toLowerCase()}`}
                        </span>
                      ) : (
                        <span>{allTimeStats.cashCount} transaksi tunai tercatat di kas fisik pusat</span>
                      )
                    ) : (
                      <span>Kas Setoran Tunai / Brankas Kantor Pusat</span>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-suka-brown/5 flex items-center justify-between text-xs text-suka-gray-400">
                    <span>
                      {isShowingDeposit ? (
                        <>Saldo fisik pusat saat ini: <b className="text-suka-ink font-semibold">{rupiah(summary.totalCashPusat)}</b></>
                      ) : (
                        <>Setoran tunai ({periodLabel}): <b className="text-suka-ink font-semibold">{rupiah(depositStats.cashTotal)}</b></>
                      )}
                    </span>
                    <span className="font-semibold text-suka-orange">Brankas Pusat</span>
                  </div>
                </div>

              </motion.div>

              {/* Two Column Section: Aktivitas Terbaru (Kiri) & Rincian Saldo Kas (Kanan) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Kolom Kiri: Aktivitas Mutasi Kas Terbaru */}
                <motion.div variants={itemAnim} className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-suka-brown/5">
                  <div className="flex items-center justify-between mb-5 pb-3 border-b border-suka-brown/5">
                    <div>
                      <h3 className="font-display text-xl text-suka-brown font-bold">Aktivitas Mutasi Kas</h3>
                      <p className="text-xs text-suka-gray-400 mt-0.5">
                        {isFiltered ? `Menampilkan ${filteredTxs.length} transaksi sesuai filter` : 'Riwayat transaksi dana masuk dan keluar terbaru'}
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('transaksi')} 
                      className="text-xs font-bold text-suka-primary hover:text-suka-primary/80 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-full hover:bg-suka-orange/5"
                    >
                      <span>Lihat Semua</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {loadingTx ? (
                      <div className="flex justify-center py-12"><Spinner size={28} /></div>
                    ) : filteredTxs.length === 0 ? (
                      <div className="py-10 text-center space-y-3">
                        <EmptyState title="Tidak ada mutasi kas yang cocok" description="Coba ubah atau reset filter untuk menampilkan data lainnya." />
                        {isFiltered && (
                          <button
                            onClick={handleResetFilter}
                            className="px-4 py-2 rounded-full text-xs font-bold text-suka-primary bg-suka-primary/10 hover:bg-suka-primary/20 transition-colors"
                          >
                            Reset Filter
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredTxs.slice(0, 10).map((t) => {
                        const isOut = t.direction === 'out'
                        const isPettyCash = t.source_type === 'petty_cash_topup'
                        const isDeposit = t.source_type === 'cash_deposit'
                        const isTransfer = t.source_type === 'transfer'

                        let displayTitle = t.category || 'Mutasi Kas'
                        if (isPettyCash) {
                          displayTitle = `Pencairan Kas Kecil • ${t.outlet?.name || 'Cabang'}`
                        } else if (isDeposit) {
                          displayTitle = `Setoran Penjualan • ${t.outlet?.name || 'Kasir Cabang'}`
                        } else if (isTransfer) {
                          displayTitle = t.note ? `Transfer: ${t.note}` : 'Transfer Saldo Antar Kas'
                        } else if (t.source_type === 'payroll') {
                          displayTitle = 'Disbursement Gaji Karyawan'
                        } else if (t.source_type === 'supplier_po') {
                          displayTitle = 'Pembayaran Supplier PO'
                        }

                        const detailNote = t.topup_description || t.note
                        const sourceAccount = t.cash_location?.label || 'Rekening Perusahaan'

                        return (
                          <div 
                            key={t.id} 
                            className="p-3 rounded-2xl hover:bg-suka-gray-50/80 transition-colors border border-transparent hover:border-suka-brown/5 flex items-start justify-between gap-3"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                                isOut ? 'bg-orange-50 text-suka-orange' : 'bg-emerald-50 text-emerald-600'
                              }`}>
                                {isOut ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-suka-ink text-sm truncate">
                                  {displayTitle}
                                </p>
                                {detailNote && (
                                  <p className="text-xs text-suka-gray-500 line-clamp-1 mt-0.5">
                                    {detailNote}
                                  </p>
                                )}
                                <p className="text-[10px] font-semibold text-suka-gray-400 mt-1">
                                  {sourceAccount} • {tanggal(t.occurred_at)}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className={`block font-black text-sm ${isOut ? 'text-suka-ink' : 'text-emerald-600'}`}>
                                {isOut ? '−' : '+'}{rupiah(t.amount)}
                              </span>
                              <div className="mt-1">
                                {t.status === 'paid' ? (
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isOut 
                                      ? 'bg-suka-gray-100 text-suka-gray-700 border border-suka-gray-200' 
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    {isOut ? 'Tercairkan' : 'Diterima'}
                                  </span>
                                ) : (
                                  <TxStatusBadge status={t.status} />
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </motion.div>

                {/* Kolom Kanan: Rincian Saldo Kas & Rekening */}
                <motion.div variants={itemAnim} className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-suka-brown/5 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-suka-brown/5">
                    <div>
                      <h3 className="font-display text-xl text-suka-brown font-bold">Rincian Saldo</h3>
                      <p className="text-xs text-suka-gray-400 mt-0.5">Posisi kas di pusat &amp; masing-masing cabang</p>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="flex justify-center py-12"><Spinner size={28} /></div>
                  ) : (
                    <>
                      {/* Section A: Kas & Rekening Kantor Pusat */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-500">
                            1. Kas &amp; Bank Kantor Pusat
                          </span>
                          <span className="text-xs font-bold text-suka-brown">
                            {rupiah(summary.totalPusat)}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {pusatLocations.map((p) => (
                            <div 
                              key={p.id}
                              className="flex items-center justify-between p-3 rounded-2xl bg-suka-cream/60 border border-suka-brown/5"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border shrink-0 ${
                                  p.kind === 'bank' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-suka-orange border-orange-200'
                                }`}>
                                  {p.kind === 'bank' ? 'BANK' : 'KAS FISIK'}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-bold text-sm text-suka-ink truncate">{p.label}</p>
                                  {p.bank_name && (
                                    <p className="text-[10px] text-suka-gray-400 font-semibold">{p.bank_name} • {p.account_no}</p>
                                  )}
                                </div>
                              </div>
                              <span className="font-bold text-sm text-suka-brown shrink-0">
                                {rupiah(p.saldo)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Section B: Kas Operasional Cabang (Petty Cash) */}
                      <div className="pt-3 border-t border-suka-brown/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-suka-gray-500 flex items-center gap-1.5">
                            <Store size={14} className="text-emerald-600" />
                            <span>2. Kas Kecil Cabang ({filteredOutlets.length} Outlet)</span>
                          </span>
                          <span className="text-xs font-bold text-emerald-700">
                            {rupiah(summary.totalOutletCash)}
                          </span>
                        </div>

                        {/* Search outlet box */}
                        <div className="relative mb-3">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400" />
                          <input 
                            type="text" 
                            value={outletSearch}
                            onChange={(e) => setOutletSearch(e.target.value)}
                            placeholder="Cari cabang outlet..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:border-suka-primary/40 focus:bg-white transition-all placeholder:text-suka-gray-400"
                          />
                        </div>

                        <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                          {filteredOutlets.length === 0 ? (
                            <div className="text-center py-6 text-xs text-suka-gray-400">
                              {outletSearch ? 'Tidak ada cabang yang cocok dengan pencarian' : 'Tidak ada cabang aktif'}
                            </div>
                          ) : (
                            filteredOutlets.map((o) => (
                              <div 
                                key={o.id}
                                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-suka-cream/50 transition-colors border border-transparent hover:border-suka-brown/5"
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-bold text-xs text-suka-ink truncate">{o.label}</p>
                                  {o.saldo === 0 && (
                                    <span className="inline-block text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 rounded mt-0.5">
                                      Saldo Rp 0 (Perlu Topup)
                                    </span>
                                  )}
                                </div>
                                <span className={`font-bold text-xs shrink-0 ${o.saldo === 0 ? 'text-suka-gray-400' : 'text-suka-brown'}`}>
                                  {rupiah(o.saldo)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>

              </div>
            </motion.div>
          )}

          {/* Tab Transaksi Manual */}
          {activeTab === 'transaksi' && (
            <motion.div
              key="transaksi"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15, transition: { duration: 0.15 } }}
            >
              <TransaksiView 
                initialLocations={locations}
                initialTxs={txs}
              />
            </motion.div>
          )}

          {/* Tab Tugas Approval */}
          {activeTab === 'tugas' && (
            <motion.div 
              key="tugas"
              variants={container}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -15, transition: { duration: 0.15 } }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-6"
            >
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 flex flex-col justify-between">
                <div>
                  <div className="bg-red-50 text-red-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                    <Clock size={24} />
                  </div>
                  <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider">Menunggu Approval Transaksi Manual</p>
                  <h3 className="font-display text-4xl text-suka-ink mt-2 font-bold">
                    <NumberFlow value={pending} />
                  </h3>
                  <p className="text-xs text-suka-gray-400 mt-2">Transaksi manual yang memerlukan persetujuan checker sebelum masuk saldo.</p>
                </div>
                <div className="mt-6 pt-4 border-t border-suka-brown/5">
                  <button 
                    onClick={() => setActiveTab('transaksi')} 
                    className="w-full py-2.5 px-4 rounded-xl bg-suka-cream hover:bg-suka-primary/10 text-suka-brown font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>Buka Transaksi Manual</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-suka-brown/5 flex flex-col justify-between">
                <div>
                  <div className="bg-orange-50 text-suka-orange w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                    <Coins size={24} />
                  </div>
                  <p className="text-suka-ink/60 text-xs font-bold uppercase tracking-wider">Pengajuan Petty Cash Menunggu Finance</p>
                  <h3 className="font-display text-4xl text-suka-ink mt-2 font-bold">
                    <NumberFlow value={pettyPending} />
                  </h3>
                  <p className="text-xs text-suka-gray-400 mt-2">Permintaan topup kas kecil cabang yang telah diverifikasi Korlap dan siap dicairkan Finance.</p>
                </div>
                <div className="mt-6 pt-4 border-t border-suka-brown/5">
                  <button 
                    onClick={() => router.push('/petty-cash')} 
                    className="w-full py-2.5 px-4 rounded-xl bg-suka-orange hover:bg-suka-orange/90 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <span>Proses Pencairan di Menu Petty Cash</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tab Omzet Outlet */}
          {activeTab === 'omzet' && (
            <motion.div
              key="omzet"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 120, damping: 15 }}
            >
              <OutletRevenueTab />
            </motion.div>
          )}

          {/* Tab Stok & Persediaan */}
          {activeTab === 'stok' && (
            <motion.div
              key="stok"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 120, damping: 15 }}
            >
              <StokInventoryTab />
            </motion.div>
          )}

          {/* Tab Petty Cash Outlet */}
          {activeTab === 'petty-cash' && (
            <motion.div
              key="petty-cash"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 120, damping: 15 }}
            >
              <PettyCashExpensesTab />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
