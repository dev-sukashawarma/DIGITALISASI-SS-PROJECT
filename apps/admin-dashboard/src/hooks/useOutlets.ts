import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Outlet } from '@/lib/types'

export function useOutlets() {
  const supabase = createClient()
  return useQuery<Outlet[]>({
    queryKey: ['outlets'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, slug, name, address, lat, lng, type, is_active')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}
