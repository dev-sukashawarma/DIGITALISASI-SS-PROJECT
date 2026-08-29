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
  file?: File | null
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
    qc.invalidateQueries({ queryKey: ['pending-leaves-count'] })
    qc.invalidateQueries({ queryKey: ['staff'] })
    qc.invalidateQueries({ queryKey: ['hr-activity'] })
  }

  const createRequest = useMutation({
    mutationFn: async (payload: CreateLeavePayload) => {
      let attachment_url: string | null = null
      
      if (payload.file) {
        const fileExt = payload.file.name.split('.').pop()
        const fileName = `${Date.now()}_${payload.staff_id}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('hr-attachments')
          .upload(fileName, payload.file)
          
        if (uploadError) {
          console.warn('Storage upload warning:', uploadError.message)
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('hr-attachments')
            .getPublicUrl(fileName)
          attachment_url = publicUrlData.publicUrl
        }
      }

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
          attachment_url,
        })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const approve = useMutation({
    mutationFn: async (vars: { id: string; staff_id: string; days: number }) => {
      const currentUserId = outletStaff?.id
      if (!currentUserId) throw new Error('Sesi tidak ditemukan')

      const { data: request, error: reqError } = await supabase
        .from('leave_requests')
        .select('*, outlet_staff!leave_requests_staff_id_fkey!inner(outlet_id, leave_quota)')
        .eq('id', vars.id)
        .single()
      if (reqError || !request) {
        throw new Error(`Data pengajuan cuti tidak ditemukan: ${reqError?.message || ''}`)
      }

      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', vars.id)
      if (updateError) throw updateError

      const currentQuota = request.outlet_staff.leave_quota ?? 0
      const newQuota = Math.max(0, currentQuota - vars.days)

      await supabase
        .from('outlet_staff')
        .update({ leave_quota: newQuota })
        .eq('id', vars.staff_id)
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
