// @ts-nocheck
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PeriodFilterValue, SalesSource } from '@/lib/types'
import type { Preset } from '@/lib/period'
import { presetRange } from '@/lib/period'
import { Store, Globe, Search, Check, ChevronDown, Calendar, Monitor, Gift } from 'lucide-react'
import { getChannel } from '@/lib/channels'

const SOURCES: (SalesSource | 'all')[] = ['all', 'pos', 'online', 'gofood', 'grabfood', 'shopeefood', 'tiktok', 'endors']

const SOURCE_LABELS: Record<string, string> = {
  all: 'Semua Sumber',
  pos: 'POS Kasir',
  online: 'Website Online',
  gofood: 'GoFood',
  grabfood: 'GrabFood',
  shopeefood: 'ShopeeFood',
  tiktok: 'TikTok Go',
  endors: 'Endors',
}

import { OutletCombobox, cleanOutletName } from './OutletCombobox'

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
        <div className="absolute top-full right-0 mt-2 p-4 w-[280px] max-w-[calc(100vw-2rem)] bg-white border border-suka-gray-200 rounded-2xl shadow-xl shadow-suka-brown/10 z-[9999] animate-in fade-in zoom-in-95 duration-200">
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
  value, onChange, outlets, lockedOutletId, hideSource
}: {
  value: PeriodFilterValue
  onChange: (v: PeriodFilterValue) => void
  outlets: { id: string; name: string }[]
  lockedOutletId?: string | null
  hideSource?: boolean
}) {
  const setPreset = (p: Preset) => onChange({ ...value, ...presetRange(p) })

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
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3 sm:items-center w-full 2xl:w-auto justify-end">
      <div className="bg-white/60 backdrop-blur-xl p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-wrap items-stretch gap-0.5 sm:gap-1 text-[11px] sm:text-xs font-bold w-full sm:w-auto">
        {(['kemarin', 'today', '7d', '30d', 'this_month'] as const).map((pOrKemarin) => {
          const p = pOrKemarin === 'kemarin' ? 'yesterday' : pOrKemarin;
          const isActive = currentPreset === p
          const label = p === 'today' ? 'Hari ini' : p === 'yesterday' ? 'Kemarin' : p === '7d' ? '7 Hari' : p === '30d' ? '30 Hari' : 'Bulan ini'
          return (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`flex-1 sm:flex-none px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-lg whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
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
          onChange={(range) => onChange({ ...value, from: range.from, to: range.to })}
          isActive={currentPreset === null}
        />
      </div>

      {/* 2 & 3. Dropdowns — stack to full width on mobile, inline on larger screens */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        {!lockedOutletId && (
          <OutletCombobox
            value={value.outletId}
            outlets={outlets || []}
            includeAll={!outlets || outlets.length > 1}
            onChange={(outletId) => onChange({ ...value, outletId: outletId as PeriodFilterValue['outletId'] })}
          />
        )}
        {!hideSource && (
          <SourceCombobox
            value={value.source}
            onChange={(source) => onChange({ ...value, source: source as PeriodFilterValue['source'] })}
          />
        )}
      </div>
    </div>
  )
}

function SourceCombobox({
  value, onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selectedLabel = SOURCE_LABELS[value] ?? value

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const renderIcon = (id: string, w = "w-4", h = "h-4") => {
    if (id === "all") return <Globe className={`${w} ${h} text-suka-brown/50`} />
    if (id === "pos") return <Monitor className={`${w} ${h} text-suka-brown/50`} />
    if (id === "online") return <Globe className={`${w} ${h} text-suka-brown/50`} />
    if (id === "endors") return <Gift className={`${w} ${h}`} style={{ color: '#d946ef' }} />
    
    const ch = getChannel(id)
    if (ch?.logoPath) {
      return (
        <svg viewBox="0 0 24 24" className={`${w} ${h}`} style={{ fill: ch.bg }}>
          <path d={ch.logoPath} />
        </svg>
      )
    }
    return <Globe className={`${w} ${h} text-suka-brown/50`} />
  }

  return (
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full sm:w-auto flex items-center gap-2 pl-9 pr-8 py-2.5 sm:py-2 bg-white/60 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus:ring-2 focus:ring-suka-orange/20 text-xs font-bold text-suka-brown outline-none cursor-pointer transition-all relative sm:min-w-[160px]"
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
          {renderIcon(value)}
        </span>
        <span className="truncate text-left flex-1">{selectedLabel}</span>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-brown/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full sm:min-w-[180px] right-0 bg-white border border-suka-gray-200 rounded-xl shadow-lg shadow-suka-brown/10 overflow-hidden">
          <ul className="max-h-64 overflow-y-auto py-1">
            {SOURCES.map((s) => {
              const isActive = s === value
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(s)
                      setOpen(false)
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-left transition-colors ${
                      isActive ? "bg-suka-orange/10 text-suka-orange" : "text-suka-brown hover:bg-suka-cream/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {renderIcon(s)}
                      <span className="truncate">{SOURCE_LABELS[s] ?? s}</span>
                    </div>
                    {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

