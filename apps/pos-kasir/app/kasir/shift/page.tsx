'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Wallet, LogIn, LogOut, Receipt, PlusCircle, AlertTriangle, CheckCircle2, Loader2, User, Clock, Banknote, ArrowDownToLine, Calculator, Lock, X, Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import { Skeleton } from '@/components/Skeleton'
import { useDialogStore } from '@/lib/dialogStore'
import { db } from '@/lib/db'
import { useNetworkStatus } from '@/lib/useNetworkStatus'
import { postToNative, isRunningInWebView, compressImageToWebP } from '@suka/design-system'
import PettyCashSpotlightTour from '@/components/PettyCashSpotlightTour'

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
  deleted_at?: string | null
  delete_reason?: string | null
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
  proof_of_transfer_url?: string | null
}

interface CashOrder {
  id: string
  order_number: string
  total_amount: number
  created_at: string
  payment_method: string
  channel: string | null
  status: string
  cancellation_status?: string | null
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
  const { showConfirm, showPrompt, showAlert } = useDialogStore()
  const { outletId, outletRegion } = useMyOutlet()
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isOnline = useNetworkStatus()
  
  const [loading, setLoading] = useState(true)
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [topups, setTopups] = useState<PettyCashTopup[]>([])
  const [cashOrders, setCashOrders] = useState<CashOrder[]>([])
  const [pettyCashBalance, setPettyCashBalance] = useState<number>(0)
  
  // Spotlight Tour state
  const [showSpotlightTour, setShowSpotlightTour] = useState(false)
  const [tourTopupInfo, setTourTopupInfo] = useState<{ amount?: number; description?: string }>({})

  // Forms
  const [startingPettyCash, setStartingPettyCash] = useState<string>('')
  const [pettyCashLocked, setPettyCashLocked] = useState(false)
  
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
  const [visibleLedgerCount, setVisibleLedgerCount] = useState(20)

  useEffect(() => {
    const tourParam = searchParams.get('tour')
    if (tourParam === 'terima-dana') {
      const timer = setTimeout(() => {
        setShowSpotlightTour(true)
      }, 600)
      return () => clearTimeout(timer)
    }

    const handleCustomTourEvent = (e: any) => {
      if (e.detail) {
        setTourTopupInfo({ amount: e.detail.amount, description: e.detail.description })
      }
      setShowSpotlightTour(true)
    }

    window.addEventListener('start-petty-cash-tour', handleCustomTourEvent)
    return () => window.removeEventListener('start-petty-cash-tour', handleCustomTourEvent)
  }, [searchParams])

  const shiftSalesTotal = useMemo(
    () => cashOrders
      .filter((o) => o.status !== 'cancelled' && (o as any).cancellation_status !== 'pending_approval')
      .reduce((s, o) => s + Number(o.total_amount), 0),
    [cashOrders],
  )

  const currentDrawerBalance = useMemo(
    () => (activeShift ? Number(activeShift.starting_cash) + shiftSalesTotal : 0),
    [activeShift, shiftSalesTotal],
  )

