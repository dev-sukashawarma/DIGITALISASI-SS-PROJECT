import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useEffect, useRef, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@suka/auth'
import { useRealtimeInvalidate } from '@suka/realtime'

export function useLeaveNotifications() {
  const { outletStaff } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()

  const randomSuffix = useMemo(() => Math.random().toString(36).slice(2), [])

  useRealtimeInvalidate({
    channelName: `absensi-cuti-${outletStaff?.id ?? "none"}-${randomSuffix}`,
    enabled: !!outletStaff?.id,
    subs: [
      {
        table: "leave_requests",
        filter: `staff_id=eq.${outletStaff?.id}`,
        queryKeys: [
          ["leaves", outletStaff?.id],
          ["leaveBalance", outletStaff?.id, new Date().getFullYear()],
          ["unread-leaves-count", outletStaff?.id],
        ],
      },
    ],
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-leaves-count', outletStaff?.id],
    queryFn: async () => {
      if (!outletStaff?.id) return 0
      
      const lastSeenStr = typeof window !== 'undefined' ? localStorage.getItem(`last_seen_cuti_${outletStaff.id}`) : null
      const lastSeen = lastSeenStr ? lastSeenStr : '2000-01-01T00:00:00Z'
      
      const { count, error } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('staff_id', outletStaff.id)
        .neq('status', 'pending')
        .gt('updated_at', lastSeen)
        
      if (error) {
        console.warn('useLeaveNotifications query error:', error.message)
        return 0
      }
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

  const markAsRead = useCallback(() => {
    if (outletStaff?.id && typeof window !== 'undefined') {
      localStorage.setItem(`last_seen_cuti_${outletStaff.id}`, new Date().toISOString())
      queryClient.invalidateQueries({ queryKey: ['unread-leaves-count', outletStaff.id] })
    }
  }, [outletStaff?.id, queryClient])

  return { unreadCount, markAsRead }
}
