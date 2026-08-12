'use client'
import { useEffect, useRef, useState } from 'react'
import type { Preset } from '@/lib/period'
import { presetRange } from '@/lib/period'
import { Calendar } from 'lucide-react'

export type PeriodValue = { from: string; to: string }

function CustomDateRangePopover({
  from, to, onChange, isActive
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
  isActive: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  
  const [localFrom, setLocalFrom] = useState(from)
  const [localTo, setLocalTo] = useState(to)

  useEffect(() => {
    if (open) {
      setLocalFrom(from)
      setLocalTo(to)
    }
  }, [open, from, to])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleApply = () => {
    if (localFrom && localTo) {
      onChange({ from: localFrom, to: localTo })
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative flex">
      <button
        onClick={() => setOpen(!open)}
        className={`px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
          isActive || open
            ? 'bg-suka-orange text-white shadow-md font-extrabold ring-1 ring-black/5'
            : 'text-suka-brown/70 hover:text-suka-brown hover:bg-suka-orange/5'
        }`}
        title="Rentang tanggal kustom"
      >
        <Calendar className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        <span className="hidden sm:inline">Kustom</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 p-4 w-[280px] max-w-[calc(100vw-2rem)] bg-white border border-suka-gray-200 rounded-2xl shadow-xl shadow-suka-brown/10 z-[99] animate-in fade-in zoom-in-95 duration-200">
          <h4 className="text-sm font-bold text-suka-brown mb-3">Pilih Rentang Tanggal</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-suka-gray-500 uppercase tracking-wider mb-1">Dari Tanggal</label>
              <input 
                type="date" 
                value={localFrom} 
                onChange={(e) => setLocalFrom(e.target.value)} 
                className="w-full px-3 py-2 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-sm outline-none transition-all text-suka-ink font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-suka-gray-500 uppercase tracking-wider mb-1">Sampai Tanggal</label>
              <input 
                type="date" 
                value={localTo} 
                onChange={(e) => setLocalTo(e.target.value)} 
                min={localFrom}
                className="w-full px-3 py-2 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-sm outline-none transition-all text-suka-ink font-medium"
              />
            </div>
            <button 
              onClick={handleApply}
              disabled={!localFrom || !localTo || localTo < localFrom}
              className="w-full mt-2 bg-suka-orange hover:bg-amber-600 disabled:bg-suka-gray-200 disabled:text-suka-gray-400 disabled:shadow-none text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-suka-orange/20 active:scale-95"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PeriodFilter({
  value, onChange
}: {
  value: PeriodValue
  onChange: (v: PeriodValue) => void
}) {
  const setPreset = (p: Preset) => onChange(presetRange(p))

  // Determine current active preset based on exact date match
  const activePreset = () => {
    const pToday = presetRange('today')
    if (value.from === pToday.from && value.to === pToday.to) return 'today'
    
    const pYesterday = presetRange('yesterday')
    if (value.from === pYesterday.from && value.to === pYesterday.to) return 'yesterday'

    const p7d = presetRange('7d')
    if (value.from === p7d.from && value.to === p7d.to) return '7d'

    const p30d = presetRange('30d')
    if (value.from === p30d.from && value.to === p30d.to) return '30d'

    const pThisMonth = presetRange('this_month')
    if (value.from === pThisMonth.from && value.to === pThisMonth.to) return 'this_month'

    return null
  }

  const currentPreset = activePreset()

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center w-full justify-end">
      <div className="bg-white p-1.5 rounded-2xl shadow-[0_2px_12px_rgba(44,24,16,0.02)] border border-suka-brown/5 flex items-stretch gap-1 text-xs font-bold w-full sm:w-auto flex-wrap sm:flex-nowrap">
        {(['today', 'kemarin', '7d', '30d', 'this_month'] as const).map((pOrKemarin) => {
          const p = pOrKemarin === 'kemarin' ? 'yesterday' : pOrKemarin;
          const isActive = currentPreset === p
          const label = p === 'today' ? 'Hari ini' : p === 'yesterday' ? 'Kemarin' : p === '7d' ? '7 Hari' : p === '30d' ? '30 Hari' : 'Bulan ini'
          return (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`flex-1 sm:flex-none px-1.5 sm:px-4 py-2 sm:py-2.5 rounded-lg whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
                isActive
                  ? 'bg-suka-orange text-white shadow-md font-extrabold ring-1 ring-black/5'
                  : 'text-suka-brown/70 hover:text-suka-brown hover:bg-suka-orange/5'
              }`}
            >
              {label}
            </button>
          )
        })}
        <CustomDateRangePopover
          from={value.from}
          to={value.to}
          onChange={(range) => onChange({ from: range.from, to: range.to })}
          isActive={currentPreset === null}
        />
      </div>
    </div>
  )
}
