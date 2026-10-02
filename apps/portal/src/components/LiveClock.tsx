'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface LiveClockProps {
  initialTime?: string
  className?: string
}

export default function LiveClock({ initialTime = '', className = '' }: LiveClockProps) {
  const [time, setTime] = useState<string>(initialTime)

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const formatted = now.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).replace(/\./g, ':') // id-ID uses dots (14.46.12), convert to standard colon (14:46:12)
      setTime(`${formatted} WIB`)
    }

    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  if (!time) {
    return null
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-mono font-bold tracking-wider text-amber-200/95 bg-black/25 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 shadow-sm tabular-nums select-none ${className}`}
      title="Waktu Indonesia Barat (WIB)"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
      <Clock size={12} className="text-amber-300 shrink-0" />
      <span>{time}</span>
    </div>
  )
}
