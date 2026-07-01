'use client'

import { RotateCcw } from 'lucide-react'
import { useOutlets } from '@/hooks/useOutlets'
import type { AttendanceFilterValues, AttendanceStatus } from '@/lib/types'

const STATUSES: { value: AttendanceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua Status' },
  { value: 'hadir', label: 'Hadir' },
  { value: 'terlambat', label: 'Terlambat' },
  { value: 'izin', label: 'Izin' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'alfa', label: 'Alfa' },
  { value: 'cuti', label: 'Cuti' },
  { value: 'libur', label: 'Libur' },
]

interface Props {
  value: AttendanceFilterValues
  onChange: (v: AttendanceFilterValues) => void
  defaultValue: AttendanceFilterValues
}

export function AttendanceFilters({ value, onChange, defaultValue }: Props) {
  const { data: outlets = [] } = useOutlets()

  const set = (patch: Partial<AttendanceFilterValues>) =>
    onChange({ ...value, ...patch })

  const inputCls =
    'rounded-xl border border-suka-gray-200 px-3 py-2.5 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink'

  const isDefault =
    value.dateFrom === defaultValue.dateFrom &&
    value.dateTo === defaultValue.dateTo &&
    value.outletId === defaultValue.outletId &&
    value.status === defaultValue.status

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Date From */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-suka-ink">
          Dari
        </label>
        <input
          type="date"
          className={inputCls}
          value={value.dateFrom}
          onChange={(e) => set({ dateFrom: e.target.value })}
        />
      </div>

      {/* Date To */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-suka-ink">
          Sampai
        </label>
        <input
          type="date"
          className={inputCls}
          value={value.dateTo}
          onChange={(e) => set({ dateTo: e.target.value })}
        />
      </div>

      {/* Outlet */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-suka-ink">
          Outlet
        </label>
        <select
          className={inputCls}
          value={value.outletId}
          onChange={(e) => set({ outletId: e.target.value })}
        >
          <option value="">Semua Outlet</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-suka-ink">
          Status
        </label>
        <select
          className={inputCls}
          value={value.status}
          onChange={(e) => set({ status: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Reset */}
      {!isDefault && (
        <button
          type="button"
          onClick={() => onChange(defaultValue)}
          className="flex items-center gap-1.5 rounded-xl border border-suka-gray-200 bg-white px-3 py-2.5 text-sm text-suka-gray-500 transition-colors hover:bg-suka-gray-50 hover:text-suka-ink"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      )}
    </div>
  )
}
