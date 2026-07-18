'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import confetti from 'canvas-confetti'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { useQuery } from '@tanstack/react-query'
import { Target, PartyPopper, Sparkles, Info, AlertTriangle, Printer } from 'lucide-react'
import { usePrinterStore } from '@/lib/printerStore'

/**
 * Briefing Hari Ini — satu kartu persisten di atas konten kasir yang menyatukan:
 *  1. Progress target harian (live, warna merah/kuning/hijau + selebrasi 100%).
 *  2. Pesan owner aktif (motivasi/info/peringatan).
 * Tidak ada popup blocking: semua tampil sebagai banner. Pesan akan hilang secara otomatis
 * sesuai durasi yang diatur oleh owner.
 */

type Kind = 'motivasi' | 'info' | 'peringatan'

interface Message {
  id: string
  kind: Kind
  title: string | null
  body: string
  created_at: string
  expires_at: string | null
}

interface Progress {
  outlet_name: string
  target_amount: number
  omzet_today: number
}

const MSG_STYLE: Record<Kind, { icon: typeof Info; color: string; soft: string; label: string }> = {
  motivasi:   { icon: Sparkles,      color: '#f29744', soft: '#fff3e6', label: 'Motivasi' },
  info:       { icon: Info,          color: '#0a7d2c', soft: '#eafaef', label: 'Informasi' },
  peringatan: { icon: AlertTriangle, color: '#dc2626', soft: '#fdeaea', label: 'Peringatan' },
}

function rupiahCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const v = n / 1_000_000
    return `Rp ${(v % 1 === 0 ? v.toString() : v.toFixed(1).replace('.', ','))} Jt`
  }
  if (abs >= 1_000) {
    const v = n / 1_000
    return `Rp ${(v % 1 === 0 ? v.toString() : v.toFixed(1).replace('.', ','))} Rb`
  }
  return `Rp ${Math.round(n)}`
}

