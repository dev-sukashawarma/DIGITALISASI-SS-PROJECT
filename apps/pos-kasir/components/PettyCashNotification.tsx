'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { ArrowDownToLine, Wallet, Info, MessageSquare } from 'lucide-react'

interface PendingTopup {
  id: string
  amount: number
  description: string
  created_at: string
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

export default function PettyCashNotification() {
  const { outletId } = useMyOutlet()
  const router = useRouter()
  const pathname = usePathname()

  const [pendingTopup, setPendingTopup] = useState<PendingTopup | null>(null)

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

        if (!error && data) {
          setPendingTopup(data)
        } else {
          setPendingTopup(null)
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

          if (newStatus === 'forwarded_by_leader' && id) {
            setPendingTopup({
              id,
              amount: payload.new.amount || 0,
              description: payload.new.description || '',
              created_at: payload.new.created_at || new Date().toISOString(),
            })
          } else if (newStatus === 'completed' && id) {
            setPendingTopup((prev) => (prev?.id === id ? null : prev))
          } else if (newStatus && newStatus !== 'forwarded_by_leader') {
             // If status changed to something else (e.g., rejected), remove if it's the current one
            setPendingTopup((prev) => (prev?.id === id ? null : prev))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [outletId])

  // Automatically hide the modal if the user is already on the Petty Cash page
  if (!pendingTopup || pathname === '/kasir/shift') return null

  const { mainReason, financeNote } = parseFinanceNote(pendingTopup.description)

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200 relative">
        {/* Top Header Section */}
        <div className="p-6 pb-3 relative">
          {/* Clean Icon Badge */}
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4 border border-blue-100/80">
            <Wallet className="w-6 h-6" />
          </div>

          <h3 className="text-xl font-black text-gray-900 tracking-tight leading-tight">
            Ada Dana Petty Cash<br/>Siap Diterima!
          </h3>
          <p className="text-xs text-gray-500 mt-1.5 font-medium">
            Kasir wajib mengonfirmasi penerimaan dana sebelum melanjutkan transaksi.
          </p>
        </div>

        {/* Content Body */}
        <div className="px-6 space-y-3.5 pb-6">
          {/* Nominal Display Card */}
          <div className="bg-gray-50/80 border border-gray-100 rounded-2xl p-4 text-center">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Nominal Pencairan
            </span>
            <div className="text-3xl font-black text-gray-900 tracking-tight">
              +Rp {pendingTopup.amount.toLocaleString('id-ID')}
            </div>
            {mainReason && (
              <p className="text-xs text-gray-600 mt-2 font-medium line-clamp-2">
                "{mainReason}"
              </p>
            )}
          </div>

          {/* Highlighted Catatan Finance */}
          {financeNote && (
            <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 text-xs text-amber-950 font-semibold space-y-1">
              <div className="flex items-center gap-1.5 text-amber-800 font-extrabold">
                <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Catatan Finance:</span>
              </div>
              <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                {financeNote}
              </p>
            </div>
          )}

          {/* Info callout */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-900 font-medium leading-relaxed">
              Anda tidak bisa menutup pop-up ini. Silakan menuju halaman Petty Cash untuk menyelesaikan proses.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2">
            <button
              onClick={() => router.push('/kasir/shift?tour=terima-dana')}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black rounded-xl text-sm transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Menuju Halaman Petty Cash
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

