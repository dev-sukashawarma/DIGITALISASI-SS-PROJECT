'use client'

import { useMemo } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import type { Outlet, StaffFilterValues, StaffSortKey, SortOrder } from '@/lib/types'

const ROLES = [
  'admin',
  'admin_hr',
  'admin_finance',
  'area_manager',
  'crew',
  'developer',
  'driver',
  'kiosk',
  'kitchen',
  'korlap',
  'leader',
  'mitra',
  'owner',
  'purchasing',
  'regional_manager',
  'spv',
  'staff_pusat',
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
  { id: 'flag_asc', label: 'Flag Status', key: 'flag_status', order: 'asc' },
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

  const outletOptions = useMemo(
    () => [
      { label: 'Semua Outlet', value: '' },
      ...outlets.map((o) => ({ label: o.name, value: o.id })),
    ],
    [outlets]
  )

  const roleOptions = useMemo(
    () => [
      { label: 'Semua Role', value: '' },
      ...ROLES.map((r) => ({
        label: r.replace(/_/g, ' ').toUpperCase(),
        value: r,
      })),
    ],
    []
  )

  const subRoleOptions = useMemo(
    () => [
      { label: 'Semua Sub-Role', value: '' },
      { label: 'Crew Reguler', value: 'crew_regular' },
      { label: 'Crew Backup', value: 'crew_backup' },
      { label: 'Trainee', value: 'crew_trainee' },
    ],
    []
  )

  const stageOptions = useMemo(
    () => [
      { label: 'Semua Flag Status', value: '' },
      { label: 'Training (7 Hari)', value: 'training_7_days' },
      { label: 'Masa OJT', value: 'ojt' },
      { label: 'Lulus PKWT', value: 'graduated' },
      { label: 'Karyawan Reguler', value: 'regular' },
      { label: 'Tidak Lolos (Gugur)', value: 'failed' },
    ],
    []
  )

  const statusOptions = useMemo(
    () => [
      { label: 'Semua Status', value: '' },
      { label: 'Aktif', value: 'active' },
      { label: 'Nonaktif', value: 'inactive' },
      { label: 'Cuti', value: 'on_leave' },
    ],
    []
  )

  const categoryOptions = useMemo(
    () => [
      { label: 'Semua Kategori', value: 'all' },
      { label: 'Karyawan Saja', value: 'employee' },
      { label: 'Bot / AI', value: 'system_bot' },
      { label: 'Kiosk / Perangkat', value: 'kiosk' },
      { label: 'Mitra Owner', value: 'mitra_owner' },
      { label: 'Akun Testing', value: 'testing' },
    ],
    []
  )

  const sortOptions = useMemo(
    () =>
      SORT_OPTIONS.map((opt) => ({
        label: opt.label,
        value: opt.id,
      })),
    []
  )

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        className={`${inputCls} min-w-[180px] sm:min-w-[220px]`}
        placeholder="Cari nama / username..."
        value={value.search}
        onChange={(e) => set({ search: e.target.value })}
      />

      {/* Filter Outlet */}
      <Select
        options={outletOptions}
        value={value.outletId}
        onChange={(val) => set({ outletId: val })}
        placeholder="Semua Outlet"
        className="min-w-[140px]"
      />

      {/* Filter Role */}
      <Select
        options={roleOptions}
        value={value.role}
        onChange={(val) => set({ role: val })}
        placeholder="Semua Role"
        className="min-w-[130px]"
      />

      {/* Filter Sub-Role */}
      <Select
        options={subRoleOptions}
        value={value.subRole || ''}
        onChange={(val) => set({ subRole: val })}
        placeholder="Semua Sub-Role"
        className="min-w-[140px]"
      />

      {/* Filter Flag Status */}
      <Select
        options={stageOptions}
        value={value.onboardingStage || ''}
        onChange={(val) => set({ onboardingStage: val })}
        placeholder="Semua Flag Status"
        className="min-w-[150px]"
      />

      {/* Filter Status */}
      <Select
        options={statusOptions}
        value={value.status}
        onChange={(val) => set({ status: val })}
        placeholder="Semua Status"
        className="min-w-[120px]"
      />

      {/* Filter Kategori Akun */}
      <Select
        options={categoryOptions}
        value={value.category ?? 'all'}
        onChange={(val) => set({ category: val })}
        placeholder="Semua Kategori"
        className="min-w-[140px]"
      />

      {/* Sort Selector Dropdown */}
      <div className="flex items-center gap-1.5 bg-stone-50 border border-suka-gray-200 rounded-xl px-1.5 py-0.5 shadow-xs">
        <ArrowUpDown size={14} className="text-suka-orange shrink-0 ml-1.5" />
        <Select
          options={sortOptions}
          value={currentSortId}
          onChange={handleSortChange}
          placeholder="Urutkan Karyawan"
          buttonClassName="border-0 bg-transparent shadow-none px-1.5 py-1 text-xs sm:text-sm font-semibold"
          className="min-w-[170px]"
        />
      </div>
    </div>
  )
}
