'use client'

import { ArrowUpDown } from 'lucide-react'
import type { Outlet, StaffFilterValues, StaffSortKey, SortOrder } from '@/lib/types'

const ROLES = [
  'admin',
  'admin_hr',
  'owner',
  'spv',
  'regional_manager',
  'kitchen',
  'leader',
  'crew',
  'mitra',
  'staff_pusat',
  'admin_finance',
  'area_manager',
  'purchasing',
]

const SORT_OPTIONS: { id: string; label: string; key: StaffSortKey; order: SortOrder }[] = [
  { id: 'name_asc', label: 'Nama (A - Z)', key: 'name', order: 'asc' },
  { id: 'name_desc', label: 'Nama (Z - A)', key: 'name', order: 'desc' },
  { id: 'salary_desc', label: 'Gaji Pokok (Tertinggi)', key: 'salary', order: 'desc' },
  { id: 'salary_asc', label: 'Gaji Pokok (Terendah)', key: 'salary', order: 'asc' },
  { id: 'outlet_asc', label: 'Outlet (A - Z)', key: 'outlet', order: 'asc' },
  { id: 'role_asc', label: 'Jabatan / Role', key: 'role', order: 'asc' },
  { id: 'date_desc', label: 'Tanggal Masuk (Terbaru)', key: 'date', order: 'desc' },
  { id: 'date_asc', label: 'Tanggal Masuk (Terlama)', key: 'date', order: 'asc' },
]

export function StaffFilters({
  value,
  onChange,
  outlets,
}: {
  value: StaffFilterValues
  onChange: (v: StaffFilterValues) => void
  outlets: Outlet[]
}) {
  const set = (patch: Partial<StaffFilterValues>) => onChange({ ...value, ...patch })
  const inputCls =
    'rounded-xl border border-suka-gray-200 px-3 py-2 text-xs sm:text-sm font-medium outline-none focus:border-suka-orange bg-white text-suka-ink shadow-xs'

  const currentSortId = `${value.sortBy || 'name'}_${value.sortOrder || 'asc'}`

  const handleSortChange = (sortId: string) => {
    const selected = SORT_OPTIONS.find((s) => s.id === sortId)
    if (selected) {
      set({ sortBy: selected.key, sortOrder: selected.order })
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        className={`${inputCls} min-w-[180px] sm:min-w-[220px]`}
        placeholder="Cari nama / username..."
        value={value.search}
        onChange={(e) => set({ search: e.target.value })}
      />
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
      <select
        className={inputCls}
        value={value.role}
        onChange={(e) => set({ role: e.target.value })}
      >
        <option value="">Semua Role</option>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r.replace('_', ' ').toUpperCase()}
          </option>
        ))}
      </select>
      <select
        className={inputCls}
        value={value.status}
        onChange={(e) => set({ status: e.target.value })}
      >
        <option value="">Semua Status</option>
        <option value="active">Aktif</option>
        <option value="inactive">Nonaktif</option>
        <option value="on_leave">Cuti</option>
      </select>

      {/* Sort Selector Dropdown */}
      <div className="flex items-center gap-1.5 bg-stone-50 border border-suka-gray-200 rounded-xl px-2.5 py-1.5 shadow-xs">
        <ArrowUpDown size={14} className="text-suka-orange shrink-0" />
        <select
          aria-label="Urutkan Karyawan"
          className="bg-transparent text-xs sm:text-sm font-semibold text-suka-ink outline-none cursor-pointer"
          value={currentSortId}
          onChange={(e) => handleSortChange(e.target.value)}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
