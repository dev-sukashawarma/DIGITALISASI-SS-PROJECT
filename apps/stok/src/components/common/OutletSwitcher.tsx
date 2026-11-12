'use client'

import { Select } from '@suka/design-system'
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

  const options = [
    ...(allowAll ? [{ value: 'ALL', label: allLabel }] : []),
    ...boundOutlets.map((outlet) => ({
      value: outlet.id,
      label: outlet.name,
    })),
  ]

  return (
    <Select
      size="sm"
      aria-label="Outlet Binaan"
      value={currentId}
      onChange={handleChange}
      options={options}
      searchPlaceholder="Cari outlet..."
      className="min-w-[170px] max-w-[260px]"
      triggerClassName="border-[#d9c2b2]/45 uppercase tracking-wider shadow-sm"
    />
  )
}
