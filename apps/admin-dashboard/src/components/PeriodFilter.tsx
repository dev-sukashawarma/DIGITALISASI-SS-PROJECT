'use client'
import type { PeriodFilterValue, SalesSource } from '@/lib/types'
import type { Preset } from '@/lib/period'
import { presetRange } from '@/lib/period'
import { Store, Globe } from 'lucide-react'

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

      {/* 2. Outlet Select Dropdown */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/50">
          <Store className="w-4 h-4" />
        </span>
        <select 
          className="pl-9 pr-8 py-2 bg-suka-cream/30 border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 rounded-xl text-xs font-bold text-suka-brown outline-none cursor-pointer appearance-none transition-all"
          value={value.outletId} 
          onChange={(e) => onChange({ ...value, outletId: e.target.value as PeriodFilterValue['outletId'] })}
        >
          <option value="all">Semua Outlet</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')}
            </option>
          ))}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-suka-brown/40 pointer-events-none text-[10px]">▼</span>
      </div>

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
