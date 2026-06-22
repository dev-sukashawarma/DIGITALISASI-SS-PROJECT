'use client'

import { useOutletScope } from '@/hooks/useOutletScope'

export function OutletSwitcher() {
  const { boundOutlets, selectedOutletId, setSelectedOutletId, isMultiOutlet } = useOutletScope()

  if (!isMultiOutlet) return null

  return (
    <select
      aria-label="Outlet Binaan"
      value={selectedOutletId ?? ''}
      onChange={(e) => setSelectedOutletId(e.target.value)}
      className="px-3 py-1.5 bg-white border border-[#d9c2b2]/45 text-[#701604] rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#f29744]"
    >
      {boundOutlets.map((outlet) => (
        <option key={outlet.id} value={outlet.id}>
          {outlet.name}
        </option>
      ))}
    </select>
  )
}
