import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Outlet, OutletFormValues } from '@/lib/types'
import { createOutlet, updateOutlet, softDeleteOutlet, hardDeleteOutlet } from '@/app/dashboard/outlets/actions'
import { MANAGED_OUTLETS_KEY, patchOutlet, statusOutlet } from '@/lib/managedOutlets'

function friendly(error: { code?: string; message: string }): never {
  if (error.code === '23505') throw new Error('Slug sudah dipakai outlet lain.')
  if (error.code === '23503') throw new Error('Outlet masih punya data terkait, tidak bisa dihapus permanen.')
  throw new Error(error.message)
}

type Snapshot = { prev?: Outlet[] }

export function useOutletMutations() {
  const supabase = createClient()
  const qc = useQueryClient()

  // Satu invalidasi untuk SEMUA daftar outlet (prefix ['outlets']): daftar
  // manajemen ini + daftar operasional useOutlets() di layar lain.
  const refresh = () => qc.invalidateQueries({ queryKey: ['outlets'] })

  // Optimistic: baris langsung berubah di layar saat tombol ditekan, lalu
  // dikembalikan bila server menolak.
  async function optimistic(id: string, patch: Partial<Outlet>): Promise<Snapshot> {
    await qc.cancelQueries({ queryKey: MANAGED_OUTLETS_KEY })
    const prev = qc.getQueryData<Outlet[]>(MANAGED_OUTLETS_KEY)
    if (prev) qc.setQueryData<Outlet[]>(MANAGED_OUTLETS_KEY, patchOutlet(prev, id, patch))
    return { prev }
  }
  function rollback(ctx?: Snapshot) {
    if (ctx?.prev) qc.setQueryData(MANAGED_OUTLETS_KEY, ctx.prev)
  }
  function applyServerRow(row?: Partial<Outlet> & { id: string }) {
    if (!row) return
    qc.setQueryData<Outlet[]>(MANAGED_OUTLETS_KEY, (old) => (old ? patchOutlet(old, row.id, row) : old))
  }

  const create = useMutation({
    mutationFn: async (values: OutletFormValues): Promise<Outlet> => {
      try {
        return (await createOutlet(values)) as Outlet
      } catch (error: any) {
        friendly(error)
      }
    },
    onSuccess: (newOutlet) => {
      if (!newOutlet) return
      qc.setQueryData<Outlet[]>(MANAGED_OUTLETS_KEY, (old) =>
        old
          ? [...old.filter((o) => o.id !== newOutlet.id), newOutlet].sort((a, b) => a.name.localeCompare(b.name))
          : old
      )
    },
    onSettled: refresh,
  })

  const update = useMutation<Outlet, Error, { id: string } & OutletFormValues, Snapshot>({
    mutationFn: async (vars) => {
      const { id, ...values } = vars
      try {
        return (await updateOutlet(id, values)) as Outlet
      } catch (error: any) {
        friendly(error)
      }
    },
    onMutate: ({ id, ...values }) => {
      const status = statusOutlet(values)
      return optimistic(id, {
        ...values,
        address: values.address || null,
        status,
        is_active: status === 'active',
        deleted_at: status === 'inactive' ? new Date().toISOString() : null,
      })
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSuccess: (row) => applyServerRow(row),
    onSettled: refresh,
  })

  const softDeleteOptions = {
    onMutate: (id: string) =>
      optimistic(id, { status: 'inactive', is_active: false, deleted_at: new Date().toISOString() }),
    onError: (_e: Error, _id: string, ctx?: Snapshot) => rollback(ctx),
    onSuccess: (res?: { id: string } & Partial<Outlet>) => applyServerRow(res),
    onSettled: refresh,
  }

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await softDeleteOutlet(id)
      } catch (error: any) {
        friendly(error)
      }
    },
    ...softDeleteOptions,
  })

  const hardDelete = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await hardDeleteOutlet(id)
      } catch (error: any) {
        friendly(error)
      }
    },
    ...softDeleteOptions,
  })

  async function countRefs(outletId: string): Promise<number> {
    const tables = ['outlet_staff', 'staff_outlets', 'ledger_stok']
    let total = 0
    for (const t of tables) {
      const { count, error } = await supabase
        .from(t)
        .select('*', { count: 'exact', head: true })
        .eq('outlet_id', outletId)
      if (error) throw new Error(error.message)
      total += count ?? 0
    }
    return total
  }

  return { create, update, softDelete, hardDelete, countRefs }
}
