'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Outlet } from '@/lib/types'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'
import { useAuth } from '@suka/auth'

export function useOutlets(initialData?: Outlet[]) {
  const supabase = createClient()
  const { outletStaff } = useAuth()

  return useQuery<Outlet[]>({
    queryKey: ['outlets', outletStaff?.id, outletStaff?.role],
    initialData,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let query = supabase
        .from('outlets')
        .select('id, slug, name, address, lat, lng, type, is_active')
        .neq('id', TEST_OUTLET_ID)
        .eq('is_active', true)
        .order('name')

      if (outletStaff?.role === 'area_manager' && outletStaff?.id) {
        const { data: so } = await supabase
          .from('staff_outlets')
          .select('outlet_id')
          .eq('staff_id', outletStaff.id)

        const assignedIds = [
          ...((so || []).map((s: any) => s.outlet_id)),
          ...(outletStaff.outlet_id ? [outletStaff.outlet_id] : [])
        ].filter((id) => id && id !== TEST_OUTLET_ID)

        const uniqueOutletIds = Array.from(new Set(assignedIds))
        if (uniqueOutletIds.length > 0) {
          query = query.in('id', uniqueOutletIds)
        } else {
          query = query.in('id', ['00000000-0000-0000-0000-000000000000'])
        }
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Outlet[]
    },
  })
}
