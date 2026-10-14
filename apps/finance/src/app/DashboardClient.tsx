'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Landmark, Banknote, Search, 
  ArrowUpRight, ArrowDownLeft, Store, ArrowRight,
  Filter, Calendar, RotateCcw,
  ChevronDown, ArrowUpDown
} from 'lucide-react'
import NumberFlow from '@number-flow/react'

import { Spinner, EmptyState } from '@suka/design-system'
import { useCashOverview, useCashTransactions } from '@/hooks/useCashData'
import { useOutlets } from '@/hooks/useOutlets'
import { summarizeBalances } from '@/lib/cashSummary'
import { isTestOutlet, isExcludedOutlet } from '@/lib/outletFilters'
import { tanggal, rupiah } from '@/lib/format'
import { TxStatusBadge } from '@/components/ui'

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
  const [outletSearch, setOutletSearch] = useState('')

  // Filter States
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'last_7_days' | 'this_month' | 'last_month' | 'custom'>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedOutlet, setSelectedOutlet] = useState('all')
  const [selectedType, setSelectedType] = useState<'all' | 'in' | 'petty_cash' | 'out'>('all')
  const [metricMode, setMetricMode] = useState<'deposit' | 'balance'>('deposit')

  const { locations, isLoading, error } = useCashOverview()
  const { data: txs = [], isLoading: loadingTx } = useCashTransactions(1000)
  const { data: outletList = [] } = useOutlets()

  const summary = summarizeBalances(locations)

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

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Gagal memuat data kas: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4 font-sans text-suka-ink pb-8">
      {/* Compact Executive Header & Mode Switcher */}
      <div className="bg-gradient-to-r from-suka-primary via-suka-primary to-suka-brown text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-md shadow-suka-primary/15 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-44 h-44 bg-white opacity-10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-white/85 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Perbendaharaan &amp; Treasury</span>
              <span>•</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] text-white">
                {isFiltered ? `Filter: ${periodLabel} • ${outletLabel}` : 'Posisi Likuiditas'}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl tracking-wide font-bold leading-tight">
              Ringkasan Kas &amp; Setoran
            </h1>
            <p className="text-white/75 text-xs mt-0.5 line-clamp-1">
              Konsolidasi uang penjualan yang telah disetor ke rekening bank (BCA) dan disetor cash ke kantor pusat
            </p>
          </div>

          {/* Mode Tampilan Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-black/20 backdrop-blur-md border border-white/15 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => setMetricMode('deposit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isShowingDeposit
                  ? 'bg-white text-suka-brown shadow-xs'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Uang Telah Disetor
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('balance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isShowingDeposit
                  ? 'bg-white text-suka-brown shadow-xs'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Posisi Saldo Realtime
            </button>
          </div>
        </div>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {/* Compact Filter Bar */}
        <motion.div
          variants={itemAnim}
          className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-sm border border-suka-brown/5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-suka-orange/10 p-1.5 rounded-xl text-suka-orange">
                <Filter size={15} />
              </div>
              <span className="font-bold text-xs sm:text-sm text-suka-ink">Filter Data Kas &amp; Mutasi</span>
              <span className="hidden sm:inline text-[11px] text-suka-gray-400">
                — Periode, cabang outlet, dan jenis aliran dana
              </span>
            </div>

            {isFiltered && (
              <button
                onClick={handleResetFilter}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Periode Preset */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1">
                Periode Tanggal
              </label>
              <div className="relative">
                <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
                <select
                  value={datePreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full pl-7 pr-7 py-1.5 text-xs font-semibold rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:border-suka-primary/40 focus:bg-white transition-all appearance-none cursor-pointer"
                >
                  <option value="all">Semua Waktu (Saldo Realtime)</option>
                  <option value="today">Hari Ini</option>
                  <option value="last_7_days">7 Hari Terakhir</option>
                  <option value="this_month">Bulan Ini</option>
                  <option value="last_month">Bulan Lalu</option>
                  <option value="custom">Kustom Tanggal...</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* 2. Cabang / Outlet Filter */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1">
                Cabang / Outlet
              </label>
              <div className="relative">
                <Store size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
                <select
                  value={selectedOutlet}
                  onChange={(e) => setSelectedOutlet(e.target.value)}
                  className="w-full pl-7 pr-7 py-1.5 text-xs font-semibold rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:border-suka-primary/40 focus:bg-white transition-all appearance-none cursor-pointer truncate"
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
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* 3. Jenis Transaksi */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1">
                Jenis Aliran Kas
              </label>
              <div className="relative">
                <ArrowUpDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as any)}
                  className="w-full pl-7 pr-7 py-1.5 text-xs font-semibold rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:border-suka-primary/40 focus:bg-white transition-all appearance-none cursor-pointer"
                >
                  <option value="all">Semua Aliran Kas</option>
                  <option value="in">Uang Masuk / Setoran Outlet</option>
                  <option value="petty_cash">Pencairan Kas Kecil (Topup)</option>
                  <option value="out">Semua Pengeluaran / Outflow</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* 4. Custom Date Range Inputs atau Status Filter */}
            {datePreset === 'custom' ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1">Dari</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-semibold rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:bg-white"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1">Sampai</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-semibold rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-suka-gray-400 mb-1">
                  Status Filter
                </label>
                <div className="py-1.5 px-3 rounded-xl bg-suka-cream/80 border border-suka-brown/5 text-xs text-suka-brown font-semibold flex items-center justify-between">
                  <span className="truncate">{isFiltered ? 'Filter Aktif' : 'Default Realtime'}</span>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-suka-primary font-bold shadow-2xs shrink-0">
                    {filteredTxs.length} Data
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Banner Info Cabang Terpilih (jika spesifik outlet difilter) */}
          {selectedOutletLocation && (
            <div className="p-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                <Store size={15} className="text-emerald-700" />
                <span>Cabang Terpilih: <b>{selectedOutletLocation.label}</b></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-700 font-medium">Saldo Petty Cash Saat Ini:</span>
                <span className="font-extrabold text-xs text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                  {rupiah(selectedOutletLocation.saldo)}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* 2 Main Metric Cards: Uang yang telah disetor ke bank & Uang yang telah disetor cash */}
        <motion.div variants={itemAnim} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. Uang yang Telah Disetor ke Bank */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-md transition-all">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-xl shrink-0">
                  <Landmark size={18} />
                </div>
                <p className="text-suka-gray-500 text-xs font-bold uppercase tracking-wider truncate">
                  Uang Disetor ke Bank
                </p>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 ${
                isShowingDeposit
                  ? (isFiltered ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' : 'bg-blue-50 text-blue-700 border-blue-200')
                  : 'bg-suka-cream text-suka-brown border-suka-brown/20'
              }`}>
                {isShowingDeposit
                  ? (isFiltered ? `SETORAN BANK (${periodLabel.toUpperCase()})` : 'TOTAL SETORAN BANK')
                  : 'SALDO REKENING BANK'}
              </span>
            </div>

            <h3 className="font-display text-2xl sm:text-3xl text-suka-ink font-bold flex items-baseline tabular-nums">
              <span className="text-sm mr-1 font-sans font-bold text-suka-gray-400">Rp</span>
              <NumberFlow value={bankCardValue} />
            </h3>

            <div className="mt-1.5 text-[11px] text-suka-gray-500 font-medium truncate">
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

            <div className="mt-3 pt-2.5 border-t border-suka-brown/5 flex items-center justify-between text-[11px] text-suka-gray-400">
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
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-suka-brown/5 relative overflow-hidden group hover:shadow-md transition-all">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="bg-orange-50 text-suka-orange p-2 rounded-xl shrink-0">
                  <Banknote size={18} />
                </div>
                <p className="text-suka-gray-500 text-xs font-bold uppercase tracking-wider truncate">
                  Uang Disetor Cash
                </p>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 ${
                isShowingDeposit
                  ? (isFiltered ? 'bg-suka-orange text-white border-suka-orange shadow-2xs' : 'bg-orange-50 text-suka-orange border-orange-200')
                  : 'bg-suka-cream text-suka-brown border-suka-brown/20'
              }`}>
                {isShowingDeposit
                  ? (isFiltered ? `SETORAN CASH (${periodLabel.toUpperCase()})` : 'TOTAL SETORAN CASH')
                  : 'SALDO KAS FISIK'}
              </span>
            </div>

            <h3 className="font-display text-2xl sm:text-3xl text-suka-ink font-bold flex items-baseline tabular-nums">
              <span className="text-sm mr-1 font-sans font-bold text-suka-gray-400">Rp</span>
              <NumberFlow value={cashCardValue} />
            </h3>

            <div className="mt-1.5 text-[11px] text-suka-gray-500 font-medium truncate">
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

            <div className="mt-3 pt-2.5 border-t border-suka-brown/5 flex items-center justify-between text-[11px] text-suka-gray-400">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Kolom Kiri: Aktivitas Mutasi Kas Terbaru */}
          <motion.div variants={itemAnim} className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-suka-brown/5">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-suka-brown/5">
              <div>
                <h3 className="font-display text-lg sm:text-xl text-suka-brown font-bold">Aktivitas Mutasi Kas</h3>
                <p className="text-[11px] text-suka-gray-400">
                  {isFiltered ? `Menampilkan ${filteredTxs.length} transaksi sesuai filter` : 'Riwayat transaksi dana masuk dan keluar terbaru'}
                </p>
              </div>
              <Link 
                href="/transaksi" 
                className="text-xs font-bold text-suka-primary hover:text-suka-primary/80 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-full hover:bg-suka-orange/5"
              >
                <span>Lihat Semua</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="space-y-1.5">
              {loadingTx ? (
                <div className="flex justify-center py-10"><Spinner size={24} /></div>
              ) : filteredTxs.length === 0 ? (
                <div className="py-8 text-center space-y-2.5">
                  <EmptyState title="Tidak ada mutasi kas yang cocok" description="Coba ubah atau reset filter untuk menampilkan data lainnya." />
                  {isFiltered && (
                    <button
                      onClick={handleResetFilter}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold text-suka-primary bg-suka-primary/10 hover:bg-suka-primary/20 transition-colors cursor-pointer"
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
                      className="p-2.5 rounded-xl hover:bg-suka-gray-50/80 transition-colors border border-transparent hover:border-suka-brown/5 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                          isOut ? 'bg-orange-50 text-suka-orange' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {isOut ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-suka-ink text-xs sm:text-sm truncate">
                            {displayTitle}
                          </p>
                          {detailNote && (
                            <p className="text-[11px] text-suka-gray-500 line-clamp-1 mt-0.5">
                              {detailNote}
                            </p>
                          )}
                          <p className="text-[10px] font-semibold text-suka-gray-400 mt-0.5">
                            {sourceAccount} • {tanggal(t.occurred_at)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`block font-black text-xs sm:text-sm tabular-nums ${isOut ? 'text-suka-ink' : 'text-emerald-600'}`}>
                          {isOut ? '−' : '+'}{rupiah(t.amount)}
                        </span>
                        <div className="mt-0.5">
                          {t.status === 'paid' ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
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
          <motion.div variants={itemAnim} className="lg:col-span-5 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-suka-brown/5 space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-suka-brown/5">
              <div>
                <h3 className="font-display text-lg sm:text-xl text-suka-brown font-bold">Rincian Saldo</h3>
                <p className="text-[11px] text-suka-gray-400">Posisi kas di pusat &amp; masing-masing cabang</p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-10"><Spinner size={24} /></div>
            ) : (
              <>
                {/* Section A: Kas & Rekening Kantor Pusat */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-suka-gray-500">
                      1. Kas &amp; Bank Kantor Pusat
                    </span>
                    <span className="text-xs font-bold text-suka-brown tabular-nums">
                      {rupiah(summary.totalPusat)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {pusatLocations.map((p) => (
                      <div 
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-suka-cream/60 border border-suka-brown/5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border shrink-0 ${
                            p.kind === 'bank' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-suka-orange border-orange-200'
                          }`}>
                            {p.kind === 'bank' ? 'BANK' : 'KAS FISIK'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-suka-ink truncate">{p.label}</p>
                            {p.bank_name && (
                              <p className="text-[10px] text-suka-gray-400 font-semibold truncate">{p.bank_name} • {p.account_no}</p>
                            )}
                          </div>
                        </div>
                        <span className="font-bold text-xs sm:text-sm text-suka-brown shrink-0 tabular-nums">
                          {rupiah(p.saldo)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section B: Kas Operasional Cabang (Petty Cash) */}
                <div className="pt-3 border-t border-suka-brown/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-suka-gray-500 flex items-center gap-1.5">
                      <Store size={13} className="text-emerald-600" />
                      <span>2. Kas Kecil Cabang ({filteredOutlets.length} Outlet)</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-700 tabular-nums">
                      {rupiah(summary.totalOutletCash)}
                    </span>
                  </div>

                  {/* Search outlet box */}
                  <div className="relative mb-2.5">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-suka-gray-400" />
                    <input 
                      type="text" 
                      value={outletSearch}
                      onChange={(e) => setOutletSearch(e.target.value)}
                      placeholder="Cari cabang outlet..."
                      className="w-full pl-7 pr-3 py-1.5 text-xs rounded-xl bg-suka-gray-50 border border-suka-brown/10 focus:outline-none focus:border-suka-primary/40 focus:bg-white transition-all placeholder:text-suka-gray-400"
                    />
                  </div>

                  <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                    {filteredOutlets.length === 0 ? (
                      <div className="text-center py-6 text-xs text-suka-gray-400">
                        {outletSearch ? 'Tidak ada cabang yang cocok dengan pencarian' : 'Tidak ada cabang aktif'}
                      </div>
                    ) : (
                      filteredOutlets.map((o) => (
                        <div 
                          key={o.id}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-suka-cream/50 transition-colors border border-transparent hover:border-suka-brown/5"
                        >
                          <div className="min-w-0 pr-2 flex items-center gap-2">
                            <p className="font-bold text-xs text-suka-ink truncate">{o.label}</p>
                            {o.saldo === 0 && (
                              <span className="inline-block text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 rounded shrink-0">
                                Rp 0
                              </span>
                            )}
                          </div>
                          <span className={`font-bold text-xs shrink-0 tabular-nums ${o.saldo === 0 ? 'text-suka-gray-400' : 'text-suka-brown'}`}>
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
    </div>
  )
}
