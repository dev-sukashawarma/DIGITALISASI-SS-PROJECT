'use client'
import type { PeriodFilterValue, SalesSource } from '@/lib/types'
import type { Preset } from '@/lib/period'
import { presetRange } from '@/lib/period'

const SOURCES: (SalesSource | 'all')[] = ['all', 'pos', 'online', 'gofood', 'grabfood', 'shopeefood', 'tiktok']

export function PeriodFilter({
  value, onChange, outlets,
}: {
  value: PeriodFilterValue
  onChange: (v: PeriodFilterValue) => void
  outlets: { id: string; name: string }[]
}) {
  const setPreset = (p: Preset) => onChange({ ...value, ...presetRange(p) })
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {(['today', '7d', '30d'] as Preset[]).map((p) => (
        <button key={p} onClick={() => setPreset(p)}
          className="px-3 py-1 rounded border text-sm border-gray-300 hover:bg-gray-50">
          {p === 'today' ? 'Hari ini' : p === '7d' ? '7 hari' : '30 hari'}
        </button>
      ))}
      <select className="px-2 py-1 rounded border text-sm border-gray-300"
        value={value.outletId} onChange={(e) => onChange({ ...value, outletId: e.target.value as PeriodFilterValue['outletId'] })}>
        <option value="all">Semua outlet</option>
        {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select className="px-2 py-1 rounded border text-sm border-gray-300"
        value={value.source} onChange={(e) => onChange({ ...value, source: e.target.value as PeriodFilterValue['source'] })}>
        {SOURCES.map((s) => <option key={s} value={s}>{s === 'all' ? 'Semua sumber' : s}</option>)}
      </select>
    </div>
  )
}
