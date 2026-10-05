import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { fetchManagedOutlets, MANAGED_OUTLETS_KEY } from '@/lib/managedOutlets'
import type { Outlet } from '@/lib/types'

/** Semua outlet untuk halaman Manajemen Outlet — lihat catatan di lib/managedOutlets.ts. */
export function useManagedOutlets() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<Outlet[]>({
    queryKey: MANAGED_OUTLETS_KEY,
    staleTime: 30_000,
    queryFn: () => fetchManagedOutlets(supabase),
  })
}
