import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import GuidesView from './GuidesView'

export const dynamic = 'force-dynamic'

export default async function AdminGuidesPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // We should actually fetch from our internal API or database directly. 
  // Let's use direct database access if it's the standard.
  const { data } = await supabase.from('guides').select('*').order('sort_order')

  const initialGuides = data || []

  return <GuidesView initialGuides={initialGuides} />
}
