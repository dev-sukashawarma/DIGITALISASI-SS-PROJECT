import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { StaffRow } from '@/lib/types'

export function useStaff() {
  const supabase = createClient()
  return useQuery<StaffRow[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlet_staff')
        .select('id, name, role, status, username, outlet_id, outlets(name), staff_outlets(outlet_id)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        ...r,
        outlet_ids: (r.staff_outlets ?? []).map((s: any) => s.outlet_id),
      })) as StaffRow[]
    },
  })
}
