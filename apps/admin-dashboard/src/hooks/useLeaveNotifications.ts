import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export function useLeaveNotifications() {
  const supabase = createClient()
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-leaves-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (error) throw error
      return count ?? 0
    },
    refetchInterval: 15000, // Check every 15 seconds
  })

  return { pendingCount }
}
