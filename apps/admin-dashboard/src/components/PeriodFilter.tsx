'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PeriodFilterValue, SalesSource } from '@/lib/types'
import type { Preset } from '@/lib/period'
import { presetRange } from '@/lib/period'
import { Store, Globe, Search, Check, ChevronDown, Calendar, Monitor } from 'lucide-react'
import { getChannel } from '@/lib/channels'

const SOURCES: (SalesSource | 'all')[] = ['all', 'pos', 'online', 'gofood', 'grabfood', 'shopeefood', 'tiktok']

const SOURCE_LABELS: Record<string, string> = {
  all: 'Semua Sumber',
  pos: 'POS Kasir',
  online: 'Website Online',
  gofood: 'GoFood',
  grabfood: 'GrabFood',
  shopeefood: 'ShopeeFood',
  tiktok: 'TikTok Shop',
}

function cleanOutletName(name: string) {
  return name.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
}

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
        <div className="absolute top-full right-0 mt-2 p-4 w-[280px] max-w-[calc(100vw-2rem)] bg-white border border-suka-gray-200 rounded-2xl shadow-xl shadow-suka-brown/10 z-50 animate-in fade-in zoom-in-95 duration-200">
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

function OutletCombobox({
  value, outlets, onChange,
}: {
  value: string
  outlets: { id: string; name: string }[]
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options = useMemo(
    () => [{ id: 'all', name: 'Semua Outlet' }, ...outlets.map((o) => ({ id: o.id, name: cleanOutletName(o.name) }))],
    [outlets]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.name.toLowerCase().includes(q))
  }, [options, query])

  const selectedLabel = options.find((o) => o.id === value)?.name ?? 'Semua Outlet'

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full sm:w-auto flex items-center gap-2 pl-9 pr-8 py-2.5 sm:py-2 bg-suka-cream/30 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-xs font-bold text-suka-brown outline-none cursor-pointer transition-all relative sm:min-w-[180px]"
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/50">
          <Store className="w-4 h-4" />
        </span>
        <span className="truncate text-left flex-1">{selectedLabel}</span>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-brown/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full sm:w-64 bg-white border border-suka-gray-200 rounded-xl shadow-lg shadow-suka-brown/10 overflow-hidden">
          <div className="relative p-2 border-b border-suka-gray-100">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-brown/40" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari outlet..."
              className="w-full pl-7 pr-2 py-1.5 text-xs font-semibold text-suka-brown bg-suka-cream/40 rounded-lg outline-none focus:ring-2 focus:ring-suka-orange/15 placeholder:text-suka-brown/30 placeholder:font-medium"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-suka-brown/40 font-medium italic">Outlet tidak ditemukan</li>
            )}
            {filtered.map((o) => {
              const isActive = o.id === value
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.id)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-left transition-colors ${
                      isActive ? 'bg-suka-orange/10 text-suka-orange' : 'text-suka-brown hover:bg-suka-cream/60'
                    }`}
                  >
                    <span className="truncate">{o.name}</span>
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

    return null
  }

  const currentPreset = activePreset()

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center">
      {/* 1. Date Range Presets (Segmented control) — equal-width on mobile, inline on desktop */}
      <div className="bg-suka-cream p-1 rounded-xl border border-suka-brown/5 flex items-stretch gap-1 text-xs font-bold shadow-inner w-full sm:w-auto">
        {(['kemarin', 'today', '7d', '30d'] as const).map((pOrKemarin) => {
          const p = pOrKemarin === 'kemarin' ? 'yesterday' : pOrKemarin;
          const isActive = currentPreset === p
          const label = p === 'today' ? 'Hari ini' : p === 'yesterday' ? 'Kemarin' : p === '7d' ? '7 Hari' : '30 Hari'
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
          onChange={(range) => onChange({ ...value, from: range.from, to: range.to })}
          isActive={currentPreset === null}
        />
      </div>

      {/* 2 & 3. Dropdowns — stack to full width on mobile, inline on larger screens */}
      <div className="flex flex-col sm:flex-row gap-3">
        {lockedOutletId ? (
          <div className="w-full sm:w-auto flex items-center gap-2 pl-9 pr-4 py-2.5 sm:py-2 bg-suka-cream/30 border border-suka-gray-200 rounded-xl text-xs font-bold text-suka-brown relative sm:min-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/50">
              <Store className="w-4 h-4" />
            </span>
            <span className="truncate text-left flex-1">
              {cleanOutletName(outlets.find((o) => o.id === lockedOutletId)?.name ?? 'Outlet Saya')}
            </span>
          </div>
        ) : (
          <OutletCombobox
            value={value.outletId}
            outlets={outlets}
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
        className="w-full sm:w-auto flex items-center gap-2 pl-9 pr-8 py-2.5 sm:py-2 bg-suka-cream/30 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-xs font-bold text-suka-brown outline-none cursor-pointer transition-all relative sm:min-w-[160px]"
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

