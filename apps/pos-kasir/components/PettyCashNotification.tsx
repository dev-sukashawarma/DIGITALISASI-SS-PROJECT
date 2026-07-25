'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { ArrowDownToLine, Wallet, X, Info } from 'lucide-react'

interface PendingTopup {
  id: string
  amount: number
  description: string
  created_at: string
}

export default function PettyCashNotification() {
  const { outletId } = useMyOutlet()
  const router = useRouter()
  const pathname = usePathname()

  const [pendingTopup, setPendingTopup] = useState<PendingTopup | null>(null)
  const dismissedIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!outletId) return

    const supabase = createClient()

    const checkPendingTopups = async () => {
      try {
        const { data, error } = await supabase
          .from('petty_cash_topups')
          .select('id, amount, description, created_at')
          .eq('outlet_id', outletId)
          .eq('status', 'forwarded_by_leader')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!error && data && !dismissedIds.current.has(data.id)) {
          setPendingTopup(data)
        }
      } catch (err) {
        console.error('Error checking pending topups:', err)
      }
    }

    checkPendingTopups()

    const channel = supabase
      .channel(`petty-cash-notification-${outletId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'petty_cash_topups',
          filter: `outlet_id=eq.${outletId}`,
        },
        (payload: any) => {
          const newStatus = payload.new?.status
          const id = payload.new?.id

          if (newStatus === 'forwarded_by_leader' && id && !dismissedIds.current.has(id)) {
            setPendingTopup({
              id,
              amount: payload.new.amount || 0,
              description: payload.new.description || '',
              created_at: payload.new.created_at || new Date().toISOString(),
            })
          } else if (newStatus === 'completed' && id) {
            setPendingTopup((prev) => (prev?.id === id ? null : prev))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [outletId])

  function handleConfirm() {
    if (pendingTopup) {
      dismissedIds.current.add(pendingTopup.id)
    }
    setPendingTopup(null)

    if (pathname === '/kasir/shift') {
      window.dispatchEvent(new CustomEvent('start-petty-cash-tour', { detail: pendingTopup }))
    } else {
      router.push('/kasir/shift?tour=terima-dana')
    }
  }

  function handleDismiss() {
    if (pendingTopup) {
      dismissedIds.current.add(pendingTopup.id)
    }
    setPendingTopup(null)
  }

  if (!pendingTopup) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200 relative">
        {/* Top Header Section */}
        <div className="p-6 pb-3 relative">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Clean Icon Badge */}
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4 border border-blue-100/80">
            <Wallet className="w-6 h-6" />
          </div>

          <h3 className="text-lg font-bold text-gray-900 tracking-tight">
            Top-Up Petty Cash Siap Diterima
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Konfirmasi fisik uang sebelum saldo bertambah
          </p>
        </div>

        {/* Content Body */}
        <div className="px-6 space-y-3.5 pb-6">
          {/* Nominal Display Card */}
          <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-4 text-center">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Nominal Dana
            </span>
            <div className="text-2xl font-black text-gray-900 tracking-tight">
              +Rp {pendingTopup.amount.toLocaleString('id-ID')}
            </div>
            {pendingTopup.description && (
              <p className="text-xs text-gray-600 mt-1.5 font-medium line-clamp-2">
                "{pendingTopup.description}"
              </p>
            )}
          </div>

          {/* Info callout */}
          <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
              Saldo Petty Cash <b>belum bertambah</b>. Klik tombol di bawah untuk mengonfirmasi penerimaan.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-1 space-y-2">
            <button
              onClick={handleConfirm}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition-all shadow-sm shadow-blue-200 flex items-center justify-center gap-2"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Buka & Terima Dana
            </button>
            <button
              onClick={handleDismiss}
              className="w-full py-2 text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors text-center"
            >
              Nanti Saja
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
