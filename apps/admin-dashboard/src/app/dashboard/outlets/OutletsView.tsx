// @ts-nocheck
'use client'
import { useMemo, useState } from 'react'
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
    open_hour: o.open_hour ?? '', close_hour: o.close_hour ?? ''
  }
}

export default function OutletsPage() {
  const { data: outlets = [], isLoading } = useOutlets()
  const { create, update, softDelete, hardDelete, countRefs } = useOutletMutations()

  const [filter, setFilter] = useState<OutletFilterValues>(EMPTY_FILTER)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Outlet | null>(null)
  const [deleting, setDeleting] = useState<Outlet | null>(null)

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

      {(showForm || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-suka-gray-100 p-4 sm:p-6 bg-suka-cream/30">
              <h3 className="text-xl font-bold text-suka-ink">
                {editing ? `Edit — ${editing.name}` : 'Outlet Baru'}
              </h3>
              <button 
                onClick={() => { setShowForm(false); setEditing(null) }}
                className="p-2 -mr-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
        </div>
      )}

      <OutletFilters value={filter} onChange={setFilter} />

      <OutletTable
        rows={rows}
        onEdit={(o) => { setShowForm(false); setEditing(o) }}
        onToggleActive={handleToggleActive}
        onDelete={(o) => setDeleting(o)}
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

