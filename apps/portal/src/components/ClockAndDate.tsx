'use client'

import { useEffect, useState } from 'react'
import { Calendar, Clock } from 'lucide-react'

interface ClockAndDateProps {
  initialDate: string
}

export default function ClockAndDate({ initialDate }: ClockAndDateProps) {
  const [timeStr, setTimeStr] = useState<string>('')

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const timeOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }
      setTimeStr(now.toLocaleTimeString('id-ID', timeOptions) + ' WIB')
    }

    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="bg-white/10 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex items-center gap-4 text-xs font-bold text-white flex-shrink-0 w-full sm:w-auto sm:min-w-[220px] shadow-inner shadow-white/5">
      <div className="w-9 h-9 rounded-xl bg-suka-orange/20 border border-suka-orange/30 flex items-center justify-center shrink-0">
        <Calendar size={18} className="text-suka-orange" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] text-white/60 uppercase tracking-widest leading-none font-bold">Waktu Operasional</p>
        <p className="mt-1.5 leading-tight text-white font-black truncate">{initialDate}</p>
        <p className="text-xs text-suka-orange font-mono font-bold mt-1 flex items-center gap-1.5 bg-suka-orange/10 border border-suka-orange/20 px-2 py-0.5 rounded w-max">
          <Clock size={11} className="animate-pulse" />
          <span>{timeStr || '--:--:-- WIB'}</span>
        </p>
      </div>
    </div>
  )
}
