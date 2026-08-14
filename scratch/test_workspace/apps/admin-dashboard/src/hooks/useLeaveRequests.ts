import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { LeaveRequest, LeaveStatus } from '@/lib/types'

export function useLeaveRequests(status?: LeaveStatus) {
  const supabase = createClient()

  return useQuery<LeaveRequest[]>({
    queryKey: status ? ['leave-requests', status] : ['leave-requests'],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let query = supabase
        .from('leave_requests')
        .select(`
          id, staff_id, leave_type, start_date, end_date, days,
          reason, status, approved_by, approved_at, rejection_note,
          created_at, attachment_url,
          outlet_staff!leave_requests_staff_id_fkey(name, role, leave_quota)
        `)
        .order('created_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as LeaveRequest[]
    },
  })
}
