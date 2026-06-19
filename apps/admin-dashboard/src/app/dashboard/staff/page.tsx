'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { useStaff } from '@/hooks/useStaff'
import { useOutlets } from '@/hooks/useOutlets'
import { useStaffMutations } from '@/hooks/useStaffMutations'
import { filterStaff } from '@/lib/filterStaff'
import { StaffFilters } from '@/components/StaffFilters'
import { StaffTable } from '@/components/StaffTable'
import { StaffForm } from '@/components/StaffForm'
import { ResetPasswordDialog } from '@/components/ResetPasswordDialog'
import type { StaffRow, StaffFilterValues, StaffStatus, StaffFormValues } from '@/lib/types'

export const dynamic = 'force-dynamic'

const EMPTY_FILTER: StaffFilterValues = { search: '', outletId: '', role: '', status: '' }

export default function StaffPage() {
  const { data: staff = [], isLoading } = useStaff()
  const { data: outlets = [] } = useOutlets()
  const { create, update, resetPassword, setStatus, remove } = useStaffMutations()

  const [filter, setFilter] = useState<StaffFilterValues>(EMPTY_FILTER)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StaffRow | null>(null)
  const [resetting, setResetting] = useState<StaffRow | null>(null)

  const rows = useMemo(() => filterStaff(staff, filter), [staff, filter])

  function handleCreate(values: StaffFormValues) {
    create.mutate(values, {
      onSuccess: () => { toast.success(`Staff ${values.name} dibuat`); setShowForm(false) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleUpdate(values: StaffFormValues) {
    if (!editing) return
    update.mutate({ staff_id: editing.id, ...values }, {
      onSuccess: () => { toast.success('Perubahan disimpan'); setEditing(null) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleToggleStatus(s: StaffRow, next: StaffStatus) {
    setStatus.mutate({ staff_id: s.id, status: next }, {
      onSuccess: () => toast.success(`Status ${s.name} → ${next}`),
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleDelete(s: StaffRow) {
    if (!confirm(`HAPUS PERMANEN staff ${s.name}? Akun login ikut terhapus. Tindakan ini tidak bisa dibatalkan.`)) return
    remove.mutate(s.id, {
      onSuccess: () => toast.success(`Staff ${s.name} dihapus`),
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleReset(newPassword: string) {
    if (!resetting) return
    resetPassword.mutate({ staff_id: resetting.id, new_password: newPassword }, {
      onSuccess: () => { toast.success('Password direset'); setResetting(null) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  if (isLoading) return <div className="flex justify-center p-8"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-suka-ink">Manajemen Staff</h2>
        <Button onClick={() => { setEditing(null); setShowForm((v) => !v) }} className="flex items-center gap-2 rounded-xl">
          <UserPlus size={18} /> Tambah Staff
        </Button>
      </div>

      {showForm && !editing && (
        <div className="rounded-2xl border-2 border-suka-orange/40 bg-white p-4 sm:p-6">
          <h3 className="mb-4 font-bold text-suka-ink">Form Staff Baru</h3>
          <StaffForm outlets={outlets} onSubmit={handleCreate} submitting={create.isPending} />
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border-2 border-blue-300 bg-white p-4 sm:p-6">
          <h3 className="mb-4 font-bold text-suka-ink">Edit — {editing.name}</h3>
          <StaffForm
            outlets={outlets}
            submitting={update.isPending}
            onSubmit={handleUpdate}
            initial={{
              name: editing.name, username: editing.username ?? '', password: '',
              role: editing.role, outlet_id: editing.outlet_id ?? (outlets[0]?.id ?? ''),
              outlet_ids: editing.outlet_ids,
            }}
          />
        </div>
      )}

      <StaffFilters value={filter} onChange={setFilter} outlets={outlets} />

      <StaffTable
        rows={rows}
        onEdit={(s) => { setShowForm(false); setEditing(s) }}
        onResetPassword={(s) => setResetting(s)}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
      />

      {resetting && (
        <ResetPasswordDialog
          staffName={resetting.name}
          submitting={resetPassword.isPending}
          onSubmit={handleReset}
          onClose={() => setResetting(null)}
        />
      )}
    </div>
  )
}
