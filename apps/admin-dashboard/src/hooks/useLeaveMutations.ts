import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@suka/auth'
import { createClient } from '@/lib/supabase'

interface CreateLeavePayload {
  staff_id: string
  leave_type: string
  start_date: string
  end_date: string
  days: number
  reason: string
}

interface RejectPayload {
  id: string
  rejection_note: string
}

export function useLeaveMutations() {
  const { outletStaff } = useAuth()
  const qc = useQueryClient()
  const supabase = createClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leave-requests'] })
    qc.invalidateQueries({ queryKey: ['staff'] })
  }

  const createRequest = useMutation({
    mutationFn: async (payload: CreateLeavePayload) => {
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          staff_id: payload.staff_id,
          leave_type: payload.leave_type,
          start_date: payload.start_date,
          end_date: payload.end_date,
          days: payload.days,
          reason: payload.reason,
          status: 'pending',
        })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const approve = useMutation({
    mutationFn: async (vars: { id: string; staff_id: string; days: number }) => {
      const currentUserId = outletStaff?.id
      if (!currentUserId) throw new Error('Sesi tidak ditemukan')

      // Update the leave request status
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', vars.id)
      if (updateError) throw updateError

      // Decrement leave_quota in outlet_staff
      const { data: staffData, error: fetchError } = await supabase
        .from('outlet_staff')
        .select('leave_quota')
        .eq('id', vars.staff_id)
        .single()
      if (fetchError) throw fetchError

      const currentQuota = staffData?.leave_quota ?? 0
      const newQuota = Math.max(0, currentQuota - vars.days)

      const { error: quotaError } = await supabase
        .from('outlet_staff')
        .update({ leave_quota: newQuota })
        .eq('id', vars.staff_id)
      if (quotaError) throw quotaError
    },
    onSuccess: invalidate,
  })

  const reject = useMutation({
    mutationFn: async (vars: RejectPayload) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          rejection_note: vars.rejection_note,
        })
        .eq('id', vars.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { createRequest, approve, reject }
}
