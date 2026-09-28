'use client'

import { useMemo } from 'react'
import { Select } from '@/components/ui/Select'
import type { Outlet, AttendanceFilterValues } from '@/lib/types'

export function AttendanceFilters({
  value,
  onChange,
  outlets,
}: {
  value: AttendanceFilterValues
  onChange: (v: AttendanceFilterValues) => void
  outlets: Outlet[]
}) {
  const set = (patch: Partial<AttendanceFilterValues>) => onChange({ ...value, ...patch })

  const outletOptions = useMemo(
    () => [
      { label: 'Semua Outlet', value: 'all' },
      ...outlets.map((o) => ({ label: o.name, value: o.id })),
    ],
    [outlets]
  )

  const statusOptions = useMemo(
    () => [
      { label: 'Semua Status', value: 'all' },
      { label: 'Hadir Tepat Waktu', value: 'hadir' },
      { label: 'Terlambat', value: 'terlambat' },
      { label: 'Izin', value: 'izin' },
      { label: 'Sakit', value: 'sakit' },
      { label: 'Cuti', value: 'cuti' },
      { label: 'Alfa', value: 'alfa' },
    ],
    []
  )

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="flex items-center gap-1.5 bg-white border border-suka-gray-200 rounded-xl px-3 py-1.5 shadow-xs text-xs">
        <span className="text-suka-gray-500 font-bold">Dari:</span>
        <input
          type="date"
          className="outline-none font-semibold text-suka-ink bg-transparent"
          value={value.dateFrom}
          onChange={(e) => set({ dateFrom: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-1.5 bg-white border border-suka-gray-200 rounded-xl px-3 py-1.5 shadow-xs text-xs">
        <span className="text-suka-gray-500 font-bold">Sampai:</span>
        <input
          type="date"
          className="outline-none font-semibold text-suka-ink bg-transparent"
          value={value.dateTo}
          onChange={(e) => set({ dateTo: e.target.value })}
        />
      </div>

      {/* Filter Outlet */}
      <Select
        options={outletOptions}
        value={value.outletId}
        onChange={(val) => set({ outletId: val })}
        placeholder="Semua Outlet"
        className="min-w-[140px]"
      />

      {/* Filter Status Kehadiran */}
      <Select
        options={statusOptions}
        value={value.status}
        onChange={(val) => set({ status: val })}
        placeholder="Semua Status"
        className="min-w-[140px]"
      />
    </div>
  )
}
