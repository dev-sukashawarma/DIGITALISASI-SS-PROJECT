'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { fastLogout } from '@/lib/fast-logout'
import { formatRupiah } from '@/lib/validations'
import { Wallet, LogOut, Loader2 } from 'lucide-react'
import { useNetworkStatus } from '@/lib/useNetworkStatus'

export default function ShiftBlockerMount() {
  const { outletId, loaded } = useMyOutlet()
  const supabase = createClient()
  const isOnline = useNetworkStatus()
  
  const [loading, setLoading] = useState(true)
  const [isShiftActive, setIsShiftActive] = useState(true) // assume true until we know
  const [startingPettyCash, setStartingPettyCash] = useState<string>('')
  const [pettyCashLocked, setPettyCashLocked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (outletId && loaded) {
      checkShiftState()

      const channelName = `shift-blocker-${outletId}`
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `outlet_id=eq.${outletId}` }, () => {
          checkShiftState(true)
        })
        .subscribe()

      const interval = setInterval(() => {
        checkShiftState(true)
      }, 30000)

      return () => {
        clearInterval(interval)
        supabase.removeChannel(channel)
      }
    } else if (loaded && !outletId) {
       // Not logged in or no outlet, wait for redirect by other components
       setLoading(false)
    }
  }, [outletId, loaded, supabase])

  async function checkShiftState(isSilent = false) {
    try {
      if (!isSilent) setLoading(true)
      
      const { data: activeShift, error: shiftError } = await supabase
        .from('shifts')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('status', 'open')
        .maybeSingle()

      if (shiftError) throw shiftError

      if (activeShift) {
        setIsShiftActive(true)
      } else {
        setIsShiftActive(false)
        await calculateStartingPettyCash()
      }
    } catch (err: any) {
      console.warn('Gagal cek state shift blocker:', err)
    } finally {
      if (!isSilent) setLoading(false)
    }
  }

  async function calculateStartingPettyCash() {
    try {
      const { data: sharedBalance, error: balanceError } = await supabase.rpc('get_petty_cash_balance', {
        p_outlet_id: outletId,
      })

      if (!balanceError) {
        const { count } = await supabase
          .from('shifts')
          .select('id', { count: 'exact', head: true })
          .eq('outlet_id', outletId)

        if ((count ?? 0) > 0) {
          setStartingPettyCash(String(Number(sharedBalance) || 0))
          setPettyCashLocked(true)
          return
        }
      }

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
    } catch (err) {
      console.warn('Gagal kalkulasi saldo awal:', err)
      setStartingPettyCash('0')
      setPettyCashLocked(false)
    }
  }

  async function handleOpenShift(e: React.FormEvent) {
    e.preventDefault()
    if (!isOnline) {
      setErrorMsg('Anda harus online untuk membuka shift.')
      return
    }
    setErrorMsg('')
    setIsSubmitting(true)

    try {
      const amount = parseFloat(startingPettyCash)
      if (isNaN(amount) || amount < 0) throw new Error('Saldo awal Petty Cash tidak valid')
      const { error } = await supabase.rpc('open_shift', { p_outlet_id: outletId, p_starting_petty_cash: amount })
      if (error) throw error
      
      // Shift opened successfully, trigger state fetch
      await checkShiftState()
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuka shift')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading || isShiftActive || !outletId || !loaded) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-white/95 backdrop-blur flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full border border-gray-100 relative">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600 mb-4">
            <Wallet className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Buka Shift Kasir</h2>
          <p className="text-gray-500 text-sm">
            Anda harus membuka shift terlebih dahulu sebelum dapat mengakses pos kasir dan melakukan transaksi.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4 border border-red-100 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleOpenShift} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Saldo Awal Petty Cash (Uang Kembalian)
            </label>
            {pettyCashLocked ? (
              <div className="relative">
                <input
                  type="text"
                  value={formatRupiah(Number(startingPettyCash) || 0)}
                  disabled
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-medium"
                />
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  Mengikuti sisa saldo petty cash dari closing shift sebelumnya. Hubungi SPV/Admin bila nominal ini perlu diubah.
                </p>
              </div>
            ) : (
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500 font-medium">Rp</span>
                <input
                  type="number"
                  required
                  min="0"
                  value={startingPettyCash}
                  onChange={(e) => setStartingPettyCash(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Membuka Shift...
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                Buka Shift Sekarang
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-gray-100 pt-4">
          <button
            onClick={() => fastLogout('/login')}
            type="button"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Keluar Akun (Logout)
          </button>
        </div>
      </div>
    </div>
  )
}
