'use client'

import { useState, useEffect, useMemo } from 'react'
import { Wallet, LogIn, LogOut, Receipt, PlusCircle, AlertTriangle, CheckCircle2, Loader2, User, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'

// Definition based on our DB schemas (kolom sesuai tabel `shifts`)
interface Shift {
  id: string
  status: 'open' | 'closed'
  starting_cash: number
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
}

// Format tanggal aman: kembalikan '—' bila nilai kosong/invalid (hindari
// "Invalid Date").
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
  const { outletId } = useMyOutlet()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  
  // Forms
  const [startingCash, setStartingCash] = useState<string>('')
  const [actualEndingCash, setActualEndingCash] = useState<string>('')
  
  // Expense Form
  const [expCategory, setExpCategory] = useState<string>('operasional')
  const [expAmount, setExpAmount] = useState<string>('')
  const [expDesc, setExpDesc] = useState<string>('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Total petty cash hari ini (auto-akumulasi dari daftar pengeluaran)
  const todayTotal = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return expenses
      .filter((e) => e.expense_date === today)
      .reduce((s, e) => s + Number(e.amount), 0)
  }, [expenses])

  useEffect(() => {
    if (outletId) {
      fetchCurrentState()
    }
  }, [outletId])

  async function fetchCurrentState() {
    try {
      setLoading(true)
      // Get current open shift for this outlet
      const { data: shiftData, error: shiftError } = await supabase
        .from('shifts')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('status', 'open')
        .maybeSingle()

      if (shiftError) throw shiftError
      setActiveShift(shiftData || null)

      if (shiftData) {
        // Fetch expenses tied to this shift + nama pencatat (audit)
        const { data: expData, error: expError } = await supabase
          .from('expenses')
          .select('*, creator:outlet_staff!expenses_created_by_fkey(name)')
          .eq('shift_id', shiftData.id)
          .order('created_at', { ascending: false })

        if (expError) throw expError
        setExpenses((expData as unknown as Expense[]) || [])
      } else {
        setExpenses([])
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Gagal memuat data shift')
    } finally {
      setLoading(false)
    }
  }

  // Action: Open Shift
  async function handleOpenShift(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)

    try {
      const amount = parseFloat(startingCash)
      if (isNaN(amount) || amount < 0) throw new Error('Saldo awal tidak valid')

      const { data, error } = await supabase.rpc('open_shift', {
        p_outlet_id: outletId,
        p_starting_cash: amount
      })

      if (error) throw error
      
      setSuccessMsg('Shift berhasil dibuka')
      setStartingCash('')
      await fetchCurrentState()
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuka shift')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Action: Add Petty Cash — via RPC add_petty_cash (server-authoritative:
  // stempel created_by/tanggal/outlet, auto-link shift).
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

      // MOCK UPLOAD: In real app, upload receiptFile to Supabase Storage here
      const dummyReceiptUrl = `https://storage.sukashawarma.com/receipts/${Date.now()}.jpg`

      // Try calling RPC first (assuming we updated it to accept p_receipt_url)
      const { error } = await supabase.rpc('add_petty_cash', {
        p_category: expCategory,
        p_amount: amount,
        p_description: expDesc.trim(),
        p_receipt_url: dummyReceiptUrl
      })

      // Fallback bila migrasi petty-cash belum di-apply (RPC belum ada) atau argumen tidak cocok
      if (error && (error.code === '42883' || error.code === 'PGRST202' || error.message?.includes('receipt_url'))) {
        console.warn('RPC add_petty_cash belum siap — fallback insert langsung.')
        const { error: insErr } = await supabase.from('expenses').insert({
          outlet_id: outletId,
          category: expCategory,
          amount,
          description: expDesc.trim(),
          expense_date: today,
          payment_source: 'cash_drawer', // Will auto-link to active shift via trigger
          receipt_url: dummyReceiptUrl
        })
        if (insErr) throw insErr
      } else if (error) {
        throw error
      }

      setSuccessMsg('Pengeluaran berhasil dicatat')
      setExpAmount('')
      setExpDesc('')
      setExpCategory('operasional')
      setReceiptFile(null)
      await fetchCurrentState()
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mencatat pengeluaran')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Action: Close Shift
  async function handleCloseShift(e: React.FormEvent) {
    e.preventDefault()
    if (!activeShift) return
    if (!confirm('Tutup shift sekarang? Setelah ditutup Anda tidak bisa melakukan transaksi tunai.')) return

    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)

    try {
      const amount = parseFloat(actualEndingCash)
      if (isNaN(amount) || amount < 0) throw new Error('Hitungan kas fisik tidak valid')

      const { error } = await supabase.rpc('close_shift_blind', {
        p_shift_id: activeShift.id,
        p_actual_cash: amount
      })

      if (error) throw error
      
      setSuccessMsg('Shift berhasil ditutup. Rekonsiliasi selesai.')
      setActualEndingCash('')
      await fetchCurrentState()
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menutup shift')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium">Memuat Status Shift...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
          <Wallet className="w-7 h-7 text-amber-500" />
          Kas & Shift
        </h1>
        <p className="text-gray-500 text-sm mt-1">Kelola pergerakan uang laci harian dan Petty Cash</p>
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

      {/* STATE 1: NO ACTIVE SHIFT */}
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
              Silakan hitung sisa modal di laci Anda saat ini (petty cash + kembalian) dan buka shift untuk memulai pencatatan transaksi tunai dan pengeluaran.
            </p>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div className="text-left">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Saldo Awal (Modal Laci)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-semibold">Rp</span>
                  </div>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Contoh: 150000"
                    value={startingCash}
                    onChange={e => setStartingCash(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white transition-colors outline-none font-semibold text-lg text-gray-900 disabled:opacity-50"
                  />
                </div>
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

      {/* STATE 2: ACTIVE SHIFT */}
      {activeShift && (
        <div className="space-y-6">
          {/* Shift Status Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 overflow-hidden flex flex-col md:flex-row items-center justify-between p-6 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Shift Sedang Aktif</span>
              </div>
              <h2 className="text-xl font-black text-gray-900">
                Saldo Awal: {formatRupiah(activeShift.starting_cash)}
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">
                Dibuka pada: {formatDateTime(activeShift.start_time)}
              </p>
            </div>
            
            <div className="w-full md:w-auto p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-4">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-gray-400">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">ID Shift</p>
                <p className="text-sm font-bold text-gray-700 font-mono">
                  {activeShift.id.split('-')[0].toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Petty Cash Input & History */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2.5">
                  <PlusCircle className="w-5 h-5 text-blue-500" />
                  <h3 className="font-bold text-gray-900">Catat Petty Cash (Pengeluaran)</h3>
                </div>
                <form onSubmit={handleAddExpense} className="p-5 space-y-4 bg-gray-50/50">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Kategori</label>
                    <select
                      value={expCategory}
                      onChange={e => setExpCategory(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium"
                    >
                      <option value="bahan_baku">Bahan Baku (Es Batu, Sayur)</option>
                      <option value="operasional">Operasional (Plastik, ATK)</option>
                      <option value="utilitas">Utilitas (Listrik Darurat)</option>
                      <option value="lainnya">Lainnya</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Keterangan / Nama Barang</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Beli es kristal 2 bungkus"
                      value={expDesc}
                      onChange={e => setExpDesc(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nominal (Rp)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 font-semibold text-sm">Rp</span>
                      </div>
                      <input
                        type="number"
                        required
                        min="100"
                        placeholder="20000"
                        value={expAmount}
                        onChange={e => setExpAmount(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Foto Struk / Bukti (Wajib)</label>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      required
                      onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : 'Simpan Pengeluaran'}
                  </button>
                </form>
              </div>

              {/* Expense List */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 text-sm">Pengeluaran Laci Shift Ini</h3>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Hari Ini</p>
                    <p className="text-sm font-black text-red-600 leading-tight">-{formatRupiah(todayTotal)}</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
                  {expenses.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                      Belum ada pengeluaran
                    </div>
                  ) : (
                    expenses.map(exp => (
                      <div key={exp.id} className="p-4 flex items-start justify-between gap-3 hover:bg-gray-50">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="shrink-0 w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                            <Receipt className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{exp.description}</p>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase mt-0.5">
                              {CATEGORY_LABEL[exp.category] ?? exp.category}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                              <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{exp.creator?.name ?? '—'}</span>
                              <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(exp.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-black text-red-600 shrink-0">
                          -{formatRupiah(exp.amount)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Blind Close Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden h-fit">
              <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center gap-3">
                <LogOut className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-bold text-red-900">Tutup Shift Laci</h2>
              </div>
              <div className="p-6 md:p-8 text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Penutupan Blind Close</h3>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  Hitung secara manual seluruh jumlah uang tunai yang ada di dalam laci saat ini. Masukkan angkanya ke bawah ini. Sistem akan otomatis merekonsiliasi dengan penjualan kasir.
                </p>

                <form onSubmit={handleCloseShift} className="space-y-4">
                  <div className="text-left">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Hitungan Fisik Uang Laci (Actual Cash)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-gray-500 font-semibold">Rp</span>
                      </div>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="Contoh: 850000"
                        value={actualEndingCash}
                        onChange={e => setActualEndingCash(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full pl-12 pr-4 py-3 bg-red-50/50 border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:bg-white transition-colors outline-none font-semibold text-lg text-gray-900 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-sm shadow-red-200/50 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                    Kunci & Tutup Shift
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
