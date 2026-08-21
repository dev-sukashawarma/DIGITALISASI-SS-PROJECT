import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import UsersView from './UsersView'
import type { Outlet } from '@/pos-types'

interface UserProfile {
  id: string
  role: string
  username: string
  outlet_id: string | null
  outlets?: { name: string }
  staff_outlets?: { outlet_id: string }[]
  is_active?: boolean
  inactive_reason?: string | null
}

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const [profilesRes, outletsRes] = await Promise.all([
    supabase
      .from('outlet_staff')
      .select('*, outlets!outlet_staff_outlet_id_fkey(name), staff_outlets(outlet_id)')
      .order('created_at', { ascending: false }),
    supabase
      .from('outlets')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
  ])

  const initialUsers: UserProfile[] = profilesRes.data || []
  const initialOutlets: Outlet[] = outletsRes.data || []

  return <UsersView initialUsers={initialUsers} initialOutlets={initialOutlets} />
}
