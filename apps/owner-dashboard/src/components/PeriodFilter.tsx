'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PeriodFilterValue, SalesSource } from '@/lib/types'
import type { Preset } from '@/lib/period'
import { presetRange } from '@/lib/period'
import { Store, Globe, Search, Check, ChevronDown } from 'lucide-react'

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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-9 pr-8 py-2 bg-suka-cream/30 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-xs font-bold text-suka-brown outline-none cursor-pointer transition-all relative min-w-[180px]"
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/50">
          <Store className="w-4 h-4" />
        </span>
        <span className="truncate text-left flex-1">{selectedLabel}</span>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-brown/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-64 bg-white border border-suka-gray-200 rounded-xl shadow-lg shadow-suka-brown/10 overflow-hidden">
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
  value, onChange, outlets,
}: {
  value: PeriodFilterValue
  onChange: (v: PeriodFilterValue) => void
  outlets: { id: string; name: string }[]
}) {
  const setPreset = (p: Preset) => onChange({ ...value, ...presetRange(p) })

  // Determine current active preset based on date range difference
  const activePreset = () => {
    const fromDate = new Date(value.from)
    const toDate = new Date(value.to)
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'today'
    if (diffDays === 7) return '7d'
    if (diffDays === 30) return '30d'
    return null
  }

  const currentPreset = activePreset()

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* 1. Date Range Presets (Segmented control) */}
      <div className="bg-suka-cream p-0.5 rounded-xl border border-suka-brown/5 flex gap-0.5 text-xs font-bold shadow-inner">
        {(['today', '7d', '30d'] as Preset[]).map((p) => {
          const isActive = currentPreset === p
          const label = p === 'today' ? 'Hari ini' : p === '7d' ? '7 Hari' : '30 Hari'
          return (
            <button 
              key={p} 
              onClick={() => setPreset(p)}
              className={`px-3 py-2 rounded-lg transition-all active:scale-95 cursor-pointer ${
                isActive 
                  ? 'bg-suka-orange text-white shadow-sm font-extrabold' 
                  : 'text-suka-brown/60 hover:text-suka-brown'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* 2. Outlet Searchable Dropdown */}
      <OutletCombobox
        value={value.outletId}
        outlets={outlets}
        onChange={(outletId) => onChange({ ...value, outletId: outletId as PeriodFilterValue['outletId'] })}
      />

      {/* 3. Source Select Dropdown */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/50">
          <Globe className="w-4 h-4" />
        </span>
        <select 
          className="pl-9 pr-8 py-2 bg-suka-cream/30 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-xs font-bold text-suka-brown outline-none cursor-pointer appearance-none transition-all"
          value={value.source} 
          onChange={(e) => onChange({ ...value, source: e.target.value as PeriodFilterValue['source'] })}
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s] ?? s}
            </option>
          ))}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-suka-brown/40 pointer-events-none text-[10px]">▼</span>
      </div>
    </div>
  )
}
