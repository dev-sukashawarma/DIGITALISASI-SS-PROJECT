'use client'

import { useOutletScope } from '@/hooks/useOutletScope'

export interface OutletSwitcherProps {
  allowAll?: boolean
  allLabel?: string
  value?: string
  onChange?: (outletId: string) => void
}

export function OutletSwitcher({
  allowAll = false,
  allLabel = 'Semua Outlet',
  value,
  onChange,
}: OutletSwitcherProps = {}) {
  const { boundOutlets, selectedOutletId: ctxOutletId, setSelectedOutletId: ctxSetOutletId, isMultiOutlet } = useOutletScope()

  if (!isMultiOutlet && !allowAll) return null

  const currentId = value !== undefined ? value : (ctxOutletId ?? '')
  const handleChange = (newId: string) => {
    if (onChange) {
      onChange(newId)
    } else {
      ctxSetOutletId(newId)
    }
  }

  return (
    <select
      aria-label="Outlet Binaan"
      value={currentId}
      onChange={(e) => handleChange(e.target.value)}
      className="px-3 py-1.5 bg-white border border-[#d9c2b2]/45 text-[#701604] rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#f29744]"
    >
      {allowAll && <option value="ALL">{allLabel}</option>}
      {boundOutlets.map((outlet) => (
        <option key={outlet.id} value={outlet.id}>
          {outlet.name}
        </option>
      ))}
    </select>
  )
}
