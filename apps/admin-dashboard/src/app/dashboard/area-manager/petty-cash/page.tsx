'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  CheckCircle2, Clock, Store, 
  ArrowRight, Loader2, RefreshCw, 
  X, Download, User, Check, AlertCircle, FileText,
  Calendar, MapPin, ChevronDown, Wallet
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatRupiah } from '@/lib/validations'
import { formatRelativeTime } from '@/lib/date'
import { toast } from 'sonner'
import { getAreaManagerPettyCashTopups } from './actions'
import { motion, AnimatePresence } from 'framer-motion'

interface TopupRequest {
  id: string
  outlet_id: string
  amount: number
  description: string
  status: string
  created_at: string
  created_by?: string | null
  created_by_staff?: { name: string; role: string } | null
  bank_name?: string | null
  bank_account_number?: string | null
  bank_account_name?: string | null
  proof_of_transfer_url?: string | null
  outlet?: { name: string; region?: string | null } | null
}

function parseFinanceNote(description?: string | null) {
  if (!description) return { mainReason: '', financeNote: null }

  const splitMarker = '📌 ['
  if (description.includes(splitMarker)) {
    const parts = description.split(splitMarker)
    const mainReason = parts[0].trim()
    const financeNote = parts[1].replace(/\]$/, '').trim()
    return { mainReason, financeNote }
  }

  if (description.includes('(Catatan Finance:')) {
    const parts = description.split('(Catatan Finance:')
    const mainReason = parts[0].trim()
    const financeNote = 'Catatan Finance:' + parts[1].replace(/\)$/, '').trim()
    return { mainReason, financeNote }
  }

  return { mainReason: description, financeNote: null }
}

