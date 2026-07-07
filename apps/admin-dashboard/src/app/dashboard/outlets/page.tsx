import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import OutletsView from './OutletsView'

export const dynamic = 'force-dynamic'

export default async function OutletsPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })
  
  const queryClient = new QueryClient()
  
  // 1. Fetch Outlets
  const { data: outlets } = await supabase
    .from('outlets')
    .select('id, slug, name, address, lat, lng, type, is_active')
    .order('name')
  
  if (outlets) {
    queryClient.setQueryData(['outlets'], outlets)
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OutletsView />
    </HydrationBoundary>
  )
}
