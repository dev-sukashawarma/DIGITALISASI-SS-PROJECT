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

  return (
    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-suka-gray-200 p-2.5 bg-white">
      {outlets.map((o) => (
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
