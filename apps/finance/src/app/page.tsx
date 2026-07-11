import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  
  if (staff?.role === 'leader') {
    redirect('/leader')
  }
  
  if (staff?.role === 'korlap') {
    redirect('/korlap')
  }

  return <DashboardClient />
}
