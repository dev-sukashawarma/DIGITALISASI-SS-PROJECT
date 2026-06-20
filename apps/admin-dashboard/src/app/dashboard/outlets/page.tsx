'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { useOutlets } from '@/hooks/useOutlets'
import { useOutletMutations } from '@/hooks/useOutletMutations'
import { filterOutlets } from '@/lib/filterOutlets'
import { OutletFilters } from '@/components/OutletFilters'
import { OutletTable } from '@/components/OutletTable'
import { OutletForm } from '@/components/OutletForm'
import { DeleteOutletDialog } from '@/components/DeleteOutletDialog'
import type { Outlet, OutletFilterValues, OutletFormValues } from '@/lib/types'

export const dynamic = 'force-dynamic'

const EMPTY_FILTER: OutletFilterValues = { search: '', status: '' }

function toFormValues(o: Outlet): OutletFormValues {
  return {
    name: o.name, slug: o.slug, address: o.address ?? '',
    lat: o.lat, lng: o.lng, type: o.type, is_active: o.is_active,
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
        <h2 className="text-xl font-bold text-suka-ink">Master Outlet</h2>
        <Button onClick={() => { setEditing(null); setShowForm((v) => !v) }} className="flex items-center gap-2 rounded-xl">
          <Plus size={18} /> Tambah Outlet
        </Button>
      </div>

      {showForm && !editing && (
        <div className="rounded-2xl border-2 border-suka-orange/40 bg-white p-4 sm:p-6">
          <h3 className="mb-4 font-bold text-suka-ink">Outlet Baru</h3>
          <OutletForm isEdit={false} submitting={create.isPending} onSubmit={handleCreate} />
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border-2 border-blue-300 bg-white p-4 sm:p-6">
          <h3 className="mb-4 font-bold text-suka-ink">Edit — {editing.name}</h3>
          <OutletForm isEdit submitting={update.isPending} onSubmit={handleUpdate} initial={toFormValues(editing)} />
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
