// @ts-nocheck
'use client'
import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { useOutlets } from '@/hooks/useOutlets'
import { useOutletMutations } from '@/hooks/useOutletMutations'
import { filterOutlets } from '@/lib/filterOutlets'
import { OutletFilters } from '@/components/OutletFilters'
import { OutletTable } from '@/components/OutletTable'
import { OutletForm } from '@/components/OutletForm'
import { DeleteOutletDialog } from '@/components/DeleteOutletDialog'
import type { Outlet, OutletFilterValues, OutletFormValues } from '@/lib/types'

const EMPTY_FILTER: OutletFilterValues = { search: '', status: '' }

function toFormValues(o: Outlet): OutletFormValues {
  return {
    name: o.name, slug: o.slug, address: o.address ?? '',
    lat: o.lat, lng: o.lng, type: o.type, is_active: o.is_active,
    marquee_warning_threshold: o.marquee_warning_threshold,
    open_hour: o.open_hour ? o.open_hour.slice(0, 5) : '14:00',
    close_hour: o.close_hour ? o.close_hour.slice(0, 5) : '22:00'
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

  function handleCreate(values: OutletFormValues) {
    create.mutate(values, {
      onSuccess: () => { toast.success(`Outlet ${values.name} dibuat`); setShowForm(false) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleUpdate(values: OutletFormValues) {
    if (!editing) return
    update.mutate({ id: editing.id, ...values }, {
      onSuccess: () => { toast.success('Perubahan disimpan'); setEditing(null) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleToggleActive(o: Outlet) {
    if (o.is_active) {
      softDelete.mutate(o.id, {
        onSuccess: () => toast.success(`${o.name} dinonaktifkan`),
        onError: (e: any) => toast.error(e.message),
      })
    } else {
      update.mutate({ id: o.id, ...toFormValues(o), is_active: true }, {
        onSuccess: () => toast.success(`${o.name} diaktifkan`),
        onError: (e: any) => toast.error(e.message),
      })
    }
  }

  function handleSoftDelete() {
    if (!deleting) return
    softDelete.mutate(deleting.id, {
      onSuccess: () => { toast.success(`${deleting.name} dinonaktifkan`); setDeleting(null) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleHardDelete() {
    if (!deleting) return
    hardDelete.mutate(deleting.id, {
      onSuccess: () => { toast.success(`${deleting.name} dihapus permanen`); setDeleting(null) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  if (isLoading) return <div className="flex justify-center p-8"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Manajemen Outlet</h2>
        <Button onClick={() => { setEditing(null); setShowForm((v) => !v) }} className="flex items-center gap-2 rounded-xl">
          <Plus size={18} /> Tambah Outlet
        </Button>
      </div>

      {mounted && (showForm || editing) && createPortal(
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
                onClick={() => { setShowForm(false); setEditing(null) }}
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

      <OutletFilters value={filter} onChange={setFilter} />

      <OutletTable
        rows={rows}
        onEdit={(o) => { setShowForm(false); setEditing(o) }}
        onToggleActive={handleToggleActive}
        onDelete={setDeleting}
      />

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

