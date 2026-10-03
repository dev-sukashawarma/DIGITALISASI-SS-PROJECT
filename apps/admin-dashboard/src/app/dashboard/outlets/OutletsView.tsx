'use client'

import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import {
  Plus,
  X,
  Store,
  CheckCircle2,
  Users,
  AlertTriangle,
  MapPinOff,
} from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { useOutlets } from '@/hooks/useOutlets'
import { useOutletMutations } from '@/hooks/useOutletMutations'
import { filterOutlets } from '@/lib/filterOutlets'
import { OutletFilters } from '@/components/OutletFilters'
import { OutletTable } from '@/components/OutletTable'
import { OutletForm } from '@/components/OutletForm'
import { DeleteOutletDialog } from '@/components/DeleteOutletDialog'
import type { Outlet, OutletFilterValues, OutletFormValues } from '@/lib/types'

const EMPTY_FILTER: OutletFilterValues = { search: '', status: '', type: 'all' }

function toFormValues(o: Outlet): OutletFormValues {
  return {
    name: o.name,
    slug: o.slug,
    address: o.address ?? '',
    lat: o.lat,
    lng: o.lng,
    type: o.type,
    is_active: o.is_active,
    marquee_warning_threshold: o.marquee_warning_threshold,
    open_hour: o.open_hour ? o.open_hour.slice(0, 5) : '14:00',
    close_hour: o.close_hour ? o.close_hour.slice(0, 5) : '22:00',
  }
}

