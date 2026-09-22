import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export function useApprovalNotifications() {
  const supabase = createClient()

  const { data: pendingLeaves = 0 } = useQuery({
    queryKey: ['pending-leaves-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (error) throw error
      return count ?? 0
    },
    refetchInterval: 15000,
  })

  const { data: pendingKasbon = 0 } = useQuery({
    queryKey: ['pending-kasbon-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('cash_advances')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (error) throw error
      return count ?? 0
    },
    refetchInterval: 15000,
  })

  const totalPending = pendingLeaves + pendingKasbon

  return {
    pendingLeavesCount: pendingLeaves,
    pendingKasbonCount: pendingKasbon,
    pendingCount: totalPending,
    totalPendingCount: totalPending,
  }
}

// Backwards compatibility
export const useLeaveNotifications = useApprovalNotifications
