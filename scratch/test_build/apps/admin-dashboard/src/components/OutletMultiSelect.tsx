'use client'
import type { Outlet } from '@/lib/types'

export function OutletMultiSelect({
  outlets, selected, onChange,
}: {
  outlets: Outlet[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-suka-gray-200 p-2">
      {outlets.map((o) => (
        <label key={o.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
          {o.name}
        </label>
      ))}
    </div>
  )
}
