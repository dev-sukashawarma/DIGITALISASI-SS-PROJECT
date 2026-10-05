import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { fetchManagedOutlets, MANAGED_OUTLETS_KEY } from '@/lib/managedOutlets'
import OutletsView from './OutletsView'

export const dynamic = 'force-dynamic'

export default async function OutletsPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })

  const queryClient = new QueryClient()

  // Fetcher yang SAMA dengan useManagedOutlets di klien — daftar SSR dan daftar
  // sesudah refetch tidak boleh berbeda (lihat lib/managedOutlets.ts).
  try {
    queryClient.setQueryData(MANAGED_OUTLETS_KEY, await fetchManagedOutlets(supabase))
  } catch {
    // Biarkan klien yang mengambil & menampilkan galatnya.
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OutletsView />
    </HydrationBoundary>
  )
}
