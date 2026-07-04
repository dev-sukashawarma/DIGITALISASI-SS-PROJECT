'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, LogIn, LogOut, Receipt, PlusCircle, AlertTriangle, CheckCircle2, Loader2, User, Clock, Banknote, ArrowDownToLine, Calculator, Lock, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import { Skeleton } from '@/components/Skeleton'
import { useDialogStore } from '@/lib/dialogStore'

interface Shift {
  id: string
  status: 'open' | 'closed'
  starting_cash: number
  starting_petty_cash?: number
  start_time: string
  staff_id: string
  end_time?: string
  closed_by?: string
  actual_ending_cash?: number
  expected_ending_cash?: number
  variance?: number
}

interface Expense {
  id: string
  category: string
  amount: number
  description: string
  expense_date: string
  created_at: string
  created_by?: string | null
  creator?: { name: string | null } | null
  receipt_url?: string | null
}

interface PettyCashTopup {
  id: string
  amount: number
  description: string
  status: string
  created_at: string
  created_by?: string | null
  creator?: { name: string | null } | null
  approved_at?: string | null
  approved_by?: string | null
}

interface CashOrder {
  id: string
  order_number: string
  total_amount: number
  created_at: string
}

type LedgerItem = 
  | { type: 'expense'; data: Expense; date: Date }
  | { type: 'topup'; data: PettyCashTopup; date: Date }
  | { type: 'sale'; data: CashOrder; date: Date }

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatTime(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const CATEGORY_LABEL: Record<string, string> = {
  bahan_baku: 'Bahan Baku',
  operasional: 'Operasional',
  utilitas: 'Utilitas',
  lainnya: 'Lainnya',
}

export default function ShiftPage() {
  const { showConfirm } = useDialogStore()
  const { outletId } = useMyOutlet()
  const supabase = createClient()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [topups, setTopups] = useState<PettyCashTopup[]>([])
  const [cashOrders, setCashOrders] = useState<CashOrder[]>([])
  const [pettyCashBalance, setPettyCashBalance] = useState<number>(0)
  
  // Forms
  const [startingPettyCash, setStartingPettyCash] = useState<string>('')
  const [pettyCashLocked, setPettyCashLocked] = useState(false)
  const [actualEndingCash, setActualEndingCash] = useState<string>('')
  const [actualEndingPettyCash, setActualEndingPettyCash] = useState<string>('')
  
  // Expense Form
  const [expCategory, setExpCategory] = useState<string>('operasional')
  const [expAmount, setExpAmount] = useState<string>('')
  const [expDesc, setExpDesc] = useState<string>('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  // Topup Form
  const [showTopupModal, setShowTopupModal] = useState(false)
  const [topupAmount, setTopupAmount] = useState<string>('')
  const [topupDesc, setTopupDesc] = useState<string>('')

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null)

  const shiftSalesTotal = useMemo(
    () => cashOrders.reduce((s, o) => s + Number(o.total_amount), 0),
    [cashOrders],
  )

  const currentDrawerBalance = useMemo(
    () => (activeShift ? Number(activeShift.starting_cash) + shiftSalesTotal : 0),
    [activeShift, shiftSalesTotal],
  )

  const approvedTopupsTotal = useMemo(
    () => topups.filter(t => t.status === 'approved').reduce((s, t) => s + Number(t.amount), 0),
    [topups],
  )

  const expensesTotal = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount), 0),
    [expenses],
  )

  // Selisih live antara hitungan manual kasir vs perhitungan sistem
  const cashDiff = useMemo(() => {
    const v = parseFloat(actualEndingCash)
    return isNaN(v) ? null : v - currentDrawerBalance
  }, [actualEndingCash, currentDrawerBalance])

  const pettyCashDiff = useMemo(() => {
    const v = parseFloat(actualEndingPettyCash)
    return isNaN(v) ? null : v - pettyCashBalance
  }, [actualEndingPettyCash, pettyCashBalance])

  const ledgerItems = useMemo<LedgerItem[]>(() => {
    const items: LedgerItem[] = []
    expenses.forEach(e => items.push({ type: 'expense', data: e, date: new Date(e.created_at) }))
    topups.forEach(t => items.push({ type: 'topup', data: t, date: new Date(t.created_at) }))
    cashOrders.forEach(o => items.push({ type: 'sale', data: o, date: new Date(o.created_at) }))
    return items.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [expenses, topups, cashOrders])

  useEffect(() => {
    if (outletId) fetchCurrentState()
  }, [outletId])

  async function fetchCurrentState() {
    try {
      setLoading(true)
      setErrorMsg('')

      const { data: shiftData, error: shiftError } = await supabase
        .from('shifts')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('status', 'open')
        .maybeSingle()

      if (shiftError) throw shiftError
      setActiveShift(shiftData || null)

      // Get Petty Cash Balance
      const { data: pcData } = await supabase.rpc('get_petty_cash_balance', { p_outlet_id: outletId })
      setPettyCashBalance(Number(pcData) || 0)

      if (shiftData) {
        // We fetch expenses, topups, and orders since shift start
        const fetchCreators = async (items: any[]) => {
          const ids = Array.from(new Set(items.map((i) => i.created_by).filter(Boolean)))
          if (ids.length === 0) return items
          const { data: staff } = await supabase.from('outlet_staff').select('id, name').in('id', ids)
          const nameMap = new Map((staff || []).map((s: any) => [s.id, s.name]))
          items.forEach((i) => {
            if (i.created_by) i.creator = { name: nameMap.get(i.created_by) ?? null }
          })
          return items
        }

        const [expRes, topRes, ordRes] = await Promise.all([
          supabase.from('petty_cash_expenses').select('*').eq('outlet_id', outletId).gte('created_at', shiftData.start_time),
          supabase.from('petty_cash_topups').select('*').eq('outlet_id', outletId).gte('created_at', shiftData.start_time),
          supabase.from('orders').select('id, order_number, total_amount, created_at').eq('outlet_id', outletId).eq('payment_method', 'cash').eq('status', 'completed').gte('created_at', shiftData.start_time)
        ])

        setExpenses(await fetchCreators(expRes.data || []))
        setTopups(await fetchCreators(topRes.data || []))
        setCashOrders(ordRes.data || [])
      } else {
        setExpenses([])
        setTopups([])
        setCashOrders([])

        // Kunci nominal setoran awal Dana Operasional ke SETORAN AWAL (starting_petty_cash)
        // shift terakhir — BUKAN sisa/hitungan akhir laci. Jadi buka shift selalu
        // reset ke nominal setoran standar (mis. 300K), bukan mengikuti sisa shift lalu.
        // Ambil shift terakhir yang punya setoran awal valid (> 0) agar baris anomali
        // (0/null) tidak "mengunci" outlet ke nominal keliru selamanya.
        const { data: lastShift } = await supabase
          .from('shifts')
          .select('starting_petty_cash')
          .eq('outlet_id', outletId)
          .gt('starting_petty_cash', 0)
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastShift && lastShift.starting_petty_cash !== null && lastShift.starting_petty_cash !== undefined) {
          setStartingPettyCash(String(lastShift.starting_petty_cash))
          setPettyCashLocked(true)
        } else {
          setPettyCashLocked(false)
        }
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Gagal memuat data shift')
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenShift(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)
    try {
      const amount = parseFloat(startingPettyCash)
      if (isNaN(amount) || amount < 0) throw new Error('Saldo awal Petty Cash tidak valid')
      const { error } = await supabase.rpc('open_shift', { p_outlet_id: outletId, p_starting_petty_cash: amount })
      if (error) throw error
      setSuccessMsg('Shift berhasil dibuka')
      setStartingPettyCash('')
      await fetchCurrentState()
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuka shift')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)
    try {
      const amount = parseFloat(expAmount)
      if (isNaN(amount) || amount <= 0) throw new Error('Nominal pengeluaran tidak valid')
      if (!expDesc.trim()) throw new Error('Keterangan harus diisi')
      if (!receiptFile) throw new Error('Foto struk/bukti wajib dilampirkan')
      
      const today = new Date().toISOString().split('T')[0]

      let receiptUrl = null
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${outletId}/${fileName}`
        const { error: uploadError } = await supabase.storage.from('petty-cash-receipts').upload(filePath, receiptFile)
        if (uploadError) throw new Error(`Gagal mengunggah foto struk: ${uploadError.message}`)
        const { data: publicUrlData } = supabase.storage.from('petty-cash-receipts').getPublicUrl(filePath)
        receiptUrl = publicUrlData.publicUrl
      }

      // MOCK UPLOAD: In real app, upload receiptFile to Supabase Storage here
      const dummyReceiptUrl = `https://storage.sukashawarma.com/receipts/${Date.now()}.jpg`

      // Try calling RPC first (assuming we updated it to accept p_receipt_url)
      const { error } = await supabase.rpc('add_petty_cash', {
        p_category: expCategory,
        p_amount: amount,
        p_description: expDesc.trim(),
        p_receipt_url: receiptUrl
      })

      if (error) {
        throw error
      }

      setSuccessMsg('Pengeluaran berhasil dicatat')
      setExpAmount('')
      setExpDesc('')
      setExpCategory('operasional')
      setReceiptFile(null)
      await fetchCurrentState()
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mencatat pengeluaran (mungkin saldo kurang)')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAddTopup(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)
    try {
      const amount = parseFloat(topupAmount)
      if (isNaN(amount) || amount <= 0) throw new Error('Nominal top-up tidak valid')
      if (!topupDesc.trim()) throw new Error('Keterangan harus diisi')
      
      const { error } = await supabase.from('petty_cash_topups').insert({
        outlet_id: outletId,
        amount,
        description: topupDesc.trim(),
        created_by: (await supabase.auth.getUser()).data.user?.id
      })

      if (error) throw error

      setSuccessMsg('Pengajuan top up petty cash berhasil dikirim. Menunggu persetujuan Leader/Manajer.')
      setTopupAmount('')
      setTopupDesc('')
      setShowTopupModal(false)
      await fetchCurrentState()
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mencatat top up')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCloseShift(e: React.FormEvent) {
    e.preventDefault()
    if (!activeShift) return
    const confirmed = await showConfirm('Tutup shift sekarang? Setelah ditutup Anda tidak bisa melakukan transaksi tunai.')
    if (!confirmed) return
    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)
    try {
      const cash = parseFloat(actualEndingCash)
      const pc = parseFloat(actualEndingPettyCash)
      if (isNaN(cash) || cash < 0) throw new Error('Hitungan kas laci tidak valid')
      if (isNaN(pc) || pc < 0) throw new Error('Hitungan asli dana operasional tidak valid')

      const { error } = await supabase.rpc('close_shift_blind', {
        p_shift_id: activeShift.id,
        p_actual_cash: cash,
        p_actual_petty_cash: pc
      })

      if (error) throw error

      // Langsung ke halaman laporan agar kasir melihat hasil rekonsiliasi shift
      router.push('/kasir/reports?shift=closed')
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menutup shift')
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto pb-12 animate-in fade-in">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 rounded-lg mb-2" />
            <Skeleton className="h-4 w-64 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-48 rounded-xl hidden md:block" />
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-start gap-4">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3 w-24 rounded-full mb-4" />
                <Skeleton className="h-8 w-40 rounded-full mb-3" />
                <Skeleton className="h-4 w-3/4 rounded-full" />
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-start gap-4">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3 w-24 rounded-full mb-4" />
                <Skeleton className="h-8 w-40 rounded-full mb-3" />
                <Skeleton className="h-4 w-3/4 rounded-full" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
               <Skeleton className="h-6 w-1/2 rounded-full mb-6" />
               <div className="space-y-4">
                 <Skeleton className="h-12 w-full rounded-xl" />
                 <Skeleton className="h-12 w-full rounded-xl" />
                 <Skeleton className="h-12 w-full rounded-xl" />
               </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
               <Skeleton className="h-6 w-1/2 rounded-full mb-6" />
               <div className="space-y-4">
                 <Skeleton className="h-12 w-full rounded-xl" />
                 <Skeleton className="h-12 w-full rounded-xl" />
                 <Skeleton className="h-12 w-full rounded-xl" />
               </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
               <Skeleton className="h-6 w-1/2 rounded-full mb-6" />
               <div className="space-y-4">
                 <Skeleton className="h-12 w-full rounded-xl" />
                 <Skeleton className="h-12 w-full rounded-xl" />
                 <Skeleton className="h-12 w-full rounded-xl" />
               </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
               <Skeleton className="h-6 w-1/2 rounded-full mb-6" />
               <div className="space-y-4">
                 <Skeleton className="h-12 w-full rounded-xl" />
                 <Skeleton className="h-12 w-full rounded-xl" />
                 <Skeleton className="h-12 w-full rounded-xl" />
               </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-in relative">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Wallet className="w-7 h-7 text-amber-500" />
            Petty Cash
          </h1>
          <p className="text-gray-500 text-sm mt-1">Kelola pergerakan uang laci harian dan Dana Operasional</p>
        </div>
        {activeShift && (
          <button
            onClick={() => setShowTopupModal(true)}
            className="flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-blue-200"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Ajukan Top Up Dana Operasional
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-700 font-medium">{successMsg}</p>
        </div>
      )}

      {!activeShift && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
            <LogIn className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-amber-900">Buka Shift Laci</h2>
          </div>
          <div className="p-6 md:p-8 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
              <Wallet className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Shift Saat Ini Ditutup</h3>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              Silakan hitung sisa modal di laci Anda saat ini (tidak termasuk petty cash) dan buka shift untuk memulai pencatatan transaksi tunai.
            </p>
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div className="text-left">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Saldo Awal Dana Operasional (Hitungan Asli)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-semibold">Rp</span>
                  </div>
                  <input
                    type="number"
                    onWheel={(e) => e.currentTarget.blur()}
                    required
                    min="0"
                    placeholder="Contoh: 150000"
                    value={startingPettyCash}
                    onChange={e => !pettyCashLocked && setStartingPettyCash(e.target.value)}
                    disabled={isSubmitting || pettyCashLocked}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors outline-none font-semibold text-lg text-gray-900 disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {pettyCashLocked && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>
                {pettyCashLocked && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Mengikuti setoran awal terakhir. Hubungi SPV/Admin bila nominal ini perlu diubah.
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-sm shadow-amber-200/50 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                Buka Shift Sekarang
              </button>
            </form>
          </div>
        </div>
      )}

      {activeShift && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Laci Kasir Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-6 flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
                <Wallet className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Laci Kasir (Sales)</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900">{formatRupiah(currentDrawerBalance)}</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Awal {formatRupiah(activeShift.starting_cash)} 
                  {shiftSalesTotal > 0 && <span className="text-emerald-600 font-semibold"> &middot; Jual Tunai +{formatRupiah(shiftSalesTotal)}</span>}
                </p>
              </div>
            </div>

            {/* Petty Cash Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                <Banknote className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Dana Operasional</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900">{formatRupiah(pettyCashBalance)}</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Awal Shift: {formatRupiah(activeShift.starting_petty_cash || 0)} &middot; Dana operasional
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <LogOut className="w-5 h-5 text-red-500" />
                    <h3 className="font-bold text-gray-900">Catat Pengeluaran (Ambil dari Petty Cash)</h3>
                  </div>
                </div>
                <form onSubmit={handleAddExpense} className="p-5 space-y-4 bg-gray-50/50">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Kategori</label>
                    <select
                      value={expCategory}
                      onChange={e => setExpCategory(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm font-medium"
                    >
                      <option value="bahan_baku">Bahan Baku (Es Batu, Sayur)</option>
                      <option value="operasional">Operasional (Plastik, ATK)</option>
                      <option value="utilitas">Utilitas (Listrik Darurat)</option>
                      <option value="lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Keterangan / Nama Barang</label>
                    <input type="text" required placeholder="Contoh: Beli es kristal 2 bungkus" value={expDesc} onChange={e => setExpDesc(e.target.value)} disabled={isSubmitting} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nominal (Rp)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 font-semibold text-sm">Rp</span>
                      </div>
                      <input type="number" onWheel={(e) => e.currentTarget.blur()} required min="100" placeholder="20000" value={expAmount} onChange={e => setExpAmount(e.target.value)} disabled={isSubmitting} className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm font-bold" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Foto Bukti Struk (Wajib)</label>
                    <input type="file" required accept="image/*,application/pdf" capture="environment" onChange={e => setReceiptFile(e.target.files?.[0] || null)} disabled={isSubmitting} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 transition-colors" />
                  </div>
                  <button type="submit" disabled={isSubmitting || pettyCashBalance <= 0} className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : 'Simpan Pengeluaran'}
                  </button>
                  {pettyCashBalance <= 0 && <p className="text-xs text-red-500 font-bold text-center mt-2">Saldo Petty Cash kosong, tidak bisa melakukan pengeluaran.</p>}
                </form>
              </div>

            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-4 bg-gray-50/50">
                  <h3 className="font-bold text-gray-900 text-sm">Riwayat Aktivitas Shift Ini</h3>
                  <p className="text-xs text-gray-500 mt-1">Gabungan transaksi Laci dan Petty Cash</p>
                </div>
                <div className="divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
                  {ledgerItems.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">Belum ada aktivitas shift ini</div>
                  ) : (
                    ledgerItems.map((item, idx) => {
                      if (item.type === 'expense') {
                        const exp = item.data as Expense
                        return (
                          <div key={`exp-${exp.id}-${idx}`} className="p-4 flex items-start justify-between gap-3 hover:bg-gray-50">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="shrink-0 w-11 h-11 rounded-lg bg-red-50 flex items-center justify-center text-red-400">
                                <Receipt className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{exp.description}</p>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase mt-0.5">Pengeluaran Petty Cash ({CATEGORY_LABEL[exp.category] ?? exp.category})</p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                  <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{exp.creator?.name ?? '—'}</span>
                                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(exp.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0 gap-1.5">
                              <span className="text-sm font-black text-red-600">-{formatRupiah(exp.amount)}</span>
                              {exp.receipt_url && <button onClick={() => setSelectedReceiptUrl(exp.receipt_url || null)} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors">Lihat Bukti</button>}
                            </div>
                          </div>
                        )
                      } else if (item.type === 'topup') {
                        const top = item.data as PettyCashTopup
                        return (
                          <div key={`top-${top.id}-${idx}`} className={`p-4 flex items-start justify-between gap-3 hover:bg-gray-50 ${top.status === 'rejected' ? 'opacity-50' : ''}`}>
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${top.status === 'pending' ? 'bg-amber-50 text-amber-500' : top.status === 'rejected' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-500'}`}>
                                <ArrowDownToLine className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{top.description}</p>
                                <p className={`text-[11px] font-semibold uppercase mt-0.5 ${top.status === 'pending' ? 'text-amber-500' : top.status === 'rejected' ? 'text-red-500' : 'text-blue-500'}`}>
                                  Top Up Petty Cash ({top.status === 'pending' ? '⏳ Menunggu Persetujuan' : top.status === 'rejected' ? '❌ Ditolak' : '✅ Disetujui'})
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                  <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{top.creator?.name ?? '—'}</span>
                                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(top.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0 gap-1.5">
                              <span className={`text-sm font-black ${top.status === 'pending' ? 'text-amber-500' : top.status === 'rejected' ? 'text-gray-400 line-through' : 'text-blue-600'}`}>+{formatRupiah(top.amount)}</span>
                            </div>
                          </div>
                        )
                      } else {
                        const sale = item.data as CashOrder
                        return (
                          <div key={`sale-${sale.id}-${idx}`} className="p-4 flex items-start justify-between gap-3 hover:bg-gray-50">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="shrink-0 w-11 h-11 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                                <Wallet className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">Pesanan #{sale.order_number}</p>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase mt-0.5">Penjualan Laci (Tunai)</p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(sale.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0 gap-1.5">
                              <span className="text-sm font-black text-emerald-600">+{formatRupiah(sale.total_amount)}</span>
                            </div>
                          </div>
                        )
                      }
                    })
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Grid Bawah untuk Card Rekap & Penutupan */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="space-y-6">
              {/* Perhitungan Sistem (Otomatis) */}
              <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden h-fit">
                <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
                  <Calculator className="w-5 h-5 text-amber-600" />
                  <h2 className="text-lg font-bold text-amber-900">Perhitungan Sistem (Otomatis)</h2>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Sistem menghitung otomatis berapa uang yang <b>seharusnya</b> ada saat ini. Bandingkan dengan hitungan manual Anda di bawah.
                  </p>

                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-700">Uang Laci Seharusnya</span>
                      <span className="text-lg font-black text-emerald-700">{formatRupiah(currentDrawerBalance)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Modal awal {formatRupiah(activeShift.starting_cash)} + Penjualan tunai {formatRupiah(shiftSalesTotal)}
                    </p>
                  </div>

                  <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-700">Dana Operasional Seharusnya</span>
                      <span className="text-lg font-black text-blue-700">{formatRupiah(pettyCashBalance)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Awal {formatRupiah(activeShift.starting_petty_cash || 0)} + Top up {formatRupiah(approvedTopupsTotal)} − Pengeluaran {formatRupiah(expensesTotal)}
                    </p>
                  </div>

                  <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Seharusnya</span>
                    <span className="text-xl font-black text-gray-900">{formatRupiah(currentDrawerBalance + pettyCashBalance)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Hitungan Manual Kasir + Tutup Shift */}
              <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden h-fit">
                <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center gap-3">
                  <LogOut className="w-5 h-5 text-red-600" />
                  <h2 className="text-lg font-bold text-red-900">Hitungan Manual Kasir & Tutup Shift</h2>
                </div>
                <div className="p-6 md:p-8 text-center">
                  <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                    Hitung seluruh uang fisik secara manual. Masukkan angka untuk <b>Uang Laci</b> (sales) dan <b>Dana Operasional</b> secara terpisah.
                  </p>
                  <form onSubmit={handleCloseShift} className="space-y-4">
                    <div className="text-left">
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Uang Laci (Hitungan Manual)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-gray-500 font-semibold">Rp</span>
                        </div>
                        <input type="number" onWheel={(e) => e.currentTarget.blur()} required min="0" placeholder="Contoh: 850000" value={actualEndingCash} onChange={e => setActualEndingCash(e.target.value)} disabled={isSubmitting} className="w-full pl-12 pr-4 py-3 bg-emerald-50/50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors outline-none font-semibold text-lg text-gray-900" />
                      </div>
                      {cashDiff !== null && (
                        <p className={`text-xs font-bold mt-1.5 ${cashDiff === 0 ? 'text-emerald-600' : cashDiff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {cashDiff === 0 ? '✓ Pas dengan sistem' : cashDiff > 0 ? `Lebih ${formatRupiah(cashDiff)} dari sistem` : `Kurang ${formatRupiah(Math.abs(cashDiff))} dari sistem`}
                        </p>
                      )}
                    </div>
                    <div className="text-left mt-4">
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Dana Operasional (Hitungan Manual)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-gray-500 font-semibold">Rp</span>
                        </div>
                        <input type="number" onWheel={(e) => e.currentTarget.blur()} required min="0" placeholder="Contoh: 250000" value={actualEndingPettyCash} onChange={e => setActualEndingPettyCash(e.target.value)} disabled={isSubmitting} className="w-full pl-12 pr-4 py-3 bg-blue-50/50 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors outline-none font-semibold text-lg text-gray-900" />
                      </div>
                      {pettyCashDiff !== null && (
                        <p className={`text-xs font-bold mt-1.5 ${pettyCashDiff === 0 ? 'text-emerald-600' : pettyCashDiff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {pettyCashDiff === 0 ? '✓ Pas dengan sistem' : pettyCashDiff > 0 ? `Lebih ${formatRupiah(pettyCashDiff)} dari sistem` : `Kurang ${formatRupiah(Math.abs(pettyCashDiff))} dari sistem`}
                        </p>
                      )}
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 mt-2 rounded-xl font-bold transition-all disabled:opacity-50">
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                      Kunci & Tutup Shift
                    </button>
                    <p className="text-[11px] text-gray-400 mt-1">Setelah shift ditutup, Anda akan diarahkan ke halaman Laporan.</p>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Topup Modal */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-blue-500" />
                Pengajuan Top Up Petty Cash
              </h3>
              <button onClick={() => setShowTopupModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleAddTopup} className="p-6 space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4">
                Pengajuan top up akan berstatus <b>Pending</b> dan menunggu persetujuan Leader/SPV di Dasbor Admin sebelum masuk ke saldo.
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Nominal Tambahan (Rp)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 font-semibold text-sm">Rp</span>
                  </div>
                  <input type="number" onWheel={(e) => e.currentTarget.blur()} required min="1000" placeholder="50000" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} disabled={isSubmitting} className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Keterangan / Alasan Pengajuan</label>
                <input type="text" required placeholder="Contoh: Butuh tambahan uang receh untuk kembalian" value={topupDesc} onChange={e => setTopupDesc(e.target.value)} disabled={isSubmitting} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTopupModal(false)} disabled={isSubmitting} className="flex-1 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Image Modal */}
      {selectedReceiptUrl && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-fade-in" 
          onClick={() => setSelectedReceiptUrl(null)}
        >
          {/* Image Container */}
          <div 
            className="relative w-full h-full flex items-center justify-center p-4 pb-24" 
            onClick={e => e.stopPropagation()}
          >
            <img 
              src={selectedReceiptUrl} 
              alt="Bukti Pengeluaran" 
              className="max-w-full max-h-full object-contain rounded-lg" 
            />
          </div>

          {/* Close Button (Bottom Center) */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center z-[10000] pointer-events-none">
            <button 
              onClick={() => setSelectedReceiptUrl(null)} 
              className="pointer-events-auto bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-bold rounded-full px-8 py-3.5 backdrop-blur-md transition-all active:scale-95 flex items-center gap-2 shadow-2xl"
            >
              <X className="w-5 h-5" />
              Tutup Gambar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
