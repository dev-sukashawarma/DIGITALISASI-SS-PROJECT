import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { SystemHealthLogRow } from '@/lib/types'

export function useSystemHealth() {
  const supabase = createClient()
  return useQuery<SystemHealthLogRow[]>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('system_health_log')
        .select('*')
        .gte('checked_at', since)
        .order('checked_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    refetchInterval: 30_000,
  })
}
