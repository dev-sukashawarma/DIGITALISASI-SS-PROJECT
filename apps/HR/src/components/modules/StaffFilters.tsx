'use client'

import type { Outlet, StaffFilterValues } from '@/lib/types'

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

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        className={`${inputCls} min-w-[200px]`}
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
    </div>
  )
}
