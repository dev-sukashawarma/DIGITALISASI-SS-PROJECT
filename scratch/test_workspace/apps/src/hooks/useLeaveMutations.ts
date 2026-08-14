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
    qc.invalidateQueries({ queryKey: ['staff'] })
  }

  const createRequest = useMutation({
    mutationFn: async (payload: CreateLeavePayload) => {
      let attachment_url: string | null = null
      
      // Handle file upload if provided (e.g. for sick leave)
      if (payload.file) {
        const fileExt = payload.file.name.split('.').pop()
        const fileName = `${Date.now()}_${payload.staff_id}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('hr-attachments')
          .upload(fileName, payload.file)
          
        if (uploadError) throw new Error(`Gagal upload bukti: ${uploadError.message}`)
        
        const { data: publicUrlData } = supabase.storage
          .from('hr-attachments')
          .getPublicUrl(fileName)
          
        attachment_url = publicUrlData.publicUrl
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

      // Fetch the complete leave request
      const { data: request, error: reqError } = await supabase
        .from('leave_requests')
        .select('*, outlet_staff!leave_requests_staff_id_fkey!inner(outlet_id, leave_quota)')
        .eq('id', vars.id)
        .single()
      if (reqError || !request) {
        console.error('Approve Error:', reqError)
        throw new Error(`Data pengajuan cuti tidak ditemukan: ${reqError?.message || ''}`)
      }

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
      const currentQuota = request.outlet_staff.leave_quota ?? 0
      const newQuota = Math.max(0, currentQuota - vars.days)

      const { error: quotaError } = await supabase
        .from('outlet_staff')
        .update({ leave_quota: newQuota })
        .eq('id', vars.staff_id)
      if (quotaError) throw quotaError
      
      // Upsert attendance for each day
      let attendanceStatus = 'cuti'
      if (request.leave_type === 'sick') attendanceStatus = 'sakit'
      if (request.leave_type === 'personal') attendanceStatus = 'izin'
      
      const startDate = new Date(request.start_date)
      const endDate = new Date(request.end_date)
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const isoDate = d.toISOString().split('T')[0]
        
        // Check if an attendance record exists for this date and staff
        const { data: existingLogs } = await supabase
          .from('attendance_logs')
          .select('id')
          .eq('staff_id', request.staff_id)
          .eq('date', isoDate)
          
        if (existingLogs && existingLogs.length > 0) {
          // Replace/Upsert
          for (const log of existingLogs) {
            await supabase.from('attendance_logs').update({
              status: attendanceStatus,
              notes: 'Izin/Cuti disetujui (Otomatis)',
            }).eq('id', log.id)
          }
        } else {
          // Insert new
          await supabase.from('attendance_logs').insert({
            staff_id: request.staff_id,
            outlet_id: request.outlet_staff.outlet_id,
            date: isoDate,
            status: attendanceStatus,
            late_minutes: 0,
            notes: 'Izin/Cuti disetujui (Otomatis)',
          })
        }
      }
    },
    onSuccess: invalidate,
  })

  const reject = useMutation({
    mutationFn: async (vars: RejectPayload) => {
      // Fetch the complete leave request
      const { data: request, error: reqError } = await supabase
        .from('leave_requests')
        .select('*, outlet_staff!leave_requests_staff_id_fkey!inner(outlet_id)')
        .eq('id', vars.id)
        .single()
      if (reqError || !request) {
        console.error('Reject Error:', reqError)
        throw new Error(`Data pengajuan cuti tidak ditemukan: ${reqError?.message || ''}`)
      }

      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          rejection_note: vars.rejection_note,
        })
        .eq('id', vars.id)
      if (error) throw error
      
      // Upsert attendance for each day as 'alfa'
      const startDate = new Date(request.start_date)
      const endDate = new Date(request.end_date)
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const isoDate = d.toISOString().split('T')[0]
        
        // Check if an attendance record exists for this date and staff
        const { data: existingLogs } = await supabase
          .from('attendance_logs')
          .select('id')
          .eq('staff_id', request.staff_id)
          .eq('date', isoDate)
          
        if (existingLogs && existingLogs.length > 0) {
          // Replace/Upsert
          for (const log of existingLogs) {
            await supabase.from('attendance_logs').update({
              status: 'alfa',
              notes: `Cuti/Izin ditolak: ${vars.rejection_note}`,
            }).eq('id', log.id)
          }
        } else {
          // Insert new
          await supabase.from('attendance_logs').insert({
            staff_id: request.staff_id,
            outlet_id: request.outlet_staff.outlet_id,
            date: isoDate,
            status: 'alfa',
            late_minutes: 0,
            notes: `Cuti/Izin ditolak: ${vars.rejection_note}`,
          })
        }
      }
    },
    onSuccess: invalidate,
  })

  return { createRequest, approve, reject }
}
