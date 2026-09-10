'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MitraFormDialog } from './MitraFormDialog'
import { TransferUploadDialog } from './TransferUploadDialog'
import { SaranInbox } from './SaranInbox'
import { TransferListView } from './TransferListView'
import { MitraProfitLossSection } from '../../mitra/MitraProfitLossSection'
import { InvestmentDialog } from '@/components/InvestmentDialog'
import { PeriodFilter } from '@/components/PeriodFilter'
import { 
  Users, 
  UploadCloud, 
  MessageSquare, 
  FileCheck, 
  Store, 
  Search, 
  X, 
  Plus, 
  UserCheck, 
  TrendingUp, 
  Edit3, 
  ShieldCheck, 
  AlertCircle,
  CreditCard,
  FileText,
  DollarSign,
  PieChart,
  Activity,
  User,
  Phone,
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { toast } from 'sonner'
import type { PeriodFilterValue } from '@/lib/types'

function formatRupiah(num: number) {
  return 'Rp ' + Math.round(num || 0).toLocaleString('id-ID')
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

function getAvatarGradient(name: string) {
  const gradients = [
    'from-amber-600 via-amber-500 to-orange-600',
    'from-orange-600 via-amber-600 to-rose-600',
    'from-emerald-700 via-emerald-600 to-teal-700',
    'from-blue-700 via-indigo-600 to-sky-700',
    'from-purple-700 via-purple-600 to-pink-700',
  ]
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % gradients.length
  return gradients[index]
}

function getInitials(name: string) {
  if (!name) return 'M'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export interface KelolaMitraViewProps {
  mitraProfiles?: any[]
  suggestions?: any[]
  allUsers?: any[]
  allOutlets?: any[]
  transfers?: any[]
  investments?: any[]
  initialPnlData?: any
  currentFilter?: PeriodFilterValue
  mitraOutletIds?: string[]
  realtimeBepMap?: Record<string, any>
}

export function KelolaMitraView({ 
  mitraProfiles = [], 
  suggestions = [], 
  allUsers = [], 
  allOutlets = [], 
  transfers = [],
  investments = [],
  initialPnlData = null,
  currentFilter = { from: '', to: '', outletId: 'all', source: 'all' },
  mitraOutletIds = [],
  realtimeBepMap = {}
}: KelolaMitraViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'pnl' | 'daftar' | 'investasi' | 'transfer' | 'saran'>('pnl')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'aktif' | 'nonaktif'>('all')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const [isMitraFormOpen, setIsMitraFormOpen] = useState(false)
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false)
  const [editMitraData, setEditMitraData] = useState<any>(null)
  const [investmentOutlet, setInvestmentOutlet] = useState<any>(null)
  const [expandedBreakdownOutlets, setExpandedBreakdownOutlets] = useState<Record<string, boolean>>({})

  const toggleBreakdown = (outletId: string) => {
    setExpandedBreakdownOutlets(prev => ({
      ...prev,
      [outletId]: !prev[outletId]
    }))
  }

  // Filter change handler
  const handleFilterChange = (newFilter: PeriodFilterValue) => {
    const params = new URLSearchParams()
    if (newFilter.from) params.set('from', newFilter.from)
    if (newFilter.to) params.set('to', newFilter.to)
    if (newFilter.outletId && newFilter.outletId !== 'all') {
      params.set('outletId', newFilter.outletId)
    }
    router.push(`?${params.toString()}`)
  }

  // Filter mitra outlets
  const mitraOutlets = useMemo(() => {
    const ids = new Set(mitraOutletIds)
    return allOutlets.filter((o: any) => ids.has(o.id))
  }, [allOutlets, mitraOutletIds])

  // Copy to clipboard helper
  const handleCopy = (text: string, key: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success('Disalin ke clipboard')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Map investments by outlet_id
  const investmentMap = useMemo(() => {
    const map: Record<string, any> = {}
    investments.forEach((inv: any) => {
      map[inv.outlet_id] = inv
    })
    return map
  }, [investments])

  // Total Modal Terhimpun (khusus mitra outlet)
  const totalModalSemua = useMemo(() => {
    const ids = new Set(mitraOutletIds)
    return investments
      .filter((inv: any) => ids.has(inv.outlet_id))
      .reduce((acc: number, inv: any) => acc + (Number(inv.nilai_investasi) || 0), 0)
  }, [investments, mitraOutletIds])

  // Total Dana Kembali Realtime (Historis + Net Profit Sistem)
  const totalDanaKembaliSemua = useMemo(() => {
    return mitraOutlets.reduce((acc: number, outlet: any) => {
      const bepData = realtimeBepMap[outlet.id]
      if (bepData) return acc + (Number(bepData.totalDanaKembali) || 0)
      const inv = investmentMap[outlet.id]
      const omzetHistoris = Number(inv?.omzet_historis) || 0
      const transferHistoris = Number(inv?.transfer_historis) || 0
      return acc + omzetHistoris + transferHistoris
    }, 0)
  }, [mitraOutlets, realtimeBepMap, investmentMap])

  // Jumlah Outlet yang Sudah Balik Modal (BEP)
  const bepCount = useMemo(() => {
    return mitraOutlets.filter((outlet: any) => {
      const bepData = realtimeBepMap[outlet.id]
      if (bepData) return bepData.isBep
      const inv = investmentMap[outlet.id]
      const totalModal = Number(inv?.nilai_investasi) || 0
      const omzetHistoris = Number(inv?.omzet_historis) || 0
      const transferHistoris = Number(inv?.transfer_historis) || 0
      const totalReturned = omzetHistoris + transferHistoris
      return totalModal > 0 && totalReturned >= totalModal
    }).length
  }, [mitraOutlets, realtimeBepMap, investmentMap])

  // Calculations for summary stats
  const totalMitra = mitraProfiles.length
  const totalMitraAktif = useMemo(() => {
    return mitraProfiles.filter((m: any) => m.status !== 'nonaktif').length
  }, [mitraProfiles])

  const uniqueOutletsCovered = useMemo(() => {
    const set = new Set<string>()
    mitraProfiles.forEach((m: any) => {
      (m.outlet_ids || []).forEach((oid: string) => set.add(oid))
    })
    return set.size
  }, [mitraProfiles])

  const totalTransferNominal = useMemo(() => {
    return transfers.reduce((acc: number, t: any) => acc + (Number(t.nominal) || 0), 0)
  }, [transfers])

  const pendingSuggestions = useMemo(() => {
    return suggestions.filter((s: any) => s.status === 'baru').length
  }, [suggestions])

  // Filtered Mitra Cards
  const filteredMitra = useMemo(() => {
    return mitraProfiles.filter((m: any) => {
      if (statusFilter === 'aktif' && m.status === 'nonaktif') return false
      if (statusFilter === 'nonaktif' && m.status !== 'nonaktif') return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      const nameMatch = (m.nama_mitra || '').toLowerCase().includes(q)
      const phoneMatch = (m.phone || '').toLowerCase().includes(q)
      const nikMatch = (m.nik || '').toLowerCase().includes(q)
      const bankMatch = (m.bank_name || '').toLowerCase().includes(q) || (m.bank_account_number || '').includes(q)
      const staffUser = allUsers.find((u: any) => u.id === m.user_id)
      const userMatch = staffUser && (
        (staffUser.name || '').toLowerCase().includes(q) ||
        (staffUser.username || '').toLowerCase().includes(q)
      )
      const outletMatch = (m.outlet_ids || []).some((oid: string) => {
        const outlet = allOutlets.find((o: any) => o.id === oid)
        return outlet && outlet.name.toLowerCase().includes(q)
      })
      return nameMatch || phoneMatch || nikMatch || bankMatch || userMatch || outletMatch
    })
  }, [mitraProfiles, searchQuery, statusFilter, allUsers, allOutlets])

  const handleEdit = (mitra: any) => {
    setEditMitraData(mitra)
    setIsMitraFormOpen(true)
  }

  const handleAdd = () => {
    setEditMitraData(null)
    setIsMitraFormOpen(true)
  }

  return (
    <div className="min-h-screen space-y-6 animate-fade-in pb-12 text-[#251A14]">
      {/* 1. HEADER DASHBOARD KEMITRAAN */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-suka-brown/10 p-6 sm:p-7 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/10 via-orange-500/5 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-suka-orange/10 text-suka-orange text-[11px] font-bold uppercase tracking-wider border border-suka-orange/20">
                <Sparkles className="w-3.5 h-3.5" />
                Manajemen Kemitraan
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {totalMitraAktif} Mitra Terverifikasi
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-suka-brown/5 text-suka-brown text-[11px] font-medium border border-suka-brown/10">
                <Store className="w-3.5 h-3.5 text-suka-brown/70" />
                {uniqueOutletsCovered} Outlet Kemitraan
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-suka-brown tracking-tight">
              Dashboard Kemitraan
            </h1>

            <p className="text-xs sm:text-sm text-suka-ink/65 max-w-2xl font-normal leading-relaxed">
              Monitoring performa P&L, pelacak modal investasi & progres BEP, legalitas kontrak PKS, serta riwayat transfer bagi hasil mitra.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-1 lg:pt-0">
            <button
              onClick={() => setIsTransferFormOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-suka-gray-50 text-suka-brown border border-suka-gray-200 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs hover:border-suka-orange/40 transition-all active:scale-[0.98]"
            >
              <UploadCloud className="w-4 h-4 text-suka-orange" />
              <span>Upload Bukti Transfer</span>
            </button>

            <button
              onClick={handleAdd}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-suka-orange hover:bg-suka-orange/90 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Mitra Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. BENTO-GRID KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Card 1: Mitra Terdaftar */}
        <div
          onClick={() => setActiveTab('daftar')}
          className={`group bg-white/95 rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'daftar'
              ? 'ring-2 ring-suka-orange/40 border-suka-orange/60 bg-amber-50/20 shadow-sm'
              : 'border-suka-brown/10 shadow-xs hover:border-suka-orange/40 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-suka-gray-500 uppercase tracking-wider">Mitra Terdaftar</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-200/60 shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-suka-brown tabular-nums tracking-tight">{totalMitra}</div>
            <div className="text-xs font-medium text-emerald-700 mt-1 flex items-center gap-1 truncate">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{totalMitraAktif} aktif</span>
            </div>
          </div>
        </div>

        {/* Card 2: Outlet Kemitraan */}
        <div
          onClick={() => setActiveTab('investasi')}
          className={`group bg-white/95 rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'investasi'
              ? 'ring-2 ring-suka-orange/40 border-suka-orange/60 bg-amber-50/20 shadow-sm'
              : 'border-suka-brown/10 shadow-xs hover:border-suka-orange/40 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-suka-gray-500 uppercase tracking-wider">Outlet Mitra</span>
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-700 flex items-center justify-center border border-orange-200/60 shrink-0">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-suka-brown tabular-nums tracking-tight">
              {uniqueOutletsCovered} <span className="text-xs font-normal text-suka-gray-500">Unit</span>
            </div>
            <div className="text-xs font-medium text-orange-800 mt-1 flex items-center gap-1 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span>{mitraOutlets.length} outlet terhubung</span>
            </div>
          </div>
        </div>

        {/* Card 3: Modal Terhimpun */}
        <div
          onClick={() => setActiveTab('investasi')}
          className={`group bg-white/95 rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'investasi'
              ? 'ring-2 ring-suka-orange/40 border-suka-orange/60 bg-amber-50/20 shadow-sm'
              : 'border-suka-brown/10 shadow-xs hover:border-suka-orange/40 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-suka-gray-500 uppercase tracking-wider">Modal Terhimpun</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center border border-blue-200/60 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-xl font-bold text-suka-brown tabular-nums tracking-tight truncate" title={formatRupiah(totalModalSemua)}>
              {formatRupiah(totalModalSemua)}
            </div>
            <div className="text-xs font-medium text-blue-800 mt-1 flex items-center gap-1 truncate">
              <Activity className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{investments.length} slot modal</span>
            </div>
          </div>
        </div>

        {/* Card 4: Bagi Hasil Terbayar */}
        <div
          onClick={() => setActiveTab('transfer')}
          className={`group bg-white/95 rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'transfer'
              ? 'ring-2 ring-suka-orange/40 border-suka-orange/60 bg-amber-50/20 shadow-sm'
              : 'border-suka-brown/10 shadow-xs hover:border-suka-orange/40 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-suka-gray-500 uppercase tracking-wider">Bagi Hasil Terbayar</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg sm:text-xl font-bold text-suka-brown tabular-nums tracking-tight truncate" title={formatRupiah(totalTransferNominal)}>
              {formatRupiah(totalTransferNominal)}
            </div>
            <div className="text-xs font-medium text-emerald-800 mt-1 flex items-center gap-1 truncate">
              <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{transfers.length} bukti transfer</span>
            </div>
          </div>
        </div>

        {/* Card 5: Kotak Saran */}
        <div
          onClick={() => setActiveTab('saran')}
          className={`col-span-2 sm:col-span-1 xl:col-span-1 group bg-white/95 rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'saran'
              ? 'ring-2 ring-suka-orange/40 border-suka-orange/60 bg-amber-50/20 shadow-sm'
              : 'border-suka-brown/10 shadow-xs hover:border-suka-orange/40 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-suka-gray-500 uppercase tracking-wider">Kotak Saran</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-700 flex items-center justify-center border border-rose-200/60 shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center sm:block justify-between">
            <div className="text-xl sm:text-2xl font-bold text-suka-brown tabular-nums tracking-tight">{suggestions.length}</div>
            <div className="text-xs font-medium mt-1">
              {pendingSuggestions > 0 ? (
                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-semibold inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  {pendingSuggestions} baru
                </span>
              ) : (
                <span className="text-suka-gray-500">Semua ditanggapi</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SEGMENTED TAB TRACK */}
      <div className="overflow-x-auto no-scrollbar pb-1">
        <div className="flex items-center gap-1.5 p-1.5 bg-white/90 backdrop-blur-md rounded-2xl border border-suka-brown/10 shadow-xs w-max max-w-full">
          <button
            onClick={() => setActiveTab('pnl')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'pnl'
                ? 'bg-suka-orange text-white shadow-xs'
                : 'text-suka-ink/70 hover:text-suka-brown hover:bg-suka-gray-100/60'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Laporan Finansial & P&L</span>
          </button>

          <button
            onClick={() => setActiveTab('daftar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'daftar'
                ? 'bg-suka-orange text-white shadow-xs'
                : 'text-suka-ink/70 hover:text-suka-brown hover:bg-suka-gray-100/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Database & Biodata Mitra</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'daftar' ? 'bg-white/25 text-white' : 'bg-suka-gray-100 text-suka-brown'
            }`}>
              {mitraProfiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('investasi')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'investasi'
                ? 'bg-suka-orange text-white shadow-xs'
                : 'text-suka-ink/70 hover:text-suka-brown hover:bg-suka-gray-100/60'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Modal & Progres BEP</span>
          </button>

          <button
            onClick={() => setActiveTab('transfer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'transfer'
                ? 'bg-suka-orange text-white shadow-xs'
                : 'text-suka-ink/70 hover:text-suka-brown hover:bg-suka-gray-100/60'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Riwayat Transfer</span>
            {transfers.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'transfer' ? 'bg-white/25 text-white' : 'bg-suka-gray-100 text-suka-brown'
              }`}>
                {transfers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('saran')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'saran'
                ? 'bg-suka-orange text-white shadow-xs'
                : 'text-suka-ink/70 hover:text-suka-brown hover:bg-suka-gray-100/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Kotak Saran</span>
            {pendingSuggestions > 0 ? (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingSuggestions} baru
              </span>
            ) : suggestions.length > 0 ? (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'saran' ? 'bg-white/25 text-white' : 'bg-suka-gray-100 text-suka-brown'
              }`}>
                {suggestions.length}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* 4. TAB CONTENT PANELS */}

      {/* TAB 1: COMPREHENSIVE P&L LAPORAN FINANSIAL */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          {initialPnlData ? (
            <MitraProfitLossSection
              pnlData={initialPnlData}
              currentFilter={currentFilter}
              onFilterChange={handleFilterChange}
              outlets={mitraOutlets}
              className="mt-0"
            />
          ) : (
            <div className="p-12 text-center bg-white/90 backdrop-blur-md rounded-3xl border border-dashed border-suka-brown/20 shadow-xs space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-suka-orange flex items-center justify-center mx-auto border border-amber-200/70">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-suka-brown text-base">Belum Ada Transaksi di Jaringan Kemitraan</h3>
                <p className="text-xs text-suka-gray-500 max-w-md mx-auto font-normal mt-1.5">
                  Silakan sesuaikan filter rentang tanggal atau pastikan outlet mitra telah terhubung dengan data penjualan.
                </p>
              </div>
              <div className="flex justify-center mt-3">
                <PeriodFilter
                  value={currentFilter}
                  onChange={handleFilterChange}
                  outlets={mitraOutlets}
                  hideSource
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DATABASE & BIODATA MITRA */}
      {activeTab === 'daftar' && (
        <div className="space-y-6">
          {/* Search & Status Filter Toolbar */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-suka-brown/10 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Search className="w-4 h-4 text-suka-gray-400" />
              </span>
              <input
                type="text"
                placeholder="Cari nama mitra, NIK, bank, rekening, atau outlet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 text-xs sm:text-sm rounded-xl border border-suka-gray-200 focus:outline-none focus:ring-2 focus:ring-suka-orange/20 focus:border-suka-orange placeholder:text-suka-gray-400 bg-suka-gray-50/60 font-normal transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-suka-gray-400 hover:text-suka-ink"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status Pills & Action */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <div className="flex items-center gap-1 bg-suka-gray-100/70 p-1 rounded-xl border border-suka-gray-200/70 text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                    statusFilter === 'all' ? 'bg-white text-suka-brown shadow-2xs font-semibold' : 'text-suka-ink/70 hover:text-suka-brown'
                  }`}
                >
                  Semua ({mitraProfiles.length})
                </button>
                <button
                  onClick={() => setStatusFilter('aktif')}
                  className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                    statusFilter === 'aktif' ? 'bg-emerald-600 text-white shadow-2xs font-semibold' : 'text-suka-ink/70 hover:text-suka-brown'
                  }`}
                >
                  Aktif ({totalMitraAktif})
                </button>
                <button
                  onClick={() => setStatusFilter('nonaktif')}
                  className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                    statusFilter === 'nonaktif' ? 'bg-rose-600 text-white shadow-2xs font-semibold' : 'text-suka-ink/70 hover:text-suka-brown'
                  }`}
                >
                  Nonaktif ({mitraProfiles.length - totalMitraAktif})
                </button>
              </div>

              <button
                onClick={handleAdd}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-suka-orange hover:bg-suka-orange/90 text-white font-semibold text-xs rounded-xl shadow-2xs transition-all shrink-0 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Mitra</span>
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredMitra.map((mitra: any) => {
              const staffUser = allUsers.find((u: any) => u.id === mitra.user_id)
              const outletCount = mitra.outlet_ids?.length || 0
              const avatarGrad = getAvatarGradient(mitra.nama_mitra)
              const initials = getInitials(mitra.nama_mitra)

              return (
                <div 
                  key={mitra.id || mitra.user_id} 
                  className="group bg-white/95 rounded-2xl border border-suka-brown/10 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full"
                >
                  <div className="space-y-4">
                    {/* Header: Avatar, Name, User, Status */}
                    <div className="flex items-start gap-3.5 pb-3.5 border-b border-suka-gray-100">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGrad} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs`}>
                        {initials}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-suka-brown text-base leading-snug truncate group-hover:text-suka-orange transition-colors">
                          {mitra.nama_mitra}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-suka-ink/65">
                          <UserCheck className="w-3.5 h-3.5 text-suka-orange shrink-0" />
                          <span className="truncate font-medium">
                            {staffUser ? `@${staffUser.username}` : `ID: ${mitra.user_id?.substring(0, 8)}...`}
                          </span>
                        </div>
                      </div>

                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                        mitra.status === 'nonaktif' 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {mitra.status || 'Aktif'}
                      </span>
                    </div>

                    {/* NIK & Kontak WhatsApp */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-suka-gray-50/80 p-2.5 rounded-xl border border-suka-gray-200/60">
                        <span className="text-[10px] font-semibold text-suka-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <User className="w-3 h-3 text-suka-orange" /> NIK / KTP
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono font-medium text-suka-brown text-xs truncate">
                            {mitra.nik || '-'}
                          </span>
                          {mitra.nik && (
                            <button
                              onClick={() => handleCopy(mitra.nik, `nik-${mitra.id}`)}
                              className="text-suka-gray-400 hover:text-suka-brown transition-colors"
                              title="Salin NIK"
                            >
                              {copiedKey === `nik-${mitra.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="bg-suka-gray-50/80 p-2.5 rounded-xl border border-suka-gray-200/60">
                        <span className="text-[10px] font-semibold text-suka-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <Phone className="w-3 h-3 text-suka-orange" /> WhatsApp
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-medium text-suka-brown text-xs truncate">
                            {mitra.phone || '-'}
                          </span>
                          {mitra.phone && (
                            <a
                              href={`https://wa.me/${mitra.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 font-semibold p-0.5 rounded hover:bg-emerald-50 transition-colors"
                              title="Chat WhatsApp"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Rekening Tujuan Transfer */}
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/70 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-amber-950 uppercase mb-1">
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-suka-orange" /> Rekening Bagi Hasil
                        </span>
                        <span className="font-bold px-2 py-0.5 bg-amber-600 text-white rounded-md text-[10px]">
                          {mitra.profit_sharing_pct ?? 50}% Profit
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="font-bold text-xs sm:text-sm text-suka-brown truncate">
                          {mitra.bank_name || 'BCA'} • {mitra.bank_account_number || '-'}
                        </div>
                        {mitra.bank_account_number && (
                          <button
                            onClick={() => handleCopy(mitra.bank_account_number, `bank-${mitra.id}`)}
                            className="text-suka-gray-400 hover:text-suka-brown transition-colors p-1"
                            title="Salin Nomor Rekening"
                          >
                            {copiedKey === `bank-${mitra.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-suka-ink/65 font-normal mt-0.5 truncate">
                        a.n. {mitra.bank_account_holder || mitra.nama_mitra}
                      </div>
                    </div>

                    {/* Legalitas & PKS */}
                    <div className="p-3 bg-suka-gray-50/80 rounded-xl border border-suka-gray-200/60 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-suka-gray-500 uppercase">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-suka-orange" /> Kontrak PKS
                        </span>
                        <span className="font-normal text-suka-gray-400">
                          Berakhir: {formatDate(mitra.tanggal_berakhir_pks)}
                        </span>
                      </div>
                      <div className="font-mono font-medium text-xs text-suka-brown truncate">
                        {mitra.no_pks || 'Belum diisi'}
                      </div>
                    </div>

                    {/* Akses Outlet */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-suka-gray-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-suka-orange" /> Akses Outlet
                        </span>
                        <span className="text-suka-gray-500 font-medium">{outletCount} Unit</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                        {mitra.outlet_ids?.map((oid: string) => {
                          const outlet = allOutlets.find((o: any) => o.id === oid)
                          return (
                            <span 
                              key={oid} 
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-suka-orange/10 text-suka-brown border border-suka-orange/20 text-xs font-medium rounded-lg"
                            >
                              <Store className="w-3 h-3 text-suka-orange" />
                              {outlet?.name || 'Unknown'}
                            </span>
                          )
                        })}
                        {outletCount === 0 && (
                          <div className="text-xs text-suka-gray-400 italic py-1">Belum ada outlet terhubung</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Button */}
                  <div className="pt-3.5 mt-auto border-t border-suka-gray-100">
                    <button 
                      onClick={() => handleEdit(mitra)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2 px-3.5 bg-suka-gray-50 hover:bg-suka-orange hover:text-white text-suka-brown font-semibold rounded-xl transition-all duration-200 text-xs border border-suka-gray-200 hover:border-suka-orange shadow-2xs active:scale-[0.98]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Biodata & Akses Outlet</span>
                    </button>
                  </div>
                </div>
              )
            })}

            {filteredMitra.length === 0 && (
              <div className="col-span-full bg-white/90 rounded-2xl border border-dashed border-suka-brown/20 p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-suka-orange flex items-center justify-center mx-auto border border-amber-200">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-suka-brown text-base">Tidak ada data mitra ditemukan</h3>
                <p className="text-xs text-suka-gray-500 max-w-sm mx-auto font-normal">
                  {searchQuery ? `Tidak ditemukan profil mitra dengan kata kunci "${searchQuery}".` : 'Belum ada data profil mitra yang ditambahkan ke sistem.'}
                </p>
                <button
                  onClick={handleAdd}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-suka-orange text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Mitra Baru</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MODAL & PROGRES BEP */}
      {activeTab === 'investasi' && (
        <div className="space-y-6">
          {/* Header Summary BEP */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-suka-brown/10 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 rounded-full mb-1.5 border border-amber-200/70">
                <Activity className="w-3.5 h-3.5 text-suka-orange" />
                <span className="text-[11px] font-semibold text-amber-900 tracking-wider uppercase">
                  Pelacak Balik Modal (ROI & BEP)
                </span>
              </div>
              <h3 className="font-bold text-suka-brown text-base sm:text-lg">Monitoring Modal Investasi & Status BEP</h3>
              <p className="text-xs text-suka-gray-500 font-normal mt-0.5">
                Pantau progres pengembalian investasi (BEP) tiap outlet berdasarkan akumulasi transfer bagi hasil riil.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-suka-gray-50/80 rounded-2xl border border-suka-gray-200/70 shrink-0">
              <div className="pr-3">
                <span className="text-[10px] font-semibold text-suka-gray-500 uppercase tracking-wider block">Total Modal Awal</span>
                <span className="font-bold text-sm sm:text-base text-suka-brown tabular-nums">{formatRupiah(totalModalSemua)}</span>
              </div>
              <div className="sm:border-l sm:border-suka-gray-200/70 sm:pl-3 pr-3">
                <span className="text-[10px] font-semibold text-suka-gray-500 uppercase tracking-wider block">Total Laba Kembali</span>
                <span className="font-bold text-sm sm:text-base text-emerald-700 tabular-nums">{formatRupiah(totalDanaKembaliSemua)}</span>
              </div>
              <div className="sm:border-l sm:border-suka-gray-200/70 sm:pl-3">
                <span className="text-[10px] font-semibold text-suka-gray-500 uppercase tracking-wider block">Status BEP Jaringan</span>
                <span className="font-bold text-sm sm:text-base text-amber-800 tabular-nums">{bepCount} / {mitraOutlets.length} Outlet</span>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {mitraOutlets.map((outlet: any) => {
              const inv = investmentMap[outlet.id]
              const totalModal = Number(inv?.nilai_investasi) || 0
              const ownerMitra = mitraProfiles.find((m: any) => (m.outlet_ids || []).includes(outlet.id))
              const profitSharePct = inv?.persentase_bagi_hasil ?? ownerMitra?.profit_sharing_pct ?? 50

              const bepData = realtimeBepMap[outlet.id]
              const omzetHistoris = Number(inv?.omzet_historis) || 0
              const transferHistoris = Number(inv?.transfer_historis) || 0
              const transferSistem = Number(bepData?.transferSistem) || 0
              const realtimeMitraShare = bepData?.mitraShare || 0
              const netProfitOutlet = Number(bepData?.netProfit) || 0
              const monthlyBreakdown = bepData?.monthlyBreakdown || []

              const totalReturned = bepData ? bepData.totalDanaKembali : (omzetHistoris + transferHistoris)
              const roiRaw = totalModal > 0 ? (totalReturned / totalModal) * 100 : 0
              const bepPercentage = bepData ? bepData.bepPercentage : Math.min(Math.round(roiRaw * 10) / 10, 100)
              const isBep = bepData ? bepData.isBep : (totalModal > 0 && totalReturned >= totalModal)
              const sisaModal = bepData ? bepData.sisaModal : Math.max(0, totalModal - totalReturned)

              return (
                <div 
                  key={outlet.id} 
                  className="group bg-white/95 rounded-2xl p-5 sm:p-6 border border-suka-brown/10 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full"
                >
                  <div className="space-y-4">
                    {/* Header Outlet & BEP Badge */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-suka-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/10 text-suka-orange rounded-xl border border-amber-200/80 shrink-0">
                          <Store className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-suka-brown text-base truncate">{outlet.name}</h4>
                          <span className="text-xs text-suka-ink/65 font-normal truncate block">
                            Pemilik: <strong className="font-semibold text-amber-800">{ownerMitra?.nama_mitra || 'Belum Ditautkan'}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isBep ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>SUDAH BEP ({Math.round(roiRaw)}%)</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300/80 flex items-center gap-1 shrink-0">
                          <TrendingUp className="w-3 h-3 text-suka-orange" />
                          <span>BEP: {bepPercentage}%</span>
                        </span>
                      )}
                    </div>

                    {/* Progress Balik Modal Box */}
                    <div className="bg-suka-gray-50/80 rounded-xl p-3.5 border border-suka-gray-200/60 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-suka-brown flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-suka-orange" />
                          <span>Progres Balik Modal (BEP)</span>
                        </span>
                        <span className={`font-bold ${isBep ? 'text-emerald-700' : 'text-suka-orange'}`}>
                          {bepPercentage}%
                        </span>
                      </div>

                      {/* Progress Track */}
                      <div className="w-full bg-suka-gray-200/60 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ${
                            isBep 
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                              : 'bg-gradient-to-r from-amber-500 to-orange-500'
                          }`}
                          style={{ width: `${Math.max(bepPercentage, totalReturned > 0 ? 4 : 0)}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] pt-1 text-suka-ink/70">
                        <span>Total Kembali: <strong className="text-emerald-700 font-bold">{formatRupiah(totalReturned)}</strong></span>
                        <span>
                          {isBep ? (
                            <strong className="text-emerald-700 font-bold">Laba Murni (100% BEP)</strong>
                          ) : (
                            <>Sisa: <strong className="text-rose-600 font-semibold">{formatRupiah(sisaModal)}</strong></>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Investment & Contract Details */}
                    <div className="p-3.5 bg-white rounded-xl border border-suka-gray-200/60 space-y-2.5 text-xs">
                      {/* Modal Investasi Awal */}
                      <div className="flex justify-between items-center pb-2 border-b border-suka-gray-100">
                        <span className="text-suka-gray-600 font-medium">Modal Investasi Awal:</span>
                        <span className="font-bold text-suka-brown tabular-nums text-sm">{formatRupiah(totalModal)}</span>
                      </div>

                      {/* Rincian Komponen Pengembalian Modal Mitra (Rekonsiliasi Transparan) */}
                      <div className="bg-amber-50/50 rounded-xl p-2.5 border border-amber-200/60 space-y-2">
                        <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                          Komponen Pengembalian Modal:
                        </span>

                        {omzetHistoris > 0 && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-suka-gray-600">1. Profit Pra-Digital (s/d Jul 2026):</span>
                            <span className="font-semibold text-emerald-800 tabular-nums">{formatRupiah(omzetHistoris)}</span>
                          </div>
                        )}

                        {transferSistem > 0 && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-suka-gray-600 flex items-center gap-1">
                              <span>{omzetHistoris > 0 ? '2.' : '1.'} Bagi Hasil Ditransfer:</span>
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">Terbayar</span>
                            </span>
                            <span className="font-semibold text-emerald-800 tabular-nums">{formatRupiah(transferSistem)}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-suka-gray-600">
                            {omzetHistoris > 0 && transferSistem > 0 ? '3.' : omzetHistoris > 0 || transferSistem > 0 ? '2.' : '1.'} Bagi Hasil Mitra Sistem (Akrual):
                          </span>
                          <span className="font-bold text-emerald-800 tabular-nums">{formatRupiah(realtimeMitraShare)}</span>
                        </div>

                        {/* Toggle Rincian Bulanan jika ada data monthlyBreakdown */}
                        {monthlyBreakdown.length > 0 && (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() => toggleBreakdown(outlet.id)}
                              className="text-[10px] font-semibold text-suka-orange hover:text-suka-orange/80 inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span>{expandedBreakdownOutlets[outlet.id] ? 'Sembunyikan Rincian Bulan' : 'Lihat Rincian Tiap Bulan (Ags, Sep)'}</span>
                              {expandedBreakdownOutlets[outlet.id] ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>

                            {expandedBreakdownOutlets[outlet.id] && (
                              <div className="mt-2 pt-2 border-t border-amber-200/50 space-y-1.5">
                                {monthlyBreakdown.map((mb: any) => (
                                  <div key={mb.monthKey} className="p-2 bg-white/90 rounded-lg border border-amber-200/50 text-[10px] space-y-1 shadow-2xs">
                                    <div className="flex justify-between font-bold text-suka-brown border-b border-suka-gray-100 pb-0.5">
                                      <span>{mb.monthLabel}</span>
                                      <span className={mb.isTransferred ? 'text-emerald-700' : mb.isClosed ? 'text-amber-800' : 'text-blue-700'}>
                                        {mb.isTransferred ? '✓ Terbayar' : mb.isClosed ? 'Closing Audited' : 'Live Berjalan'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-suka-ink/70">
                                      <span>Laba Bersih Outlet:</span>
                                      <span className="font-semibold tabular-nums">{formatRupiah(mb.netProfit)}</span>
                                    </div>
                                    <div className="flex justify-between text-emerald-800 font-semibold">
                                      <span>Hak Bagi Hasil Mitra ({mb.profitSharingPct}%):</span>
                                      <span className="tabular-nums font-bold">{formatRupiah(mb.mitraShare)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Garis Penjumlahan yang Pasti Pas */}
                        <div className="pt-1.5 border-t border-amber-200/70 flex justify-between items-center text-[11px] font-bold">
                          <span className="text-amber-950">Total Modal Kembali:</span>
                          <span className="text-emerald-700 tabular-nums">{formatRupiah(totalReturned)}</span>
                        </div>
                      </div>

                      {/* Operasional & Ketentuan Kontrak */}
                      <div className="pt-1 space-y-1.5 text-[11px]">
                        {netProfitOutlet > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-suka-gray-500 font-medium">Laba Bersih Outlet (Sistem):</span>
                            <span className="font-semibold text-suka-brown tabular-nums">{formatRupiah(netProfitOutlet)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-suka-gray-500 font-medium">Porsi Bagi Hasil:</span>
                          <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 text-[10px]">
                            {profitSharePct}% Mitra
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-suka-gray-500 font-medium">Management Fee Pusat:</span>
                          <span className={`font-semibold ${Number(inv?.management_fee) > 0 ? 'text-amber-800 font-bold' : 'text-suka-gray-400'}`}>
                            {Number(inv?.management_fee) > 0 ? `${inv.management_fee}% Omzet` : '0% (Nonaktif)'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-suka-gray-500 font-medium">Tanggal Mulai Usaha:</span>
                          <span className="font-medium text-suka-brown">{formatDate(inv?.tanggal_mulai)}</span>
                        </div>
                      </div>

                      {inv?.catatan && (
                        <p className="text-[11px] text-suka-ink/65 italic pt-1 border-t border-suka-gray-100">
                          &ldquo;{inv.catatan}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3.5 mt-auto border-t border-suka-gray-100">
                    <button 
                      onClick={() => setInvestmentOutlet(outlet)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2 px-3.5 bg-suka-orange hover:bg-suka-orange/90 text-white font-semibold rounded-xl transition-all duration-200 text-xs shadow-2xs active:scale-[0.98]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Atur Modal Investasi Outlet</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 4: RIWAYAT TRANSFER */}
      {activeTab === 'transfer' && (
        <TransferListView transfers={transfers} outlets={allOutlets} />
      )}

      {/* TAB 5: KOTAK SARAN */}
      {activeTab === 'saran' && (
        <SaranInbox suggestions={suggestions} />
      )}

      {/* Dialog Modals */}
      <MitraFormDialog 
        isOpen={isMitraFormOpen} 
        onClose={() => setIsMitraFormOpen(false)} 
        users={allUsers}
        outlets={allOutlets}
        initialData={editMitraData}
      />
      
      <TransferUploadDialog 
        isOpen={isTransferFormOpen} 
        onClose={() => setIsTransferFormOpen(false)}
        outlets={allOutlets}
      />

      {investmentOutlet && (
        <InvestmentDialog 
          outlet={investmentOutlet}
          onClose={() => setInvestmentOutlet(null)}
        />
      )}
    </div>
  )
}
