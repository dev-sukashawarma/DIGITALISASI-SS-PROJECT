import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'

export const dynamic = 'force-dynamic'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const userId = await getVerifiedUserId(supabase)
  if (!userId) {
    redirect('/login')
  }

  const { data: staff } = await supabase
    .from('outlet_staff')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  const userRole = staff?.role?.toLowerCase()
  const allowed = ['developer', 'owner', 'admin']
  if (!userRole || !allowed.includes(userRole)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
