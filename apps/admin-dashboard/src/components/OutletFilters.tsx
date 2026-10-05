'use client'
import { Search, X } from 'lucide-react'
import type { OutletFilterValues } from '@/lib/types'
import { TIPE_OUTLET, LABEL_TIPE_OUTLET } from '@/lib/outletType'

export function OutletFilters({
  value, onChange, totalCount, filteredCount,
}: {
  value: OutletFilterValues
  onChange: (v: OutletFilterValues) => void
  totalCount?: number
  filteredCount?: number
}) {
  const set = (patch: Partial<OutletFilterValues>) => onChange({ ...value, ...patch })
  const hasActiveFilters = Boolean(value.search || value.status || (value.type && value.type !== 'all'))

  const resetFilters = () => onChange({ search: '', status: '', type: '' })

  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200/80 p-3.5 sm:p-4 shadow-xs space-y-3">
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search input with icons */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-suka-gray-400 pointer-events-none" />
          <input
            type="text"
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-suka-gray-200 text-sm text-suka-ink placeholder:text-suka-gray-400 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 transition-all bg-suka-gray-50/50 hover:bg-white"
            placeholder="Cari nama outlet, slug, atau alamat..."
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
          />
          {value.search && (
            <button
              type="button"
              onClick={() => set({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-suka-gray-400 hover:text-suka-ink rounded-lg"
              title="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter controls row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="inline-flex rounded-xl bg-suka-gray-100 p-1 border border-suka-gray-200/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => set({ status: '' })}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                !value.status
                  ? 'bg-white text-suka-ink shadow-xs font-bold'
                  : 'text-suka-gray-500 hover:text-suka-ink'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => set({ status: 'active' })}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                value.status === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-suka-gray-500 hover:text-suka-ink'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${value.status === 'active' ? 'bg-white' : 'bg-emerald-500'}`} />
              Aktif
            </button>
            <button
              type="button"
              onClick={() => set({ status: 'pending' })}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                value.status === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-suka-gray-500 hover:text-suka-ink'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${value.status === 'pending' ? 'bg-white' : 'bg-amber-500'}`} />
              Pending
            </button>
            <button
              type="button"
              onClick={() => set({ status: 'inactive' })}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                value.status === 'inactive'
                  ? 'bg-gray-700 text-white shadow-xs font-bold'
                  : 'text-suka-gray-500 hover:text-suka-ink'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${value.status === 'inactive' ? 'bg-white' : 'bg-gray-400'}`} />
              Nonaktif
            </button>
          </div>

          {/* Type filter */}
          <div className="inline-flex rounded-xl bg-suka-gray-100 p-1 border border-suka-gray-200/60 text-xs font-semibold">
            {[{ id: 'all', label: 'Semua Tipe' }, ...TIPE_OUTLET.map((t) => ({ id: t, label: LABEL_TIPE_OUTLET[t] }))].map((opt) => {
              const aktif = (value.type || 'all') === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => set({ type: opt.id })}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    aktif ? 'bg-white text-suka-ink shadow-xs font-bold' : 'text-suka-gray-500 hover:text-suka-ink'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Reset button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-suka-orange hover:bg-orange-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Summary indicator */}
      {typeof totalCount === 'number' && typeof filteredCount === 'number' && (
        <div className="flex items-center justify-between text-xs text-suka-gray-500 pt-1 border-t border-suka-gray-100">
          <span>
            Menampilkan <strong className="text-suka-ink">{filteredCount}</strong> dari{' '}
            <strong className="text-suka-ink">{totalCount}</strong> outlet
          </span>
          {value.status === 'missing_coords' && (
            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-semibold text-[11px]">
              Menampilkan outlet yang belum memiliki koordinat GPS
            </span>
          )}
        </div>
      )}
    </div>
  )
}
