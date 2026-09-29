'use client'

import { useMemo } from 'react'
import { CalendarCheck, Search, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { todayWib } from '@/lib/dateIso'
import type { Outlet, AttendanceFilterValues } from '@/lib/types'

export function AttendanceFilters({
  value,
  onChange,
  outlets,
  search,
  onSearchChange,
}: {
  value: AttendanceFilterValues
  onChange: (v: AttendanceFilterValues) => void
  outlets: Outlet[]
  search: string
  onSearchChange: (v: string) => void
}) {
  const set = (patch: Partial<AttendanceFilterValues>) => onChange({ ...value, ...patch })
  const today = todayWib()
  const isToday = value.dateFrom === today && value.dateTo === today

  // Rentang selalu valid: memilih "Dari" melewati "Sampai" (atau sebaliknya) ikut menggeser ujung lainnya.
  const setFrom = (d: string) => set({ dateFrom: d, dateTo: value.dateTo && value.dateTo < d ? d : value.dateTo })
  const setTo = (d: string) => set({ dateTo: d, dateFrom: value.dateFrom && value.dateFrom > d ? d : value.dateFrom })

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
      {/* Cari nama / username */}
      <div className="relative flex items-center w-full sm:w-64">
        <Search size={15} className="absolute left-3 text-suka-gray-400 pointer-events-none" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari nama / username…"
          aria-label="Cari nama atau username karyawan"
          className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-suka-gray-200 rounded-xl shadow-2xs outline-none font-medium text-suka-ink placeholder:text-suka-gray-400 hover:border-suka-orange/60 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20 transition-colors [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Hapus pencarian"
            className="absolute right-1.5 w-7 h-7 flex items-center justify-center rounded-lg text-suka-gray-400 hover:text-suka-ink hover:bg-suka-gray-100 cursor-pointer transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter cepat: hari ini */}
      <button
        type="button"
        onClick={() => set({ dateFrom: today, dateTo: today })}
        aria-pressed={isToday}
        className={`inline-flex items-center gap-1.5 py-2 px-3 rounded-xl border text-xs sm:text-sm font-bold shadow-2xs cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-suka-orange/30 ${
          isToday
            ? 'bg-suka-orange border-suka-orange text-white'
            : 'bg-white border-suka-gray-200 text-suka-brown hover:border-suka-orange/60 hover:bg-suka-cream'
        }`}
      >
        <CalendarCheck size={15} aria-hidden /> Hari ini
      </button>

      <DatePicker label="Dari" value={value.dateFrom} onChange={setFrom} rangeFrom={value.dateFrom} rangeTo={value.dateTo} />
      <DatePicker label="Sampai" value={value.dateTo} onChange={setTo} rangeFrom={value.dateFrom} rangeTo={value.dateTo} align="right" />

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
