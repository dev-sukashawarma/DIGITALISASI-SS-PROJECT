// @ts-nocheck
'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MitraFormDialog } from './MitraFormDialog'
import { TransferUploadDialog } from './TransferUploadDialog'
import { SaranInbox } from './SaranInbox'
import { TransferListView } from './TransferListView'
import { MitraProfitLossSection } from '../../mitra/MitraProfitLossSection'
import { InvestmentDialog } from '@/components/InvestmentDialog'
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
  Building2, 
  Edit3, 
  ShieldCheck, 
  AlertCircle,
  CreditCard,
  FileText,
  DollarSign,
  PieChart,
  Percent,
  Calendar,
  Activity,
  ChevronRight,
  User,
  Phone,
  Mail,
  MapPin,
  HelpCircle,
  Copy,
  ExternalLink,
  Check,
  CheckCircle2,
  Sparkles,
  ArrowUpRight
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
}: any) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'pnl' | 'daftar' | 'investasi' | 'transfer' | 'saran'>('pnl')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'aktif' | 'nonaktif'>('all')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const [isMitraFormOpen, setIsMitraFormOpen] = useState(false)
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false)
  const [editMitraData, setEditMitraData] = useState<any>(null)
  const [investmentOutlet, setInvestmentOutlet] = useState<any>(null)

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
    <div className="min-h-screen bg-[#FAF7F2] text-[#251A14] p-4 sm:p-6 lg:p-8 space-y-7 animate-fade-in relative selection:bg-amber-500 selection:text-white">
      
      {/* 1. ARCHITECTURAL AMBIENT LIGHTING */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-amber-200/20 via-orange-100/10 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-amber-300/15 via-rose-100/10 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* 2. EXECUTIVE HERO: DOUBLE-BEZEL MACHINED ENCLOSURE */}
      <div className="bg-amber-950/[0.03] p-1.5 rounded-[2rem] ring-1 ring-amber-950/[0.06] shadow-[0_12px_35px_-15px_rgba(56,38,28,0.06)]">
        <div className="bg-white/95 backdrop-blur-2xl rounded-[calc(2rem-0.375rem)] p-6 sm:p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_2px_8px_-2px_rgba(56,38,28,0.03)] relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/10 via-orange-500/5 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              
              {/* Eyebrow Pill */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 text-white text-[11px] font-semibold tracking-wider uppercase shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  Executive Partnership Hub
                </span>
                
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200/80 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {totalMitraAktif} Mitra Terverifikasi
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#2A1D16] tracking-tight">
                Pusat Manajemen Kemitraan
              </h1>
              
              <p className="text-sm sm:text-base text-[#6E5A4E] font-normal leading-relaxed">
                Platform kontrol terpadu untuk monitoring P&L real-time, audit komparasi finansial outlet, database legalitas PKS, dan otomatisasi transfer bagi hasil mitra.
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button 
                onClick={() => setIsTransferFormOpen(true)}
                className="group inline-flex items-center justify-center gap-2.5 px-5 py-2.5 bg-white hover:bg-amber-50/80 text-[#2A1D16] border border-amber-200/80 rounded-full text-xs sm:text-sm font-semibold shadow-xs hover:shadow-sm transition-all duration-300 active:scale-[0.98]"
              >
                <UploadCloud className="w-4 h-4 text-amber-600" />
                <span>Upload Bukti Transfer</span>
              </button>

              <button 
                onClick={handleAdd}
                className="group inline-flex items-center justify-center gap-2 pl-5 pr-2 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-full text-xs sm:text-sm font-semibold shadow-md shadow-amber-600/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Tambah Mitra Baru</span>
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                  <Plus className="w-3.5 h-3.5 text-white" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BENTO-GRID EXECUTIVE STAT METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Total Mitra */}
        <div 
          onClick={() => setActiveTab('daftar')}
          className="group bg-amber-950/[0.02] p-1 rounded-[1.75rem] ring-1 ring-amber-950/[0.05] shadow-xs hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        >
          <div className="bg-white/95 rounded-[calc(1.75rem-0.25rem)] p-5 h-full flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,1)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#8C7566] uppercase tracking-wider">Mitra Terdaftar</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-200/60 group-hover:scale-105 transition-all">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold text-[#2A1D16] tabular-nums tracking-tight">{totalMitra}</div>
              <div className="text-xs font-medium text-emerald-700 mt-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> {totalMitraAktif} aktif
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Outlet Kemitraan */}
        <div 
          onClick={() => setActiveTab('investasi')}
          className="group bg-amber-950/[0.02] p-1 rounded-[1.75rem] ring-1 ring-amber-950/[0.05] shadow-xs hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        >
          <div className="bg-white/95 rounded-[calc(1.75rem-0.25rem)] p-5 h-full flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,1)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#8C7566] uppercase tracking-wider">Outlet Mitra</span>
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-700 flex items-center justify-center border border-orange-200/60 group-hover:scale-105 transition-all">
                <Store className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold text-[#2A1D16] tabular-nums tracking-tight">
                {uniqueOutletsCovered} <span className="text-sm font-normal text-[#8C7566]">Unit</span>
              </div>
              <div className="text-xs font-medium text-orange-800 mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-orange-600" /> Terkelola aktif
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Modal Masuk */}
        <div 
          onClick={() => setActiveTab('investasi')}
          className="group bg-amber-950/[0.02] p-1 rounded-[1.75rem] ring-1 ring-amber-950/[0.05] shadow-xs hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        >
          <div className="bg-white/95 rounded-[calc(1.75rem-0.25rem)] p-5 h-full flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,1)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#8C7566] uppercase tracking-wider">Modal Terhimpun</span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center border border-blue-200/60 group-hover:scale-105 transition-all">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold text-[#2A1D16] tabular-nums tracking-tight truncate">
                {formatRupiah(totalModalSemua)}
              </div>
              <div className="text-xs font-medium text-blue-800 mt-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-blue-600" /> {investments.length} slot modal
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Total Transfer Terbayar */}
        <div 
          onClick={() => setActiveTab('transfer')}
          className="group bg-amber-950/[0.02] p-1 rounded-[1.75rem] ring-1 ring-amber-950/[0.05] shadow-xs hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        >
          <div className="bg-white/95 rounded-[calc(1.75rem-0.25rem)] p-5 h-full flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,1)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#8C7566] uppercase tracking-wider">Bagi Hasil Terbayar</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center border border-emerald-200/60 group-hover:scale-105 transition-all">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold text-[#2A1D16] tabular-nums tracking-tight truncate">
                {formatRupiah(totalTransferNominal)}
              </div>
              <div className="text-xs font-medium text-emerald-800 mt-1 flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" /> {transfers.length} bukti transfer
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Saran & Pesan */}
        <div 
          onClick={() => setActiveTab('saran')}
          className="col-span-2 lg:col-span-1 group bg-amber-950/[0.02] p-1 rounded-[1.75rem] ring-1 ring-amber-950/[0.05] shadow-xs hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        >
          <div className="bg-white/95 rounded-[calc(1.75rem-0.25rem)] p-5 h-full flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,1)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#8C7566] uppercase tracking-wider">Kotak Saran</span>
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-700 flex items-center justify-center border border-rose-200/60 group-hover:scale-105 transition-all">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold text-[#2A1D16] tabular-nums tracking-tight">{suggestions.length}</div>
              <div className="text-xs font-medium mt-1">
                {pendingSuggestions > 0 ? (
                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-semibold inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    {pendingSuggestions} baru
                  </span>
                ) : (
                  <span className="text-[#8C7566]">Semua ditanggapi</span>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. SEGMENTED CONTROL: CLEAN PILL TRACK */}
      <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
        <div className="flex flex-wrap gap-1 bg-amber-950/[0.04] p-1 rounded-2xl w-fit border border-amber-950/[0.06] shadow-xs">
          
          <button
            onClick={() => setActiveTab('pnl')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'pnl'
                ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white shadow-sm'
                : 'text-[#6E5A4E] hover:text-[#2A1D16] hover:bg-white/60'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Laporan Finansial & P&L</span>
          </button>

          <button
            onClick={() => setActiveTab('daftar')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'daftar'
                ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white shadow-sm'
                : 'text-[#6E5A4E] hover:text-[#2A1D16] hover:bg-white/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Database & Biodata Mitra</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'daftar' ? 'bg-white/25 text-white' : 'bg-amber-100/80 text-amber-900'
            }`}>
              {mitraProfiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('investasi')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'investasi'
                ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white shadow-sm'
                : 'text-[#6E5A4E] hover:text-[#2A1D16] hover:bg-white/60'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Modal & Progres BEP</span>
          </button>

          <button
            onClick={() => setActiveTab('transfer')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'transfer'
                ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white shadow-sm'
                : 'text-[#6E5A4E] hover:text-[#2A1D16] hover:bg-white/60'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Riwayat Transfer</span>
            {transfers.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'transfer' ? 'bg-white/25 text-white' : 'bg-amber-100/80 text-amber-900'
              }`}>
                {transfers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('saran')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeTab === 'saran'
                ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white shadow-sm'
                : 'text-[#6E5A4E] hover:text-[#2A1D16] hover:bg-white/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Kotak Saran</span>
            {pendingSuggestions > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingSuggestions}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 5. TAB CONTENT PANELS */}

      {/* TAB 1: COMPREHENSIVE P&L LAPORAN FINANSIAL */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          {initialPnlData ? (
            <MitraProfitLossSection
              pnlData={initialPnlData}
              currentFilter={currentFilter}
              onFilterChange={handleFilterChange}
              outlets={mitraOutlets}
            />
          ) : (
            <div className="p-14 text-center bg-white/90 backdrop-blur-md rounded-3xl border border-dashed border-amber-200 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[#2A1D16] text-base">Belum Ada Transaksi di Jaringan Kemitraan</h3>
              <p className="text-xs text-[#6E5A4E] max-w-md mx-auto font-normal">
                Silakan sesuaikan filter rentang tanggal atau pastikan outlet mitra telah terhubung dengan data penjualan.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DATABASE & BIODATA MITRA */}
      {activeTab === 'daftar' && (
        <div className="space-y-6">
          
          {/* Search & Status Filter Toolbar */}
          <div className="bg-white/95 rounded-2xl p-4 border border-amber-200/70 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full md:max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Search className="w-4 h-4 text-amber-700/60" />
              </span>
              <input
                type="text"
                placeholder="Cari nama mitra, NIK, bank, nomor rekening, atau outlet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 text-xs sm:text-sm rounded-xl border border-amber-200/80 focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 placeholder:text-[#9E897C] bg-[#FAF7F2] font-normal"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <div className="flex items-center gap-1 bg-[#FAF7F2] p-1 rounded-xl border border-amber-200/70 text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === 'all' ? 'bg-white text-amber-950 shadow-xs font-semibold' : 'text-[#6E5A4E] hover:text-[#2A1D16]'
                  }`}
                >
                  Semua ({mitraProfiles.length})
                </button>
                <button
                  onClick={() => setStatusFilter('aktif')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === 'aktif' ? 'bg-emerald-600 text-white shadow-xs font-semibold' : 'text-[#6E5A4E] hover:text-[#2A1D16]'
                  }`}
                >
                  Aktif ({totalMitraAktif})
                </button>
                <button
                  onClick={() => setStatusFilter('nonaktif')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === 'nonaktif' ? 'bg-rose-600 text-white shadow-xs font-semibold' : 'text-[#6E5A4E] hover:text-[#2A1D16]'
                  }`}
                >
                  Nonaktif ({mitraProfiles.length - totalMitraAktif})
                </button>
              </div>

              <button
                onClick={handleAdd}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          {/* Cards Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMitra.map((mitra: any) => {
              const staffUser = allUsers.find((u: any) => u.id === mitra.user_id)
              const outletCount = mitra.outlet_ids?.length || 0
              const avatarGrad = getAvatarGradient(mitra.nama_mitra)
              const initials = getInitials(mitra.nama_mitra)

              return (
                <div 
                  key={mitra.id || mitra.user_id} 
                  className="group bg-white/95 rounded-3xl border border-amber-200/70 p-6 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    
                    {/* Header: Avatar, Name, User, Status */}
                    <div className="flex items-start gap-3.5 pb-3.5 border-b border-amber-100">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarGrad} text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm`}>
                        {initials}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[#2A1D16] text-base leading-snug truncate group-hover:text-amber-600 transition-colors">
                          {mitra.nama_mitra}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#6E5A4E]">
                          <UserCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate font-medium">
                            {staffUser ? `@${staffUser.username}` : `ID: ${mitra.user_id?.substring(0, 8)}...`}
                          </span>
                        </div>
                      </div>

                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider shrink-0 shadow-xs ${
                        mitra.status === 'nonaktif' 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {mitra.status || 'Aktif'}
                      </span>
                    </div>

                    {/* NIK & Kontak WhatsApp */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="bg-[#FAF7F2] p-2.5 rounded-2xl border border-amber-200/50">
                        <span className="text-[10px] font-semibold text-[#8C7566] uppercase tracking-wider flex items-center gap-1">
                          <User className="w-3 h-3 text-amber-600" /> NIK / KTP
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono font-medium text-[#2A1D16] text-xs truncate">
                            {mitra.nik || '-'}
                          </span>
                          {mitra.nik && (
                            <button
                              onClick={() => handleCopy(mitra.nik, `nik-${mitra.id}`)}
                              className="text-[#8C7566] hover:text-amber-700 transition-colors"
                              title="Salin NIK"
                            >
                              {copiedKey === `nik-${mitra.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="bg-[#FAF7F2] p-2.5 rounded-2xl border border-amber-200/50">
                        <span className="text-[10px] font-semibold text-[#8C7566] uppercase tracking-wider flex items-center gap-1">
                          <Phone className="w-3 h-3 text-amber-600" /> WhatsApp
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-medium text-[#2A1D16] text-xs truncate">
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
                    <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/80 shadow-xs">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-amber-950 uppercase mb-1">
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-amber-600" /> Rekening Bagi Hasil
                        </span>
                        <span className="font-bold px-2 py-0.5 bg-amber-600 text-white rounded-md text-[10px]">
                          {mitra.profit_sharing_pct ?? 50}% Profit
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="font-bold text-sm text-[#2A1D16]">
                          {mitra.bank_name || 'BCA'} • {mitra.bank_account_number || '-'}
                        </div>
                        {mitra.bank_account_number && (
                          <button
                            onClick={() => handleCopy(mitra.bank_account_number, `bank-${mitra.id}`)}
                            className="text-[#8C7566] hover:text-amber-700 transition-colors p-1"
                            title="Salin Nomor Rekening"
                          >
                            {copiedKey === `bank-${mitra.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-[#6E5A4E] font-normal mt-0.5">
                        a.n. {mitra.bank_account_holder || mitra.nama_mitra}
                      </div>
                    </div>

                    {/* Legalitas & PKS */}
                    <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-amber-200/50 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-[#8C7566] uppercase">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-amber-600" /> Kontrak PKS
                        </span>
                        <span className="font-normal text-[#8C7566]">
                          Berakhir: {formatDate(mitra.tanggal_berakhir_pks)}
                        </span>
                      </div>
                      <div className="font-mono font-medium text-xs text-[#2A1D16] truncate">
                        {mitra.no_pks || 'Belum diisi'}
                      </div>
                    </div>

                    {/* Akses Outlet */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#8C7566] uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-amber-600" /> Akses Outlet
                        </span>
                        <span className="text-[#8C7566] font-medium">{outletCount} Unit</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 min-h-[30px]">
                        {mitra.outlet_ids?.map((oid: string) => {
                          const outlet = allOutlets.find((o: any) => o.id === oid)
                          return (
                            <span 
                              key={oid} 
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100/70 text-[#2A1D16] border border-amber-200 text-xs font-medium rounded-xl shadow-xs"
                            >
                              <Store className="w-3 h-3 text-amber-600" />
                              {outlet?.name || 'Unknown'}
                            </span>
                          )
                        })}
                        {outletCount === 0 && (
                          <div className="text-xs text-gray-400 italic py-1">Belum ada outlet terhubung</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Button */}
                  <div className="pt-3.5 mt-2 border-t border-amber-100">
                    <button 
                      onClick={() => handleEdit(mitra)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500/10 hover:bg-amber-600 hover:text-white text-amber-950 font-semibold rounded-xl transition-all duration-200 text-xs border border-amber-200/80 hover:border-amber-600 shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Biodata & Akses Outlet</span>
                    </button>
                  </div>

                </div>
              )
            })}

            {filteredMitra.length === 0 && (
              <div className="col-span-full bg-white/90 rounded-3xl border border-dashed border-amber-200 p-14 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-[#2A1D16] text-base">Tidak ada data mitra ditemukan</h3>
                <p className="text-xs text-[#6E5A4E] max-w-sm mx-auto font-normal">
                  {searchQuery ? `Tidak ditemukan profil mitra dengan kata kunci "${searchQuery}".` : 'Belum ada data profil mitra yang ditambahkan ke sistem.'}
                </p>
                <button
                  onClick={handleAdd}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-xs font-semibold shadow-xs"
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
          <div className="bg-white/95 rounded-2xl p-5 border border-amber-200/70 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full mb-1.5 border border-amber-200/70">
                <Activity className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-900 tracking-wider uppercase">
                  Pelacak Balik Modal (ROI & BEP)
                </span>
              </div>
              <h3 className="font-bold text-[#2A1D16] text-base sm:text-lg">Monitoring Modal Investasi & Status BEP</h3>
              <p className="text-xs text-[#6E5A4E] font-normal mt-0.5">
                Pantau progres pengembalian investasi (BEP) tiap outlet berdasarkan akumulasi transfer bagi hasil riil.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-[#FAF7F2] p-3 rounded-2xl border border-amber-200/60 shrink-0 flex-wrap sm:flex-nowrap">
              <div>
                <span className="text-[10px] font-semibold text-[#8C7566] uppercase tracking-wider block">Total Modal Awal</span>
                <span className="font-bold text-sm sm:text-base text-[#2A1D16]">{formatRupiah(totalModalSemua)}</span>
              </div>
              <div className="h-8 w-px bg-amber-200/60 hidden sm:block" />
              <div>
                <span className="text-[10px] font-semibold text-[#8C7566] uppercase tracking-wider block">Total Laba Kembali (Realtime)</span>
                <span className="font-bold text-sm sm:text-base text-emerald-700">{formatRupiah(totalDanaKembaliSemua)}</span>
              </div>
              <div className="h-8 w-px bg-amber-200/60 hidden sm:block" />
              <div>
                <span className="text-[10px] font-semibold text-[#8C7566] uppercase tracking-wider block">Status BEP Jaringan</span>
                <span className="font-bold text-sm sm:text-base text-amber-800">{bepCount} / {mitraOutlets.length} Outlet</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mitraOutlets.map((outlet: any) => {
              const inv = investmentMap[outlet.id]
              const totalModal = Number(inv?.nilai_investasi) || 0
              const ownerMitra = mitraProfiles.find((m: any) => (m.outlet_ids || []).includes(outlet.id))
              const profitSharePct = inv?.persentase_bagi_hasil ?? ownerMitra?.profit_sharing_pct ?? 50

              const bepData = realtimeBepMap[outlet.id]
              const omzetHistoris = Number(inv?.omzet_historis) || 0
              const transferHistoris = Number(inv?.transfer_historis) || 0
              const realtimeMitraShare = bepData?.mitraShare || 0

              const totalReturned = bepData ? bepData.totalDanaKembali : (omzetHistoris + transferHistoris)
              const roiRaw = totalModal > 0 ? (totalReturned / totalModal) * 100 : 0
              const bepPercentage = bepData ? bepData.bepPercentage : Math.min(Math.round(roiRaw * 10) / 10, 100)
              const isBep = bepData ? bepData.isBep : (totalModal > 0 && totalReturned >= totalModal)
              const sisaModal = bepData ? bepData.sisaModal : Math.max(0, totalModal - totalReturned)

              return (
                <div 
                  key={outlet.id} 
                  className="group bg-white/95 rounded-3xl p-6 border border-amber-200/70 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header Outlet & BEP Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/10 text-amber-700 rounded-2xl border border-amber-200/80">
                          <Store className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[#2A1D16] text-base">{outlet.name}</h4>
                          <span className="text-xs text-[#6E5A4E] font-normal">
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
                          <TrendingUp className="w-3 h-3 text-amber-600" />
                          <span>BEP: {bepPercentage}%</span>
                        </span>
                      )}
                    </div>

                    {/* Progress Balik Modal Box */}
                    <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-amber-200/70 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-[#2A1D16] flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-amber-600" />
                          <span>Progres Balik Modal (BEP)</span>
                        </span>
                        <span className={`font-bold ${isBep ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {bepPercentage}%
                        </span>
                      </div>

                      {/* Progress Track */}
                      <div className="w-full bg-amber-200/40 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ${
                            isBep 
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                              : 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500'
                          }`}
                          style={{ width: `${Math.max(bepPercentage, totalReturned > 0 ? 4 : 0)}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] pt-1 text-[#6E5A4E]">
                        <span>Total Kembali: <strong className="text-emerald-700 font-bold">{formatRupiah(totalReturned)}</strong></span>
                        <span>
                          {isBep ? (
                            <strong className="text-emerald-700 font-bold">Laba Murni (100% BEP)</strong>
                          ) : (
                            <>Sisa: <strong className="text-red-500 font-semibold">{formatRupiah(sisaModal)}</strong></>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Investment & Contract Details */}
                    <div className="p-4 bg-white rounded-2xl border border-amber-200/60 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#8C7566] font-medium">Modal Investasi Awal:</span>
                        <span className="font-bold text-[#2A1D16]">{formatRupiah(totalModal)}</span>
                      </div>
                      {omzetHistoris > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#8C7566] font-medium">Profit Historis Pra-Digital:</span>
                          <span className="font-bold text-emerald-800">{formatRupiah(omzetHistoris)}</span>
                        </div>
                      )}
                      {realtimeMitraShare > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#8C7566] font-medium">Laba Riil Sistem (Sejak 1 Ags 2026):</span>
                          <span className="font-bold text-emerald-800">{formatRupiah(realtimeMitraShare)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-[#8C7566] font-medium">Porsi Bagi Hasil:</span>
                        <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 text-[11px]">
                          {profitSharePct}% Mitra
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8C7566] font-medium">Management Fee Pusat:</span>
                        <span className={`font-semibold ${Number(inv?.management_fee) > 0 ? 'text-amber-800 font-bold' : 'text-[#6E5A4E]'}`}>
                          {Number(inv?.management_fee) > 0 ? `${inv.management_fee}% Omzet` : '0% (Nonaktif)'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8C7566] font-medium">Tanggal Mulai Usaha:</span>
                        <span className="font-medium text-[#2A1D16]">{formatDate(inv?.tanggal_mulai)}</span>
                      </div>
                      {inv?.catatan && (
                        <p className="text-[11px] text-[#6E5A4E] italic pt-1 border-t border-amber-200/50">
                          &ldquo;{inv.catatan}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-amber-100">
                    <button 
                      onClick={() => setInvestmentOutlet(outlet)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold rounded-xl transition-all duration-200 text-xs shadow-xs"
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
          isOpen={!!investmentOutlet} 
          onClose={() => setInvestmentOutlet(null)}
          outlet={investmentOutlet}
          initialInvestment={investmentMap[investmentOutlet.id]}
        />
      )}
    </div>
  )
}