  const approvedTopupsTotal = useMemo(() => {
    return topups
      .filter((t) => t.status === 'approved' || t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [topups])

  const expensesTotal = useMemo(
    () => expenses.filter(e => !e.deleted_at).reduce((s, e) => s + Number(e.amount), 0),
    [expenses],
  )

  const ledgerItems = useMemo<LedgerItem[]>(() => {
    const items: LedgerItem[] = []
    expenses.forEach(e => items.push({ type: 'expense', data: e, date: new Date(e.created_at) }))
    topups.forEach(t => items.push({ type: 'topup', data: t, date: new Date(t.created_at) }))
    cashOrders.forEach(o => items.push({ type: 'sale', data: o, date: new Date(o.created_at) }))
    return items.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [expenses, topups, cashOrders])

  useEffect(() => {
    if (outletId) {
      fetchCurrentState()

      let debounceTimer: NodeJS.Timeout | null = null
      const triggerRefresh = () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => fetchCurrentState(true), 500)
      }

      const channelName = `shift-realtime-${outletId}`
      const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`)
      if (existing) supabase.removeChannel(existing)

      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_topups', filter: `outlet_id=eq.${outletId}` }, triggerRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_expenses', filter: `outlet_id=eq.${outletId}` }, triggerRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${outletId}` }, triggerRefresh)
        .subscribe()

      // Polling fallback dipasang 30 detik untuk menghemat jaringan & CPU
      const interval = setInterval(() => {
        fetchCurrentState(true)
      }, 30000)

      return () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        clearInterval(interval)
        supabase.removeChannel(channel)
      }
    }
  }, [outletId, supabase])

  async function fetchCurrentState(isSilent = false) {
    try {
      if (!isSilent) setLoading(true)
      setErrorMsg('')

      const { data: shiftData, error: shiftError } = await supabase
        .from('shifts')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('status', 'open')
        .maybeSingle()

      if (shiftError) throw shiftError
      setActiveShift(shiftData || null)

      let snapExpenses: Expense[] = []
      let snapTopups: PettyCashTopup[] = []
      let snapCashOrders: CashOrder[] = []
      let calculatedBalance = 0

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
          supabase.from('petty_cash_topups').select('*').eq('outlet_id', outletId).or(`created_at.gte.${shiftData.start_time},completed_at.gte.${shiftData.start_time}`),
          supabase.from('orders').select('id, order_number, total_amount, created_at, payment_method, channel, status, cancellation_status, void_reason, cancellation_reason').eq('outlet_id', outletId).in('status', ['completed', 'cancelled']).gte('updated_at', shiftData.start_time)
        ])

        const [processedExpenses, processedTopups] = await Promise.all([
          fetchCreators(expRes.data || []),
          fetchCreators(topRes.data || [])
        ])
        snapExpenses = processedExpenses
        snapTopups = processedTopups
        snapCashOrders = (ordRes.data || []).filter(o => o.payment_method === 'cash')
        setExpenses(snapExpenses)
        setTopups(snapTopups)
        setCashOrders(snapCashOrders)

        // Saldo Petty Cash Shift Ini: Modal Awal + TopUp Diterima (Sudah Tekan Terima Dana) - Pengeluaran Shift Ini
        const startPetty = Number(shiftData.starting_petty_cash) || 0
        const topupsTotal = snapTopups
          .filter(t => t.status === 'completed' || t.status === 'approved')
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
        const expensesTotal = snapExpenses
          .filter(e => !e.deleted_at)
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

        calculatedBalance = startPetty + topupsTotal - expensesTotal
        setPettyCashBalance(calculatedBalance)
      } else {
        setPettyCashBalance(0)
        setExpenses([])
        setTopups([])
        setCashOrders([])

        // Kunci nominal setoran awal Dana Operasional ke SISA PETTY CASH (ending_petty_cash)
        // shift terakhir yang sudah ditutup (closed) — BUKAN nominal tetap standar.
        const { data: lastShift } = await supabase
          .from('shifts')
          .select('starting_petty_cash, expected_ending_petty_cash, actual_ending_petty_cash, end_time, updated_at')
          .eq('outlet_id', outletId)
          .eq('status', 'closed')
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastShift) {
          let endingBalance = lastShift.actual_ending_petty_cash ?? lastShift.expected_ending_petty_cash ?? lastShift.starting_petty_cash ?? 0

          // Calculate interim topups and expenses (occurred while shift was closed)
          const refTime = lastShift.end_time || lastShift.updated_at
          if (refTime) {
            const [interimTopRes, interimExpRes] = await Promise.all([
              supabase.from('petty_cash_topups')
                .select('amount')
                .eq('outlet_id', outletId)
                .in('status', ['completed', 'approved'])
                .gt('completed_at', refTime),
              supabase.from('petty_cash_expenses')
                .select('amount')
                .eq('outlet_id', outletId)
                .gt('created_at', refTime)
            ])
            
            const interimTopups = (interimTopRes.data || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
            const interimExpenses = (interimExpRes.data || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
            
            endingBalance = endingBalance + interimTopups - interimExpenses
          }

          setStartingPettyCash(String(endingBalance))
          setPettyCashLocked(true)
        } else {
          const { data: fallbackShift } = await supabase
            .from('shifts')
            .select('starting_petty_cash')
            .eq('outlet_id', outletId)
            .gt('starting_petty_cash', 0)
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (fallbackShift && fallbackShift.starting_petty_cash) {
            setStartingPettyCash(String(fallbackShift.starting_petty_cash))
            setPettyCashLocked(true)
          } else {
            setStartingPettyCash('0')
            setPettyCashLocked(false)
          }
        }
      }

      // Simpan snapshot untuk ditampilkan saat offline (baca-saja)
      await db.app_state.put({
        key: `pettycash:${outletId}`,
        value: {
          shift: shiftData || null,
          balance: calculatedBalance,
          expenses: snapExpenses,
          topups: snapTopups,
          cashOrders: snapCashOrders,
        },
        synced_at: Date.now(),
      }).catch(() => {})
    } catch (err: any) {
      // Offline / jaringan gagal → tampilkan data terakhir dari cache
      console.warn('Gagal memuat data shift, memakai cache offline:', err)
      const cached = await db.app_state.get(`pettycash:${outletId}`).catch(() => undefined)
      if (cached?.value) {
        const v = cached.value
        setActiveShift(v.shift || null)
        setPettyCashBalance(v.balance || 0)
        setExpenses(v.expenses || [])
        setTopups(v.topups || [])
        setCashOrders(v.cashOrders || [])
        setErrorMsg('')
      } else {
        setErrorMsg('Gagal memuat data shift')
      }
    } finally {
      setLoading(false)
    }
  }

  // Petty cash menyentuh saldo kas + upload struk + persetujuan SPV yang semuanya
  // otoritatif di server → tak aman diantre offline. Kunci tulis saat offline.
  const OFFLINE_MSG = 'Fitur ini butuh internet. Sambungkan ke internet untuk buka/tutup shift, top-up, atau catat pengeluaran.'

  async function handleOpenShift(e: React.FormEvent) {
    e.preventDefault()
    if (!isOnline) { setErrorMsg(OFFLINE_MSG); return }
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
    if (!isOnline) { setErrorMsg(OFFLINE_MSG); return }
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
        const compressedFile = await compressImageToWebP(receiptFile, 1200, 1200, 0.8)
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.webp`
        const filePath = `${outletId}/${fileName}`
        const { error: uploadError } = await supabase.storage.from('petty-cash-receipts').upload(filePath, compressedFile)
        if (uploadError) throw new Error(`Gagal mengunggah foto struk: ${uploadError.message}`)
        const { data: publicUrlData } = supabase.storage.from('petty-cash-receipts').getPublicUrl(filePath)
        receiptUrl = publicUrlData.publicUrl
      }

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

  async function handleVoidExpense(id: string) {
    if (!isOnline) { setErrorMsg(OFFLINE_MSG); return }
    const reason = await showPrompt('Masukkan alasan pembatalan pengeluaran:', 'Pembatalan Pengeluaran')
    if (reason === null) return // User cancelled
    if (!reason.trim()) {
      await showAlert('Alasan pembatalan harus diisi!', 'Peringatan')
      return
    }

    const confirmed = await showConfirm('Anda yakin ingin membatalkan pengeluaran ini? Nominal akan dikembalikan ke saldo Petty Cash.')
    if (!confirmed) return

    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)
    try {
      const { error } = await supabase.rpc('void_petty_cash_expense', { p_expense_id: id, p_reason: reason.trim() })
      if (error) throw error

      setSuccessMsg('Pengeluaran berhasil dibatalkan.')
      await fetchCurrentState()
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membatalkan pengeluaran.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAddTopup(e: React.FormEvent) {
    e.preventDefault()
    if (!isOnline) { setErrorMsg(OFFLINE_MSG); return }
    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)
    try {
      const amount = parseFloat(topupAmount)
      if (isNaN(amount) || amount <= 0) throw new Error('Nominal top-up tidak valid')
      if (!topupDesc.trim()) throw new Error('Keterangan harus diisi')
      
      const approvalToken = crypto.randomUUID()
      const { data: insertedData, error } = await supabase.from('petty_cash_topups').insert({
        outlet_id: outletId,
        amount,
        description: topupDesc.trim(),
        approval_token: approvalToken,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }).select('id').single()

      if (error) throw error

      setSuccessMsg('Pengajuan berhasil dikirim ke Dashboard Leader. Menunggu persetujuan.')

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

  async function handleReceiveFunds(id: string) {
    if (!isOnline) { setErrorMsg(OFFLINE_MSG); return }
    const confirmed = await showConfirm('Anda yakin telah menerima fisik uang tersebut sejumlah pengajuan?')
    if (!confirmed) return

    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)
    try {
      const { error } = await supabase.rpc('crew_receive_funds', { p_topup_id: id })
      if (error) throw error

      setSuccessMsg('Uang berhasil diterima dan Petty Cash bertambah.')
      await fetchCurrentState()
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal konfirmasi penerimaan dana')
    } finally {
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
      {!isOnline && (
        <div className="mb-4 flex items-start gap-2.5 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
          <span>
            <b>Mode offline.</b> Data petty cash di bawah adalah salinan terakhir. Buka/tutup shift, top-up,
            & catat pengeluaran dikunci sampai internet tersambung (menyangkut saldo kas & persetujuan SPV).
          </span>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Wallet className="w-7 h-7 text-amber-500" />
            Petty Cash
          </h1>
          <p className="text-gray-500 text-sm mt-1">Kelola pergerakan uang laci harian dan Dana Operasional</p>
        </div>
        {activeShift && (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/kasir/shift/close"
              className="flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 sm:py-2 rounded-lg font-bold text-sm transition-colors border border-red-200 w-full sm:w-auto"
            >
              <LogOut className="w-4 h-4" />
              Tutup Shift
            </Link>
          </div>
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
          <div className="flex-1 w-full">
            <p className="text-sm text-emerald-700 font-medium">{successMsg}</p>
          </div>
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
              {pettyCashLocked
                ? 'Saldo awal Petty Cash otomatis meneruskan sisa saldo dari closing shift sebelumnya. Klik Buka Shift untuk memulai.'
                : 'Silakan masukkan saldo awal Petty Cash dan buka shift untuk memulai pencatatan transaksi.'}
            </p>
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div className="text-left">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Saldo Awal Dana Operasional (Hitungan Asli)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-semibold">Rp</span>
                  </div>
                  <input
                    inputMode="numeric"
                    required
                    placeholder="Contoh: 150.000"
                    value={startingPettyCash ? Number(startingPettyCash).toLocaleString('id-ID') : ''}
                    onChange={e => !pettyCashLocked && setStartingPettyCash(e.target.value.replace(/\D/g, ''))}
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
                    Mengikuti sisa saldo petty cash dari closing shift sebelumnya. Hubungi SPV/Admin bila nominal ini perlu diubah.
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
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Penjualan</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900">{formatRupiah(currentDrawerBalance)}</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Awal {formatRupiah(activeShift.starting_cash)} 
                  {shiftSalesTotal > 0 && <span className="text-emerald-600 font-semibold"> &middot; Jual Tunai +{formatRupiah(shiftSalesTotal)}</span>}
                </p>
                <p className="text-xs text-emerald-600/70 mt-1 font-medium">* Hanya transaksi dengan metode Tunai (Cash)</p>
              </div>
            </div>

            {/* Petty Cash Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                <Banknote className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Petty Cash</span>
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
                      <input inputMode="numeric" required placeholder="20.000" value={expAmount ? Number(expAmount).toLocaleString('id-ID') : ''} onChange={e => setExpAmount(e.target.value.replace(/\D/g, ''))} disabled={isSubmitting} className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm font-bold" />
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
                    <>
                    {ledgerItems.slice(0, visibleLedgerCount).map((item, idx) => {
                      if (item.type === 'expense') {
                        const exp = item.data as Expense
                        const isVoided = !!exp.deleted_at;
                        return (
                          <div key={`exp-${exp.id}-${idx}`} className={`p-4 flex items-start justify-between gap-3 hover:bg-gray-50 ${isVoided ? 'opacity-60 bg-gray-50/80' : ''}`}>
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${isVoided ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-400'}`}>
                                <Receipt className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className={`text-sm font-bold text-gray-900 truncate ${isVoided ? 'line-through text-gray-500' : ''}`}>{exp.description}</p>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase mt-0.5">
                                  Pengeluaran Petty Cash ({CATEGORY_LABEL[exp.category] ?? exp.category}) {isVoided && <span className="text-red-500 ml-1 font-bold">(DIBATALKAN)</span>}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                  <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{exp.creator?.name ?? '—'}</span>
                                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(exp.created_at)}</span>
                                </div>
                                {isVoided && exp.delete_reason && (
                                  <p className="text-[10px] font-medium text-red-500 mt-1 italic">Alasan Batal: {exp.delete_reason}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0 gap-1.5">
                              <span className={`text-sm font-black ${isVoided ? 'text-gray-400 line-through' : 'text-red-600'}`}>-{formatRupiah(exp.amount)}</span>
                              <div className="flex items-center gap-1.5">
                                {exp.receipt_url && <button onClick={() => setSelectedReceiptUrl(exp.receipt_url || null)} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors">Lihat Bukti</button>}
                                {!isVoided && activeShift && (
                                  <button onClick={() => handleVoidExpense(exp.id)} className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100 transition-colors border border-red-100 shadow-sm">Batal</button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      } else if (item.type === 'topup') {
                        const top = item.data as PettyCashTopup
                        return (
                          <div key={`top-${top.id}-${idx}`} className={`p-4 flex items-start justify-between gap-3 hover:bg-gray-50 ${top.status === 'rejected' ? 'opacity-50' : ''}`}>
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${top.status === 'pending' || top.status.startsWith('forwarded_') || top.status === 'approved_by_finance' ? 'bg-amber-50 text-amber-500' : top.status === 'rejected' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-500'}`}>
                                <ArrowDownToLine className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{top.description}</p>
                                <p className={`text-[11px] font-semibold uppercase mt-0.5 ${top.status === 'pending' || top.status.startsWith('forwarded_') || top.status === 'approved_by_finance' ? 'text-amber-500' : top.status === 'rejected' ? 'text-red-500' : 'text-blue-500'}`}>
                                  Top Up Petty Cash ({top.status === 'pending' ? '⏳ Menunggu Review Leader' : top.status === 'forwarded_to_area_manager' ? '⏳ Menunggu Review Area Manager' : top.status === 'forwarded_to_finance' ? '⏳ Menunggu Pencairan Finance' : top.status === 'rejected' ? '❌ Ditolak' : top.status === 'approved_by_finance' ? `🟢 Dana dipegang ${outletRegion?.toUpperCase() === 'BOGOR' ? 'Leader' : 'Area Manager'}` : `✅ Selesai${(top as any).disbursement_method ? ` - ${(top as any).disbursement_method.replace('_', ' ').toUpperCase()}` : ''}`})
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                  <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{top.creator?.name ?? '—'}</span>
                                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(top.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0 gap-1.5">
                              <span className={`text-sm font-black ${top.status === 'pending' || top.status.startsWith('forwarded_') || top.status === 'approved_by_finance' ? 'text-amber-500' : top.status === 'rejected' ? 'text-gray-400 line-through' : 'text-blue-600'}`}>+{formatRupiah(top.amount)}</span>
                              {top.proof_of_transfer_url && (
                                <button
                                  onClick={() => setSelectedReceiptUrl(top.proof_of_transfer_url || null)}
                                  className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Camera className="w-3 h-3 text-emerald-600" /> Bukti Transfer Finance
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      } else {
                        const sale = item.data as CashOrder & { status?: string, void_reason?: string, cancellation_reason?: string }
                        const isCancelled = sale.status === 'cancelled' || (sale as any).cancellation_status === 'pending_approval'
                        return (
                          <div key={`sale-${sale.id}-${idx}`} className={`p-4 flex items-start justify-between gap-3 hover:bg-gray-50 ${isCancelled ? 'opacity-60 bg-gray-50/80' : ''}`}>
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${isCancelled ? 'bg-gray-100 text-gray-400' : 'bg-emerald-50 text-emerald-500'}`}>
                                <Wallet className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className={`text-sm font-bold text-gray-900 truncate ${isCancelled ? 'line-through text-gray-500' : ''}`}>Pesanan #{sale.order_number}</p>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase mt-0.5">
                                  Penjualan {sale.channel ? `(Food Apps - ${sale.channel})` : '(Tunai)'} {isCancelled && <span className="text-red-500 ml-1 font-bold">(DIBATALKAN)</span>}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(sale.created_at)}</span>
                                </div>
                                {isCancelled && sale.cancellation_reason && (
                                  <p className="text-[10px] font-medium text-red-500 mt-1 italic">{sale.cancellation_reason}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0 gap-1.5">
                              <span className={`text-sm font-black ${isCancelled ? 'text-gray-400 line-through' : 'text-emerald-600'}`}>+{formatRupiah(sale.total_amount)}</span>
                            </div>
                          </div>
                        )
                      }
                    })}
                    {visibleLedgerCount < ledgerItems.length && (
                      <div className="p-4 flex justify-center pb-6">
                        <button
                          onClick={() => setVisibleLedgerCount(c => c + 20)}
                          className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all"
                        >
                          Tampilkan Lebih Banyak ({ledgerItems.length - visibleLedgerCount} tersisa)
                        </button>
                      </div>
                    )}
                    </>
                  )}
                </div>
              </div>

            </div>
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

      {/* Spotlight Tour for Terima Dana button */}
      {showSpotlightTour && (
        <PettyCashSpotlightTour
          targetSelector='[data-tour="terima-dana-btn"]'
          amount={tourTopupInfo.amount}
          description={tourTopupInfo.description}
          onClose={() => setShowSpotlightTour(false)}
        />
      )}
    </div>
  )
}
