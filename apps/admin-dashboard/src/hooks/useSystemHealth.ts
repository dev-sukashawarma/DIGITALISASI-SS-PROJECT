import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { SystemHealthLogRow } from '@/lib/types'
import type { HealthTransition } from '@/lib/healthStatus'

export interface SystemHealthData {
  latest: SystemHealthLogRow[]
  transitions: HealthTransition[]
}

// Agregasi dipindah ke DB: system_health_latest (status terkini per target) &
// system_health_transitions (perubahan status 24 jam). Browser tak lagi menarik
// seluruh baris 24 jam lalu mereduksi sendiri.
export function useSystemHealth() {
  const supabase = createClient()
  return useQuery<SystemHealthData>({
    queryKey: ['system-health'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [latestRes, transRes] = await Promise.all([
        supabase
          .from('system_health_latest')
          .select('id, target_type, target_name, status, db_status, last_activity_at, response_time_ms, detail, checked_at'),
        supabase
          .from('system_health_transitions')
          .select('target_name, from_status, to_status, checked_at'),
      ])
      if (latestRes.error) throw latestRes.error
      if (transRes.error) throw transRes.error

      const transitions: HealthTransition[] = (transRes.data ?? []).map((t: any) => ({
        target_name: t.target_name,
        from: t.from_status,
        to: t.to_status,
        checked_at: t.checked_at,
      }))

      return { latest: (latestRes.data ?? []) as SystemHealthLogRow[], transitions }
    },
  })
}
