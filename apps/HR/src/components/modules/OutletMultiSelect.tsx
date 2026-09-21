'use client'

import type { Outlet } from '@/lib/types'

export function OutletMultiSelect({
  outlets,
  selected,
  onChange,
}: {
  outlets: Outlet[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  const validOutlets = outlets
    .filter((o) => {
      if (o.id === '00000000-0000-0000-0000-000000000000') return false
      if (o.name.toUpperCase() === 'SS BACKUP') return false
      if (o.name.toLowerCase().includes('tes') || o.name.toLowerCase().includes('test')) return false
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-suka-gray-200 p-2.5 bg-white">
      {validOutlets.map((o) => (
        <label key={o.id} className="flex items-center gap-2 text-xs font-semibold text-suka-ink cursor-pointer hover:bg-suka-cream/40 p-1.5 rounded-lg">
          <input
            type="checkbox"
            className="w-4 h-4 rounded text-suka-orange focus:ring-suka-orange cursor-pointer"
            checked={selected.includes(o.id)}
            onChange={() => toggle(o.id)}
          />
          <span className="truncate">{o.name}</span>
        </label>
      ))}
    </div>
  )
}
