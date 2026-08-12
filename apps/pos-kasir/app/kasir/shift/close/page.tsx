'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Calculator, AlertTriangle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import { Skeleton } from '@/components/Skeleton'
import { useDialogStore } from '@/lib/dialogStore'
import { db } from '@/lib/db'
import { useNetworkStatus } from '@/lib/useNetworkStatus'
import Link from 'next/link'

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
  payment_method: string
  channel: string | null
}

export default function CloseShiftPage() {
  const { showConfirm } = useDialogStore()
  const { outletId } = useMyOutlet()
  const supabase = createClient()
  const router = useRouter()
  const isOnline = useNetworkStatus()
  
  const [loading, setLoading] = useState(true)
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [topups, setTopups] = useState<PettyCashTopup[]>([])
  const [cashOrders, setCashOrders] = useState<CashOrder[]>([])
  const [pettyCashBalance, setPettyCashBalance] = useState<number>(0)
  
  // Forms
  const [actualEndingCash, setActualEndingCash] = useState<string>('')
  const [actualEndingPettyCash, setActualEndingPettyCash] = useState<string>('')
  
  // Time Validation
  const [isClosingAllowed, setIsClosingAllowed] = useState(true)

  useEffect(() => {
    const checkTime = () => {
      try {
        const now = new Date()
        const jktTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
        const jktTime = new Date(jktTimeStr)
        const hour = jktTime.getHours()
        setIsClosingAllowed(hour >= 22 || hour < 6)
      } catch (e) {
        const hour = new Date().getHours()
        setIsClosingAllowed(hour >= 22 || hour < 6)
      }
    }
    checkTime()
    const interval = setInterval(checkTime, 60000)
    return () => clearInterval(interval)
  }, [])
  
  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const shiftSalesTotal = useMemo(
    () => cashOrders.reduce((s, o) => s + Number(o.total_amount), 0),
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
    () => expenses.reduce((s, e) => s + Number(e.amount), 0),
    [expenses],
  )

  const cashDiff = useMemo(() => {
    const v = parseFloat(actualEndingCash)
    return isNaN(v) ? null : v - currentDrawerBalance
  }, [actualEndingCash, currentDrawerBalance])

  const pettyCashDiff = useMemo(() => {
    const v = parseFloat(actualEndingPettyCash)
    return isNaN(v) ? null : v - pettyCashBalance
  }, [actualEndingPettyCash, pettyCashBalance])

  useEffect(() => {
    if (outletId) {
      fetchCurrentState()
    }
  }, [outletId, supabase])

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

      let snapExpenses: Expense[] = []
      let snapTopups: PettyCashTopup[] = []
      let snapCashOrders: CashOrder[] = []
      let calculatedBalance = 0

      if (shiftData) {
        const [expRes, topRes, ordRes] = await Promise.all([
          supabase.from('petty_cash_expenses').select('*').eq('outlet_id', outletId).gte('created_at', shiftData.start_time),
          supabase.from('petty_cash_topups').select('*').eq('outlet_id', outletId).gte('created_at', shiftData.start_time),
          supabase.from('orders').select('id, order_number, total_amount, created_at, payment_method, channel').eq('outlet_id', outletId).eq('status', 'completed').gte('updated_at', shiftData.start_time)
        ])

        snapExpenses = expRes.data || []
        snapTopups = topRes.data || []
        snapCashOrders = (ordRes.data || []).filter(o => o.payment_method === 'cash')
        setExpenses(snapExpenses)
        setTopups(snapTopups)
        setCashOrders(snapCashOrders)

        const startPetty = Number(shiftData.starting_petty_cash) || 0
        const topupsTotal = snapTopups
          .filter(t => ['completed', 'approved', 'approved_by_finance', 'forwarded_by_leader'].includes(t.status))
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
        const expensesTotalLocal = snapExpenses
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

        calculatedBalance = startPetty + topupsTotal - expensesTotalLocal
        setPettyCashBalance(calculatedBalance)
      } else {
        setPettyCashBalance(0)
        setExpenses([])
        setTopups([])
        setCashOrders([])
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

  const OFFLINE_MSG = 'Fitur ini butuh internet. Sambungkan ke internet untuk tutup shift.'

  async function handleCloseShift(e: React.FormEvent) {
    e.preventDefault()
    if (!activeShift) return
    if (!isOnline) { setErrorMsg(OFFLINE_MSG); return }
    if (!isClosingAllowed) { setErrorMsg('Penutupan shift hanya dapat dilakukan antara jam 22:00 hingga 06:00.'); return }
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

      const userRes = await supabase.auth.getUser()
      const userId = userRes.data.user?.id

      const res = await fetch('/api/kasir/close-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: activeShift.id,
          actualCash: cash,
          expectedCash: currentDrawerBalance,
          actualPettyCash: pc,
          expectedPettyCash: pettyCashBalance,
          closedBy: userId
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menutup shift di server')

      router.push('/kasir/reports?shift=closed')
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menutup shift')
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto pb-12 animate-in fade-in">
        <div className="mb-6 flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div>
            <Skeleton className="h-8 w-48 rounded-lg mb-2" />
            <Skeleton className="h-4 w-64 rounded-lg" />
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
    )
  }

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-in relative">
      {!isOnline && (
        <div className="mb-4 flex items-start gap-2.5 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
          <span>
            <b>Mode offline.</b> Data petty cash di bawah adalah salinan terakhir. Buka/tutup shift, top-up,
            & catat pengeluaran dikunci sampai internet tersambung.
          </span>
        </div>
      )}
      
      {!isClosingAllowed && (
        <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <span>
            <b>Belum Waktunya Tutup Shift.</b> Sesuai aturan, penutupan petty cash (shift) hanya dapat dilakukan mulai jam <b>22:00 malam hingga 06:00 pagi</b>. Silakan kembali lagi nanti.
          </span>
        </div>
      )}

      <div className="mb-6 flex items-center gap-4">
        <Link href="/kasir/shift" className="p-2 -ml-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            Tutup Shift Laci
          </h1>
          <p className="text-gray-500 text-sm mt-1">Hitung dan selaraskan sisa uang sebelum pergantian shift</p>
        </div>
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

      {!activeShift ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <AlertTriangle className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Shift Saat Ini Tidak Aktif</h3>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Tidak ada shift yang terbuka saat ini. Kembali ke halaman Petty Cash untuk membuka shift.
          </p>
          <Link
            href="/kasir/shift"
            className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            Kembali ke Petty Cash
          </Link>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Kolom Kiri: Hitungan Manual Kasir + Tutup Shift */}
          <div className="w-full lg:w-1/2">
            <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden h-fit">
              <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center gap-3">
                <LogOut className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-bold text-red-900">Hitungan Manual Kasir & Tutup Shift</h2>
              </div>
              <div className="p-6 md:p-8 text-center">
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  Hitung seluruh uang fisik secara manual. Masukkan angka untuk <b>Penjualan Cash</b> (sales) dan <b>Petty Cash</b> secara terpisah.
                </p>
                <form onSubmit={handleCloseShift} className="space-y-4">
                  <div className="text-left">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Penjualan Cash (Hitungan Manual)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-gray-500 font-semibold">Rp</span>
                      </div>
                      <input inputMode="numeric" required placeholder="Contoh: 850.000" value={actualEndingCash ? Number(actualEndingCash).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''} onChange={e => setActualEndingCash(e.target.value.replace(/\D/g, ''))} disabled={isSubmitting || !isClosingAllowed} className="w-full pl-12 pr-4 py-3 bg-emerald-50/50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors outline-none font-semibold text-lg text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                    {cashDiff !== null && (
                      <p className={`text-xs font-bold mt-1.5 ${cashDiff === 0 ? 'text-emerald-600' : cashDiff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {cashDiff === 0 ? '✓ Pas dengan sistem' : cashDiff > 0 ? `Lebih ${formatRupiah(cashDiff)} dari sistem` : `Kurang ${formatRupiah(Math.abs(cashDiff))} dari sistem`}
                      </p>
                    )}
                  </div>
                  <div className="text-left mt-4">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Hitung sisa petty cash</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-gray-500 font-semibold">Rp</span>
                      </div>
                      <input inputMode="numeric" required placeholder="Contoh: 250.000" value={actualEndingPettyCash ? Number(actualEndingPettyCash).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''} onChange={e => setActualEndingPettyCash(e.target.value.replace(/\D/g, ''))} disabled={isSubmitting || !isClosingAllowed} className="w-full pl-12 pr-4 py-3 bg-blue-50/50 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors outline-none font-semibold text-lg text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                    {pettyCashDiff !== null && (
                      <p className={`text-xs font-bold mt-1.5 ${pettyCashDiff === 0 ? 'text-emerald-600' : pettyCashDiff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {pettyCashDiff === 0 ? '✓ Pas dengan sistem' : pettyCashDiff > 0 ? `Lebih ${formatRupiah(pettyCashDiff)} dari sistem` : `Kurang ${formatRupiah(Math.abs(pettyCashDiff))} dari sistem`}
                      </p>
                    )}
                  </div>
                  <button type="submit" disabled={isSubmitting || !isClosingAllowed} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 mt-2 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                    Kunci & Tutup Shift
                  </button>
                  <p className="text-[11px] text-gray-400 mt-1">Setelah shift ditutup, Anda akan diarahkan ke halaman Laporan.</p>
                </form>
              </div>
            </div>
          </div>
          
          {/* Kolom Kanan: Perhitungan Sistem (Otomatis) */}
          <div className="w-full lg:w-1/2">
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden h-fit sticky top-24">
              <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
                <Calculator className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-bold text-amber-900">Perhitungan Sistem (Otomatis)</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-500 text-sm leading-relaxed">
                  Sistem menghitung otomatis berapa uang yang <b>seharusnya</b> ada saat ini. Bandingkan dengan hitungan manual Anda di samping.
                </p>

                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">Penjualan Cash Seharusnya</span>
                    <span className="text-lg font-black text-emerald-700">{formatRupiah(currentDrawerBalance)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Modal awal {formatRupiah(activeShift.starting_cash)} + Penjualan tunai {formatRupiah(shiftSalesTotal)}
                  </p>
                </div>

                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">Petty Cash Seharusnya</span>
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
        </div>
      )}
    </div>
  )
}
