import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { getServiceSupabase } from '@/lib/supabase-service'
import { canAccessLabaRugi } from '@/lib/labaRugiAccess'

export const dynamic = 'force-dynamic'

export default async function LabaRugiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const headerStaff = parseStaffHeader(headersList.get(STAFF_HEADER))

  if (!headerStaff?.id) {
    redirect('/')
  }

  let allowed = canAccessLabaRugi(headerStaff)
  if (!allowed) {
    try {
      const supabase = getServiceSupabase()
      const { data: staff } = await supabase
        .from('outlet_staff')
        .select('id, email, role, status')
        .eq('id', headerStaff.id)
        .maybeSingle()
      allowed = canAccessLabaRugi(staff)
    } catch {
      allowed = false
    }
  }

  if (!allowed) {
    redirect('/')
  }

  return <>{children}</>
}
