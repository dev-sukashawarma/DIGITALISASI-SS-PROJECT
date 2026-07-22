import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  
  if (staff?.role === 'leader') {
    redirect('/leader/petty-cash')
  }
  
  if (staff?.role === 'area_manager' || staff?.role === 'korlap') {
    redirect('/area-manager/petty-cash')
  }

  if (staff?.role === 'admin' || staff?.role === 'admin_finance' || staff?.role === 'owner') {
    redirect('/finance/petty-cash')
  }

  return <DashboardClient />
}
