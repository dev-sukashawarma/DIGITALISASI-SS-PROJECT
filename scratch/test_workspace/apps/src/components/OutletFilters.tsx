'use client'
import type { OutletFilterValues } from '@/lib/types'

export function OutletFilters({
  value, onChange,
}: {
  value: OutletFilterValues
  onChange: (v: OutletFilterValues) => void
}) {
  const set = (patch: Partial<OutletFilterValues>) => onChange({ ...value, ...patch })
  const inputCls = 'rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange'
  return (
    <div className="flex flex-wrap gap-2">
      <input className={inputCls} placeholder="Cari nama / slug"
        value={value.search} onChange={(e) => set({ search: e.target.value })} />
      <select className={inputCls} value={value.status} onChange={(e) => set({ status: e.target.value })}>
        <option value="">Semua Status</option>
        <option value="active">Aktif</option>
        <option value="inactive">Nonaktif</option>
      </select>
    </div>
  )
}
