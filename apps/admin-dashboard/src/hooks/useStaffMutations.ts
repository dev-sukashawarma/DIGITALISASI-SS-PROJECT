import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@suka/auth'
import { adminApi } from '@/lib/adminApi'
import type { StaffFormValues } from '@/lib/types'

export function useStaffMutations() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const token = () => {
    const t = session?.access_token
    if (!t) throw new Error('Sesi tidak ditemukan')
    return t
  }
  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff'] })

  const create = useMutation({
    mutationFn: (values: StaffFormValues) => adminApi.createStaff(token(), values),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: (vars: { staff_id: string } & Partial<StaffFormValues>) =>
      adminApi.updateStaff(token(), vars),
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
  const remove = useMutation({
    mutationFn: (staff_id: string) => adminApi.deleteStaff(token(), staff_id),
    onSuccess: invalidate,
  })

  return { create, update, resetPassword, setStatus, remove }
}
