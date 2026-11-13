import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Outlet } from '@/lib/types'
import { fetchOutletsOperasional, type OpsiOutletsOperasional } from '@/lib/outletsOperasional'

export function useOutlets(initialData?: Outlet[], opsi: OpsiOutletsOperasional = {}) {
  const supabase = createClient()
  const termasukPersiapan = opsi.termasukPersiapan ?? false
  return useQuery<Outlet[]>({
    queryKey: ['outlets', termasukPersiapan],
    initialData,
    staleTime: 30_000,
    queryFn: () => fetchOutletsOperasional(supabase, { termasukPersiapan }),
  })
}
