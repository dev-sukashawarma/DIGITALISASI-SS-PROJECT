'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { Target, PartyPopper } from 'lucide-react'

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
 * Realtime: refetch (debounced) tiap ada perubahan `orders` outlet ini.
 * Tampil hanya bila outlet punya target > 0. Selebrasi saat tercapai 100%.
 */
export default function TargetProgressBar() {
  const { outletId, loaded } = useMyOutlet()
  const [data, setData] = useState<Progress | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const wasDoneRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchProgress = useCallback(async () => {
    const supabase = createClient()
    const { data: rows } = await supabase.rpc('get_my_target_progress')
    const row = Array.isArray(rows) ? rows[0] : null
    if (!row) {
      setData(null)
      return
    }
    const next: Progress = {
      outlet_name: row.outlet_name,
      target_amount: Number(row.target_amount) || 0,
      omzet_today: Number(row.omzet_today) || 0,
    }
    setData(next)

    // Selebrasi sekali saat baru tercapai
    const done = next.target_amount > 0 && next.omzet_today >= next.target_amount
    if (done && !wasDoneRef.current) {
      setCelebrate(true)
      setTimeout(() => setCelebrate(false), 5000)
    }
    wasDoneRef.current = done
  }, [])

  useEffect(() => {
    if (!loaded || !outletId) return
    fetchProgress()

    const supabase = createClient()
    const scheduleRefetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(fetchProgress, 1000)
    }

    const channel = supabase
      .channel(`kasir-target:${outletId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${outletId}` },
        scheduleRefetch
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_sales_targets' },
        scheduleRefetch
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [loaded, outletId, fetchProgress])

  // Tidak ada target → tidak menampilkan apa-apa
  if (!data || data.target_amount <= 0) return null

  const pct = Math.min((data.omzet_today / data.target_amount) * 100, 100)
  const pctRaw = Math.round((data.omzet_today / data.target_amount) * 100)
  const done = data.omzet_today >= data.target_amount

  return (
    <div className="print:hidden sticky top-0 lg:top-0 z-20">
      <div
        className={`px-4 sm:px-6 py-2.5 border-b transition-colors ${
          done ? 'bg-[#eafaef] border-[#bfe6c9]' : 'bg-[#fffaf4] border-[#ecdcc9]'
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className={`flex items-center gap-1.5 shrink-0 ${done ? 'text-[#0a7d2c]' : 'text-[#904d00]'}`}>
            {done ? <PartyPopper className="w-4 h-4" /> : <Target className="w-4 h-4" />}
            <span className="text-[11px] font-extrabold uppercase tracking-wider hidden sm:inline">
              {done ? 'Target Tercapai!' : 'Target Hari Ini'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="h-2.5 rounded-full bg-[#ecdcc9]/70 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  done ? 'bg-[#0a7d2c]' : 'bg-[#f29744]'
                } ${celebrate ? 'animate-pulse' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="shrink-0 text-right leading-tight">
            <p className={`text-xs font-extrabold ${done ? 'text-[#0a7d2c]' : 'text-[#643400]'}`}>
              {rupiahCompact(data.omzet_today)}
              <span className="text-[#a98b73] font-bold"> / {rupiahCompact(data.target_amount)}</span>
            </p>
            <p className={`text-[10px] font-bold ${done ? 'text-[#0a7d2c]' : 'text-[#904d00]'}`}>{pctRaw}%</p>
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
