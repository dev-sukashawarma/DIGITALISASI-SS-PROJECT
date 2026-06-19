import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Outlet } from '@/lib/types'

export function useOutlets() {
  const supabase = createClient()
  return useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('outlets').select('id, name').order('name')
      if (error) throw error
      return data ?? []
    },
  })
}
