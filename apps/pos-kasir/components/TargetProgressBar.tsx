'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { Target, PartyPopper } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

interface Progress {
  outlet_name: string
  target_amount: number
  omzet_today: number
}

function rupiahCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const v = n / 1_000_000
    return `Rp ${(v % 1 === 0 ? v.toString() : v.toFixed(1).replace('.', ','))} Jt`
  }
  if (abs >= 1_000) {
    const v = n / 1_000
    return `Rp ${(v % 1 === 0 ? v.toString() : v.toFixed(1).replace('.', ','))} Rb`
  }
  return `Rp ${Math.round(n)}`
}

/**
 * Bar progress target harian — sticky di atas konten kasir, selalu terlihat.
 * Realtime: React Query akan di-invalidate saat ada perubahan orders.
 * Tampil hanya bila outlet punya target > 0. Selebrasi saat tercapai 100%.
 */
export default function TargetProgressBar() {
  const { outletId, loaded } = useMyOutlet()
  const [celebrate, setCelebrate] = useState(false)
  const wasDoneRef = useRef(false)
  
  const { data } = useQuery<Progress | null>({
    queryKey: ['target_progress', outletId],
    queryFn: async () => {
      const supabase = createClient()
      const { data: rows } = await supabase.rpc('get_my_target_progress')
      const row = Array.isArray(rows) ? rows[0] : null
      if (!row) return null
      return {
        outlet_name: row.outlet_name,
        target_amount: Number(row.target_amount) || 0,
        omzet_today: Number(row.omzet_today) || 0,
      }
    },
    enabled: loaded && !!outletId,
    staleTime: 0,
  })

  useEffect(() => {
    if (data && data.target_amount > 0) {
      const done = data.omzet_today >= data.target_amount
      if (done && !wasDoneRef.current) {
        setCelebrate(true)
        setTimeout(() => setCelebrate(false), 5000)
      }
      wasDoneRef.current = done
    }
  }, [data])



  if (!data || data.target_amount <= 0) return null

  const pct = Math.min((data.omzet_today / data.target_amount) * 100, 100)
  const pctRaw = Math.round((data.omzet_today / data.target_amount) * 100)
  const isGreen = pctRaw >= 100
  const isYellow = pctRaw >= 30 && pctRaw < 100
  const isRed = pctRaw < 30
  const done = data.omzet_today >= data.target_amount

  // Menyesuaikan warna berdasarkan pctRaw (Merah, Kuning, Hijau)
  const bgColor = done ? 'bg-[#eafaef] border-[#bfe6c9]' 
                : isGreen ? 'bg-[#eafaef] border-[#bfe6c9]'
                : isYellow ? 'bg-[#fffaf4] border-[#ecdcc9]'
                : 'bg-red-50 border-red-200'
                
  const iconColor = done ? 'text-[#0a7d2c]' 
                  : isGreen ? 'text-[#0a7d2c]'
                  : isYellow ? 'text-[#904d00]'
                  : 'text-red-600'
                  
  const barColor = done ? 'bg-[#0a7d2c]' 
                 : isGreen ? 'bg-[#0a7d2c]'
                 : isYellow ? 'bg-[#f29744]'
                 : 'bg-red-500'

  const amountColor = done ? 'text-[#0a7d2c]'
                    : isGreen ? 'text-[#0a7d2c]'
                    : isYellow ? 'text-[#643400]'
                    : 'text-red-700'

  return (
    <div className="print:hidden sticky top-0 lg:top-0 z-20">
      <div
        className={`px-4 sm:px-6 py-2.5 border-b transition-colors ${bgColor}`}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className={`flex items-center gap-1.5 shrink-0 ${iconColor}`}>
            {done ? <PartyPopper className="w-4 h-4" /> : <Target className="w-4 h-4" />}
            <span className="text-[11px] font-extrabold uppercase tracking-wider hidden sm:inline">
              {done ? 'Target Tercapai!' : 'Target Hari Ini'}
            </span>
            <div className="relative flex items-center justify-center w-3.5 h-3.5 ml-1">
              <div className={`absolute inset-0 rounded-full blur-[3px] opacity-60 ${barColor} ${done || isGreen ? '' : isYellow ? 'animate-pulse' : 'animate-blink-fast'}`}></div>
              <div className={`relative w-2.5 h-2.5 rounded-full ${barColor} shadow-sm ${done || isGreen ? '' : isYellow ? 'animate-pulse' : 'animate-blink-fast'}`}></div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="h-2.5 rounded-full bg-black/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${barColor} ${celebrate ? 'animate-pulse' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="shrink-0 text-right leading-tight">
            <p className={`text-xs font-extrabold ${amountColor}`}>
              {rupiahCompact(data.omzet_today)}
              <span className="text-[#a98b73] font-bold"> / {rupiahCompact(data.target_amount)}</span>
            </p>
            <p className={`text-[10px] font-bold ${amountColor}`}>{pctRaw}%</p>
          </div>
        </div>
      </div>

      {celebrate && (
        <div className="pointer-events-none absolute inset-x-0 top-full flex justify-center">
          <div className="mt-1 px-4 py-1.5 rounded-full bg-[#0a7d2c] text-white text-xs font-extrabold shadow-lg animate-bounce flex items-center gap-1.5">
            <PartyPopper className="w-3.5 h-3.5" /> Selamat! Target hari ini tercapai 🎉
          </div>
        </div>
      )}
    </div>
  )
}
