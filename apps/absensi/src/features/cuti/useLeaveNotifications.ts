import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@suka/auth'

export function useLeaveNotifications() {
  const { outletStaff } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-leaves-count', outletStaff?.id],
    queryFn: async () => {
      if (!outletStaff?.id) return 0
      
      const lastSeenStr = localStorage.getItem(`last_seen_cuti_${outletStaff.id}`)
      const lastSeen = lastSeenStr ? lastSeenStr : '2000-01-01T00:00:00Z'
      
      const { count, error } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('staff_id', outletStaff.id)
        .neq('status', 'pending')
        .gt('updated_at', lastSeen)
        
      if (error) throw error
      return count ?? 0
    },
    enabled: !!outletStaff?.id,
  })

  const prevCount = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (prevCount.current !== undefined && unreadCount > prevCount.current && unreadCount > 0) {
      toast.info('Status pengajuan cuti Anda telah diperbarui!')
    }
    prevCount.current = unreadCount
  }, [unreadCount])

  const markAsRead = () => {
    if (outletStaff?.id) {
      localStorage.setItem(`last_seen_cuti_${outletStaff.id}`, new Date().toISOString())
      queryClient.invalidateQueries({ queryKey: ['unread-leaves-count', outletStaff.id] })
    }
  }

  return { unreadCount, markAsRead }
}