export default function BriefingBanner() {
  const { outletId, loaded } = useMyOutlet()
  const { device, isConnecting } = usePrinterStore()

  // ── Target harian (live via React Query) ──────────────────────────────────
  const [celebrate, setCelebrate] = useState(false)
  const wasDoneRef = useRef(false)

  const { data: progress } = useQuery<Progress | null>({
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
    if (progress && progress.target_amount > 0) {
      const done = progress.omzet_today >= progress.target_amount
      if (done && !wasDoneRef.current) {
        setCelebrate(true)
        
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function() {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          confetti(Object.assign({}, defaults, { particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          }));
          confetti(Object.assign({}, defaults, { particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          }));
        }, 250);

        setTimeout(() => setCelebrate(false), 5000)
      }
      wasDoneRef.current = done
    }
  }, [progress])

  // ── Pesan owner (realtime) ────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([])
  const fetchMessages = useCallback(async () => {
    const supabase = createClient()
    try {
      const { data } = await supabase.rpc('get_my_active_messages')
      if (Array.isArray(data)) {
        setMessages((data as Message[]))
      } else {
        setMessages([])
      }
    } catch (e) {
      console.error('Error fetching owner messages:', e)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
    const supabase = createClient()
    const channel = supabase
      .channel('kasir-briefing-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'owner_messages' }, () => {
        setTimeout(fetchMessages, 500)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'owner_message_outlets' }, () => {
        setTimeout(fetchMessages, 500)
      })
      .subscribe()
    const interval = setInterval(fetchMessages, 60000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchMessages])



  // ── Derived target visuals ────────────────────────────────────────────────
  const target = useMemo(() => {
    if (!progress || progress.target_amount <= 0) return null
    const pct = Math.min((progress.omzet_today / progress.target_amount) * 100, 100)
    const pctRaw = Math.round((progress.omzet_today / progress.target_amount) * 100)
    const done = progress.omzet_today >= progress.target_amount
    const isGreen = pctRaw >= 100
    const isYellow = pctRaw >= 30 && pctRaw < 100
    const bg = done || isGreen ? 'bg-[#eafaef] border-[#bfe6c9]' : isYellow ? 'bg-[#fffaf4] border-[#ecdcc9]' : 'bg-red-50 border-red-200'
    const iconColor = done || isGreen ? 'text-[#0a7d2c]' : isYellow ? 'text-[#904d00]' : 'text-red-600'
    const barColor = done || isGreen ? 'bg-[#0a7d2c]' : isYellow ? 'bg-[#f29744]' : 'bg-red-500'
    const amountColor = done || isGreen ? 'text-[#0a7d2c]' : isYellow ? 'text-[#643400]' : 'text-red-700'
    return { pct, pctRaw, done, isGreen, isYellow, bg, iconColor, barColor, amountColor }
  }, [progress])

  if (!target && messages.length === 0) return null

  return (
    <div className="print:hidden sticky top-0 z-20">
      {/* ── Baris target harian ── */}
      {target && progress && (
        <div className={`px-4 sm:px-6 py-2.5 border-b transition-colors ${target.bg}`}>
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <div className={`flex items-center gap-1.5 shrink-0 ${target.iconColor}`}>
              {target.done ? <PartyPopper className="w-4 h-4" /> : <Target className="w-4 h-4" />}
              <span className="text-[11px] font-extrabold uppercase tracking-wider hidden sm:inline">
                {target.done ? 'Target Tercapai!' : 'Target Hari Ini'}
              </span>
              <div className="relative flex items-center justify-center w-3.5 h-3.5 ml-1">
                <div className={`absolute inset-0 rounded-full blur-[3px] opacity-60 ${target.barColor} ${target.done || target.isGreen ? '' : target.isYellow ? 'animate-pulse' : 'manual-blink-fast'}`}></div>
                <div className={`relative w-2 h-2 rounded-full ${target.barColor} shadow-sm ${target.done || target.isGreen ? '' : target.isYellow ? 'animate-pulse' : 'manual-blink-fast'}`}></div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="h-2.5 rounded-full bg-black/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${target.barColor} ${celebrate ? 'animate-pulse' : ''}`}
                  style={{ width: `${target.pct}%` }}
                />
              </div>
            </div>

            <div className="shrink-0 text-right leading-tight">
              <p className={`text-xs font-extrabold ${target.amountColor}`}>
                {rupiahCompact(progress.omzet_today)}
                <span className="text-[#a98b73] font-bold"> / {rupiahCompact(progress.target_amount)}</span>
              </p>
              <p className={`text-[10px] font-bold ${target.amountColor}`}>{target.pctRaw}%</p>
            </div>
          </div>

          {celebrate && (
            <div className="pointer-events-none absolute inset-x-0 top-full flex justify-center">
              <div className="mt-1 px-4 py-1.5 rounded-full bg-[#0a7d2c] text-white text-xs font-extrabold shadow-lg animate-bounce flex items-center gap-1.5">
                <PartyPopper className="w-3.5 h-3.5" /> Selamat! Target hari ini tercapai 🎉
              </div>
            </div>
          )}
          
          <div className="max-w-6xl mx-auto flex items-center mt-2">
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${device ? 'bg-green-100/50 text-green-700 border-green-200/50' : 'bg-gray-100/50 text-gray-500 border-gray-200/50'}`}>
              <Printer className="w-3 h-3" />
              {device ? 'Printer Kasir Terhubung' : isConnecting ? 'Menghubungkan...' : 'Printer Kasir Belum Terhubung'}
            </div>
          </div>
        </div>
      )}

      {/* ── Baris pesan owner (dapat ditutup) ── */}
      {messages.map((m) => {
        const meta = MSG_STYLE[m.kind] ?? MSG_STYLE.motivasi
        const Icon = meta.icon
        return (
          <div
            key={m.id}
            className="border-b flex items-start sm:items-center gap-3 px-4 sm:px-6 py-2.5 animate-fade-in relative"
            style={{ backgroundColor: meta.soft, borderColor: `${meta.color}30` }}
          >
            <div className="absolute top-0 left-0 bottom-0 w-1" style={{ backgroundColor: meta.color }} />
            <div className="max-w-6xl mx-auto w-full flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'white', color: meta.color }}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-extrabold text-[#1e1b15] leading-tight mb-0.5">
                  Pesan dari Owner{m.title ? ` — ${m.title}` : ''}
                </h4>
                <p className="text-xs font-semibold text-[#3a322b] whitespace-pre-wrap">{m.body}</p>
              </div>

            </div>
          </div>
        )
      })}

      <style>{`
        @keyframes manual-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .manual-blink-fast {
          animation: manual-blink 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