function ProofImageLightbox({ imageUrl, onClose }: { imageUrl: string | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {imageUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col"
          >
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 px-2 text-sm">Lampiran Bukti Transfer</h3>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-50/50">
              <img 
                src={imageUrl} 
                alt="Bukti Transfer" 
                className="max-h-[60vh] w-auto object-contain rounded-lg shadow-sm border border-slate-200/60" 
              />
            </div>
            
            <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                download="Bukti_Transfer.jpg"
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#4a1c15] text-white rounded-lg font-medium text-sm hover:bg-[#38130e] transition-colors"
              >
                <Download className="w-4 h-4" /> Unduh Dokumen
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function CustomSelect({ 
  value, 
  onChange, 
  options, 
  icon: Icon,
  placeholder = 'Pilih...',
  searchable = false
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: { label: string; value: string }[];
  icon: any;
  placeholder?: string;
  searchable?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selectedLabel = options.find(o => o.value === value)?.label || placeholder

  const filteredOptions = searchable 
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  return (
    <div className="relative">
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          setSearch('')
        }}
        className="w-full sm:min-w-[200px] flex items-center justify-between gap-3 pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 text-slate-700 rounded-lg text-sm font-medium focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-sm hover:bg-slate-50 transition-colors"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2 w-56 sm:w-64 bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col"
            >
              {searchable && (
                <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari outlet..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-sm"
                    autoFocus
                  />
                </div>
              )}
              <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        onChange(opt.value)
                        setIsOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        value === opt.value ? 'bg-[#4a1c15] text-white font-medium shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-slate-500 text-center">Tidak ditemukan</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AreaManagerPettyCashPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<TopupRequest[]>([])
  const [availableOutlets, setAvailableOutlets] = useState<{id: string, name: string, region: string}[]>([])
  const [outletBalances, setOutletBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null)

  // Status Filters
  const [activeTab, setActiveTab] = useState<'review' | 'history'>('review')
  const [reviewFilter, setReviewFilter] = useState<'all' | 'unapproved' | 'ready_handover'>('all')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'acc_finance' | 'forwarded_leader' | 'completed' | 'rejected'>('all')

  // Additional Filters
  const [outletFilter, setOutletFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days'>('all')

  const loadRequests = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const res = await getAreaManagerPettyCashTopups()
      if (!res.success) throw new Error(res.error)

      if (res.data) {
        const mapped = res.data.map((r: any) => ({
          ...r,
          outlet: r.outlets ? { name: r.outlets.name, region: r.outlets.region } : null
        }))
        setRequests(mapped)
      }
      
      if (res.outlets) {
        setAvailableOutlets(res.outlets)
      }

      const balanceClient = createClient()
      const { data: balanceRows } = await balanceClient.rpc('get_all_latest_petty_cash_balances')
      setOutletBalances(Object.fromEntries(
        ((balanceRows || []) as { outlet_id: string; balance: number }[])
          .map((row) => [row.outlet_id, Number(row.balance) || 0])
      ))
    } catch (err: any) {
      console.error(err)
      if (!isSilent) toast.error('Gagal memuat data: ' + err.message)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadRequests()

    const channel = supabase
      .channel('am-petty-cash-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'petty_cash_topups' },
        () => loadRequests(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => loadRequests(true)
      )
      .subscribe()

    const interval = setInterval(() => loadRequests(true), 15000)
    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [loadRequests, supabase])

  async function handleApprove(id: string) {
    if (!confirm('Setujui pengajuan ini?')) return
    setIsProcessing(id)
    const prev = [...requests]
    setRequests(p => p.map(r => r.id === id ? { ...r, status: 'forwarded_to_finance' } : r))
    try {
      const { error } = await supabase.rpc('area_manager_process_petty_cash', { p_topup_id: id, p_action: 'approve' })
      if (error) throw error
      toast.success('Disetujui!')
    } catch (err: any) {
      setRequests(prev)
      toast.error('Gagal: ' + err.message)
    } finally {
      setIsProcessing(null)
      loadRequests(true)
    }
  }

  async function handleReject(id: string) {
    if (!confirm('Tolak pengajuan ini?')) return
    setIsProcessing(id)
    const prev = [...requests]
    setRequests(p => p.map(r => r.id === id ? { ...r, status: 'rejected' } : r))
    try {
      const { error } = await supabase.rpc('area_manager_process_petty_cash', { p_topup_id: id, p_action: 'reject' })
      if (error) throw error
      toast.error('Ditolak.')
    } catch (err: any) {
      setRequests(prev)
      toast.error('Gagal menolak: ' + err.message)
    } finally {
      setIsProcessing(null)
      loadRequests(true)
    }
  }

  async function handleForwardToLeader(id: string) {
    if (!confirm('Serahkan dana ke Leader?')) return
    setIsProcessing(id)
    const prev = [...requests]
    setRequests(p => p.map(r => r.id === id ? { ...r, status: 'forwarded_by_area_manager' } : r))
    try {
      const { error } = await supabase.rpc('area_manager_forward_funds', { p_topup_id: id })
      if (error) throw error
      toast.success('Diserahkan ke Leader!')
    } catch (err: any) {
      setRequests(prev)
      toast.error('Gagal menyerahkan: ' + err.message)
    } finally {
      setIsProcessing(null)
      loadRequests(true)
    }
  }

  // Filter options
  const outletOptions = [
    { label: 'Semua Outlet', value: 'all' },
    ...availableOutlets.map(o => ({ label: o.name, value: o.name }))
  ]
  
  const dateOptions = [
    { label: 'Semua Tanggal', value: 'all' },
    { label: 'Hari Ini', value: 'today' },
    { label: 'Kemarin', value: 'yesterday' },
    { label: '7 Hari Terakhir', value: '7days' },
    { label: '30 Hari Terakhir', value: '30days' },
  ]

  // Date filter helper
  const isDateInRange = (dateStr: string, range: string) => {
    if (range === 'all') return true
    
    const date = new Date(dateStr)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const requestDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    const diffTime = today.getTime() - requestDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (range === 'today') return diffDays === 0
    if (range === 'yesterday') return diffDays === 1
    if (range === '7days') return diffDays >= 0 && diffDays <= 7
    if (range === '30days') return diffDays >= 0 && diffDays <= 30
    
    return true
  }

  const allReview = requests.filter(r => ['pending', 'forwarded_to_area_manager', 'approved_by_finance', 'forwarded_by_finance'].includes(r.status))
  const allHistory = requests.filter(r => !['pending', 'forwarded_to_area_manager', 'approved_by_finance', 'forwarded_by_finance'].includes(r.status))

  const filteredReview = allReview.filter(r => {
    if (reviewFilter === 'unapproved' && !['pending', 'forwarded_to_area_manager'].includes(r.status)) return false
    if (reviewFilter === 'ready_handover' && !['approved_by_finance', 'forwarded_by_finance'].includes(r.status)) return false
    
    if (outletFilter !== 'all' && r.outlet?.name !== outletFilter) return false
    if (!isDateInRange(r.created_at, dateFilter)) return false

    return true
  })

  const filteredHistory = allHistory.filter(r => {
    if (historyFilter === 'acc_finance' && r.status !== 'forwarded_to_finance') return false
    if (historyFilter === 'forwarded_leader' && r.status !== 'forwarded_by_area_manager') return false
    if (historyFilter === 'completed' && !['forwarded_by_leader', 'completed'].includes(r.status)) return false
    if (historyFilter === 'rejected' && r.status !== 'rejected') return false

    if (outletFilter !== 'all' && r.outlet?.name !== outletFilter) return false
    if (!isDateInRange(r.created_at, dateFilter)) return false

    return true
  })

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 font-sans">
      
      {/* Sleek Page Header (Minimalist) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Dana Operasional Cabang</h2>
          <p className="text-sm text-slate-500 mt-0.5">Kelola dan setujui pengajuan petty cash dari tim outlet.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadRequests(false)}
            disabled={loading || isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200/60 text-slate-600 rounded-md text-xs font-medium hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-slate-900' : ''}`} />
            Muat Ulang
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">Saldo Petty Cash Outlet</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableOutlets
            .filter((outlet) => outletFilter === 'all' || outlet.name === outletFilter)
            .map((outlet) => (
              <div key={outlet.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <p className="truncate text-xs font-semibold text-slate-500">{outlet.name}</p>
                <p className="mt-1 text-lg font-black text-slate-900">{formatRupiah(outletBalances[outlet.id] ?? 0)}</p>
              </div>
            ))}
        </div>
      </section>

      {/* Segmented Control for Tabs (Startup Aesthetic) */}
      <div className="bg-slate-100/70 p-1 rounded-lg inline-flex w-full sm:w-auto">
        {[
          { id: 'review', label: 'Butuh Review', count: allReview.length },
          { id: 'history', label: 'Riwayat', count: allHistory.length }
        ].map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                isActive 
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] leading-none ${
                isActive ? 'bg-slate-100 text-slate-900 font-semibold' : 'bg-slate-200/50 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filters Area */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/60 pb-4">
        
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'review' ? (
            <>
              {[
                { id: 'all', label: 'Semua Status' },
                { id: 'unapproved', label: 'Belum di-ACC' },
                { id: 'ready_handover', label: 'Siap Diserahkan' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setReviewFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                    reviewFilter === f.id 
                      ? 'bg-[#4a1c15] border-[#4a1c15] text-white shadow-sm' 
                      : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </>
          ) : (
            <>
              {[
                { id: 'all', label: 'Semua Riwayat' },
                { id: 'acc_finance', label: 'Proses Finance' },
                { id: 'completed', label: 'Selesai' },
                { id: 'rejected', label: 'Ditolak' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setHistoryFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                    historyFilter === f.id 
                      ? 'bg-slate-800 border-slate-800 text-white shadow-sm' 
                      : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Global Select Filters (Outlet & Date) - Custom UI */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto z-20">
          <div className="flex-1 lg:flex-none">
            <CustomSelect 
              value={outletFilter}
              onChange={setOutletFilter}
              options={outletOptions}
              icon={MapPin}
              searchable={true}
            />
          </div>
          <div className="flex-1 lg:flex-none">
            <CustomSelect 
              value={dateFilter}
              onChange={(val) => setDateFilter(val as any)}
              options={dateOptions}
              icon={Calendar}
            />
          </div>
        </div>
      </div>

      {/* List Container */}
      <div className="space-y-3 z-10 relative">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-white/50 border border-slate-200/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {activeTab === 'review' && filteredReview.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-16 text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-full mb-3 text-emerald-600 ring-4 ring-emerald-50/50">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Semua Selesai</h3>
                <p className="text-sm text-slate-500 mt-1">Tidak ada data yang sesuai filter saat ini.</p>
              </motion.div>
            )}

            {activeTab === 'history' && filteredHistory.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-16 text-center text-sm text-slate-500"
              >
                Tidak ada riwayat yang ditemukan.
              </motion.div>
            )}

            {/* Render Items */}
            {(activeTab === 'review' ? filteredReview : filteredHistory).map((req) => {
              const { mainReason, financeNote } = parseFinanceNote(req.description)
              const isPending = req.status === 'pending' || req.status === 'forwarded_to_area_manager'
              const isReady = req.status === 'approved_by_finance' || req.status === 'forwarded_by_finance'
              
              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  key={req.id} 
                  className="group bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-5"
                >
                  {/* Info Section */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    
                    {/* Metadata Header */}
                    <div className="flex items-center gap-2.5 text-[11px] font-semibold tracking-wide uppercase text-slate-400">
                      <span className="text-[#4a1c15] flex items-center gap-1">
                        <Store className="w-3.5 h-3.5" />
                        {req.outlet?.name}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(req.created_at)}
                      </span>
                      <span className="text-slate-300 hidden sm:inline">•</span>
                      <span className="hidden sm:inline">ID: {req.id.slice(0, 8)}</span>
                    </div>

                    {/* Main Title */}
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate leading-tight">
                      {mainReason}
                    </h3>
                    
                    {/* Requestor & Account */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> 
                        {req.created_by_staff?.name || 'Leader'}
                      </span>
                      <span className="hidden sm:inline text-slate-300">|</span>
                      {req.bank_name ? (
                        <span className="truncate">
                          <strong className="text-slate-700">{req.bank_name}</strong> {req.bank_account_number} (a.n {req.bank_account_name})
                        </span>
                      ) : (
                        <span className="italic text-slate-400">Informasi rekening tidak tersedia</span>
                      )}
                    </div>

                    {/* Finance Note Alert */}
                    {financeNote && (
                      <div className="mt-2 inline-flex items-start gap-1.5 bg-amber-50/50 text-amber-800 border border-amber-100/50 px-2.5 py-1.5 rounded text-xs">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                        <span className="font-medium leading-relaxed">{financeNote}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Section (Amount + Status/Actions) */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 gap-3">
                    
                    <div className="text-left md:text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        {activeTab === 'review' ? (isPending ? 'Menunggu ACC' : 'Siap Cair') : 'Total Pengajuan'}
                      </div>
                      <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                        {formatRupiah(req.amount)}
                      </div>
                    </div>

                    {/* Review Actions */}
                    {activeTab === 'review' && (
                      <div className="flex items-center gap-2">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={isProcessing === req.id}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            >
                              Tolak
                            </button>
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={isProcessing === req.id}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#4a1c15] text-white rounded-md text-xs font-semibold hover:bg-[#38130e] shadow-sm transition-colors"
                            >
                              {isProcessing === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              ACC
                            </button>
                          </>
                        )}
                        {isReady && (
                          <button
                            onClick={() => handleForwardToLeader(req.id)}
                            disabled={isProcessing === req.id}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800 shadow-sm transition-colors"
                          >
                            {isProcessing === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Serahkan'}
                            {!isProcessing && <ArrowRight className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    )}

                    {/* History Actions / Status */}
                    {activeTab === 'history' && (
                      <div className="flex items-center gap-2">
                        {req.status === 'forwarded_to_finance' && <span className="inline-flex items-center px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200/50 rounded text-[10px] font-bold uppercase tracking-wider">Di Finance</span>}
                        {(req.status === 'completed' || req.status === 'forwarded_by_leader') && <span className="inline-flex items-center px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded text-[10px] font-bold uppercase tracking-wider">Selesai</span>}
                        {req.status === 'rejected' && <span className="inline-flex items-center px-2 py-1 bg-red-50 text-red-700 border border-red-200/50 rounded text-[10px] font-bold uppercase tracking-wider">Ditolak</span>}
                        
                        {req.proof_of_transfer_url && (
                          <button
                            onClick={() => setSelectedProofUrl(req.proof_of_transfer_url || null)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-50 transition-colors text-[10px] font-bold uppercase tracking-wider"
                          >
                            <FileText className="w-3 h-3" /> Bukti
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      <ProofImageLightbox imageUrl={selectedProofUrl} onClose={() => setSelectedProofUrl(null)} />
    </div>
  )
}