export default function OutletsPage() {
  const { data: outlets = [], isLoading } = useOutlets()
  const { create, update, softDelete, hardDelete, countRefs } = useOutletMutations()

  const [mounted, setMounted] = useState(false)
  const [filter, setFilter] = useState<OutletFilterValues>(EMPTY_FILTER)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Outlet | null>(null)
  const [deleting, setDeleting] = useState<Outlet | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const rows = useMemo(() => filterOutlets(outlets, filter), [outlets, filter])

  const stats = useMemo(() => {
    const total = outlets.length
    const active = outlets.filter((o) => o.is_active).length
    const inactive = total - active
    const mitra = outlets.filter((o) => o.type === 'mitra').length
    const missingCoords = outlets.filter(
      (o) => !Number.isFinite(o.lat) || !Number.isFinite(o.lng) || (o.lat === 0 && o.lng === 0)
    ).length

    return { total, active, inactive, mitra, missingCoords }
  }, [outlets])

  function handleCreate(values: OutletFormValues) {
    create.mutate(values, {
      onSuccess: () => {
        toast.success(`Outlet ${values.name} dibuat`)
        setShowForm(false)
      },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleUpdate(values: OutletFormValues) {
    if (!editing) return
    update.mutate(
      { id: editing.id, ...values },
      {
        onSuccess: () => {
          toast.success('Perubahan disimpan')
          setEditing(null)
        },
        onError: (e: any) => toast.error(e.message),
      }
    )
  }

  function handleToggleActive(o: Outlet) {
    if (o.is_active) {
      softDelete.mutate(o.id, {
        onSuccess: () => toast.success(`${o.name} dinonaktifkan`),
        onError: (e: any) => toast.error(e.message),
      })
    } else {
      update.mutate(
        { id: o.id, ...toFormValues(o), is_active: true },
        {
          onSuccess: () => toast.success(`${o.name} diaktifkan`),
          onError: (e: any) => toast.error(e.message),
        }
      )
    }
  }

  function handleSoftDelete() {
    if (!deleting) return
    softDelete.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`${deleting.name} dinonaktifkan`)
        setDeleting(null)
      },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleHardDelete() {
    if (!deleting) return
    hardDelete.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`${deleting.name} dihapus permanen`)
        setDeleting(null)
      },
      onError: (e: any) => toast.error(e.message),
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[300px] text-suka-gray-500">
        <Spinner />
        <p className="mt-3 text-xs font-medium">Memuat data outlet...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-suka-orange to-amber-600 flex items-center justify-center text-white shadow-sm shadow-orange-500/20 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-suka-ink tracking-tight">Manajemen Outlet</h1>
            <p className="text-xs sm:text-sm text-suka-gray-500">
              Kelola cabang, koordinat GPS presensi, dan jam operasional outlet
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            setEditing(null)
            setShowForm((v) => !v)
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-suka-orange hover:bg-orange-600 text-white font-bold px-4 py-2.5 shadow-sm shadow-orange-500/20 transition-all min-h-[44px]"
        >
          <Plus size={18} /> Tambah Outlet
        </Button>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Outlet */}
        <button
          type="button"
          onClick={() => setFilter((prev) => ({ ...prev, status: '', type: 'all' }))}
          className={`text-left p-4 rounded-2xl border transition-all ${
            !filter.status && (!filter.type || filter.type === 'all')
              ? 'bg-gradient-to-br from-orange-50/60 to-white border-suka-orange shadow-xs ring-2 ring-suka-orange/20'
              : 'bg-white border-suka-gray-200/80 hover:border-suka-orange/50 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-suka-gray-500 uppercase tracking-wider">Total Outlet</span>
            <div className="w-8 h-8 rounded-xl bg-orange-100/70 text-suka-orange flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-suka-ink">{stats.total}</span>
            <span className="text-xs text-suka-gray-500 font-medium">cabang</span>
          </div>
          <p className="mt-1 text-[11px] text-suka-gray-500 truncate">
            {stats.active} aktif • {stats.inactive} nonaktif
          </p>
        </button>

        {/* Card 2: Outlet Aktif */}
        <button
          type="button"
          onClick={() =>
            setFilter((prev) => ({
              ...prev,
              status: prev.status === 'active' ? '' : 'active',
            }))
          }
          className={`text-left p-4 rounded-2xl border transition-all ${
            filter.status === 'active'
              ? 'bg-gradient-to-br from-emerald-50/60 to-white border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
              : 'bg-white border-suka-gray-200/80 hover:border-emerald-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-suka-gray-500 uppercase tracking-wider">Outlet Aktif</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-700">{stats.active}</span>
            <span className="text-xs text-emerald-600/80 font-medium">beroperasi</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-600 truncate font-medium">
            Melayani pesanan & presensi
          </p>
        </button>

        {/* Card 3: Mitra SS */}
        <button
          type="button"
          onClick={() =>
            setFilter((prev) => ({
              ...prev,
              type: prev.type === 'mitra' ? 'all' : 'mitra',
            }))
          }
          className={`text-left p-4 rounded-2xl border transition-all ${
            filter.type === 'mitra'
              ? 'bg-gradient-to-br from-cyan-50/60 to-white border-cyan-500 shadow-xs ring-2 ring-cyan-500/20'
              : 'bg-white border-suka-gray-200/80 hover:border-cyan-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-suka-gray-500 uppercase tracking-wider">Mitra SS</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-100/70 text-cyan-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-cyan-800">{stats.mitra}</span>
            <span className="text-xs text-cyan-600 font-medium">kemitraan</span>
          </div>
          <p className="mt-1 text-[11px] text-cyan-700 truncate font-medium">
            Skema bagi hasil & investor
          </p>
        </button>

        {/* Card 4: Titik Belum Disetel */}
        <button
          type="button"
          onClick={() =>
            setFilter((prev) => ({
              ...prev,
              status: prev.status === 'missing_coords' ? '' : 'missing_coords',
            }))
          }
          className={`text-left p-4 rounded-2xl border transition-all ${
            filter.status === 'missing_coords'
              ? 'bg-gradient-to-br from-amber-50/70 to-white border-amber-500 shadow-xs ring-2 ring-amber-500/20'
              : 'bg-white border-suka-gray-200/80 hover:border-amber-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-suka-gray-500 uppercase tracking-wider">Perlu Titik GPS</span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                stats.missingCoords > 0 ? 'bg-amber-100 text-amber-700' : 'bg-suka-gray-100 text-suka-gray-500'
              }`}
            >
              {stats.missingCoords > 0 ? <AlertTriangle className="w-4 h-4" /> : <MapPinOff className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-black ${
                stats.missingCoords > 0 ? 'text-amber-700' : 'text-suka-ink'
              }`}
            >
              {stats.missingCoords}
            </span>
            <span className="text-xs text-suka-gray-500 font-medium">outlet</span>
          </div>
          <p
            className={`mt-1 text-[11px] truncate font-medium ${
              stats.missingCoords > 0 ? 'text-amber-700 font-semibold' : 'text-emerald-600'
            }`}
          >
            {stats.missingCoords > 0 ? 'Perlu koordinat untuk presensi' : 'Semua titik GPS sudah lengkap'}
          </p>
        </button>
      </div>

      {/* ── Filters Bar ── */}
      <OutletFilters
        value={filter}
        onChange={setFilter}
        totalCount={outlets.length}
        filteredCount={rows.length}
      />

      {/* ── Outlet Table & Mobile Cards ── */}
      <OutletTable
        rows={rows}
        onEdit={(o) => {
          setShowForm(false)
          setEditing(o)
        }}
        onToggleActive={handleToggleActive}
        onDelete={setDeleting}
        onResetFilter={() => setFilter(EMPTY_FILTER)}
      />

      {/* ── Outlet Form Modal (Responsive Bottom Sheet on Mobile) ── */}
      {mounted && (showForm || editing) &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center items-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 lg:p-6 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowForm(false)
                setEditing(null)
              }
            }}
          >
            <div className="w-full max-w-2xl bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl flex flex-col h-[94dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden border border-suka-gray-100 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
              {/* Grab handle indicator for mobile bottom sheet */}
              <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-suka-cream/30 shrink-0">
                <div className="w-10 h-1 bg-suka-gray-300 rounded-full" />
              </div>

              <div className="flex items-center justify-between border-b border-suka-gray-100 px-4 py-3 sm:px-6 sm:py-4 bg-suka-cream/30 shrink-0">
                <h3 className="text-lg sm:text-xl font-bold text-suka-ink">
                  {editing ? `Edit — ${editing.name}` : 'Outlet Baru'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditing(null)
                  }}
                  className="p-2 -mr-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                  aria-label="Tutup"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
                {editing ? (
                  <OutletForm
                    isEdit
                    submitting={update.isPending}
                    onSubmit={handleUpdate}
                    initial={toFormValues(editing)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <OutletForm
                    isEdit={false}
                    submitting={create.isPending}
                    onSubmit={handleCreate}
                    onCancel={() => setShowForm(false)}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleting && (
        <DeleteOutletDialog
          outlet={deleting}
          countRefs={countRefs}
          onSoftDelete={handleSoftDelete}
          onHardDelete={handleHardDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
