import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { OutletFormValues } from '@/lib/types'
import { createOutlet, updateOutlet, softDeleteOutlet, hardDeleteOutlet } from '@/app/dashboard/outlets/actions'

function friendly(error: { code?: string; message: string }): never {
  if (error.code === '23505') throw new Error('Slug sudah dipakai outlet lain.')
  if (error.code === '23503') throw new Error('Outlet masih punya data terkait, tidak bisa dihapus permanen.')
  throw new Error(error.message)
}

export function useOutletMutations() {
  const supabase = createClient()
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['outlets'] })

  const create = useMutation({
    mutationFn: async (values: OutletFormValues) => {
      try {
        await createOutlet(values)
      } catch (error: any) {
        friendly(error)
      }
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async (vars: { id: string } & OutletFormValues) => {
      const { id, ...values } = vars
      try {
        await updateOutlet(id, values)
      } catch (error: any) {
        friendly(error)
      }
    },
    onSuccess: invalidate,
  })

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      try {
        await softDeleteOutlet(id)
      } catch (error: any) {
        friendly(error)
      }
    },
    onSuccess: invalidate,
  })

  const hardDelete = useMutation({
    mutationFn: async (id: string) => {
      try {
        await hardDeleteOutlet(id)
      } catch (error: any) {
        friendly(error)
      }
    },
    onSuccess: invalidate,
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
