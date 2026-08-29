'use client'

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
  const inputCls =
    'rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-suka-orange bg-white text-suka-ink shadow-xs'

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

      <select
        className={inputCls}
        value={value.outletId}
        onChange={(e) => set({ outletId: e.target.value })}
      >
        <option value="all">Semua Outlet</option>
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <select
        className={inputCls}
        value={value.status}
        onChange={(e) => set({ status: e.target.value })}
      >
        <option value="all">Semua Status</option>
        <option value="hadir">Hadir Tepat Waktu</option>
        <option value="terlambat">Terlambat</option>
        <option value="izin">Izin</option>
        <option value="sakit">Sakit</option>
        <option value="cuti">Cuti</option>
        <option value="alfa">Alfa</option>
      </select>
    </div>
  )
}
