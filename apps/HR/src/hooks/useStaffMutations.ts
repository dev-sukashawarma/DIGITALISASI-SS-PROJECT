import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@suka/auth'
import { adminApi } from '@/lib/adminApi'
import type { StaffFormValues } from '@/lib/types'
import { createStaffSync, updateStaffSync, toggleStaffBonusEligibility, deleteStaffSync } from '@/app/actions/users'

export function useStaffMutations() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const token = () => {
    const t = session?.access_token
    if (!t) throw new Error('Sesi tidak ditemukan')
    return t
  }
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['staff'] })
    qc.invalidateQueries({ queryKey: ['hr-activity'] })
  }

  const create = useMutation({
    mutationFn: async (values: StaffFormValues) => {
      const res = await createStaffSync(values)
      if (!res.ok) throw new Error(res.error || 'Gagal menambahkan staf')
      return res
    },
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: async (vars: { staff_id: string } & Partial<StaffFormValues>) => {
      const res = await updateStaffSync(vars)
      if (!res.ok) throw new Error(res.error || 'Gagal memperbarui staf')
      return res
    },
    onSuccess: invalidate,
  })
  const resetPassword = useMutation({
    mutationFn: (vars: { staff_id: string; new_password: string }) =>
      adminApi.resetPassword(token(), vars.staff_id, vars.new_password),
  })
  const setStatus = useMutation({
    mutationFn: (vars: { staff_id: string; status: string }) =>
      adminApi.setStatus(token(), vars.staff_id, vars.status),
    onSuccess: invalidate,
  })
  const toggleBonusEligibility = useMutation({
    mutationFn: async (vars: { staff_id: string; is_bonus_eligible: boolean }) => {
      const res = await toggleStaffBonusEligibility(vars.staff_id, vars.is_bonus_eligible)
      if (!res.ok) throw new Error(res.error || 'Gagal mengubah status bonus')
      return res
    },
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (staff_id: string) => {
      const res = await deleteStaffSync(staff_id)
      if (!res.ok) throw new Error(res.error || res.message || 'Gagal menghapus staf')
      return res
    },
    onSuccess: invalidate,
  })

  return { create, update, resetPassword, setStatus, toggleBonusEligibility, remove }
}
