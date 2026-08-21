import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  
  if (staff?.role === 'leader') {
    redirect('/leader/petty-cash')
  }
  
  if ((staff?.role as string) === 'area_manager' || (staff?.role as string) === 'korlap') {
    redirect('/area-manager/petty-cash')
  }

  if ((staff?.role as string) === 'purchasing' || (staff?.role as string) === 'purchase') {
    redirect('/pembelian/dashboard')
  }

  // admin, admin_finance, dan owner sekarang bisa melihat Dashboard di root (/)
  return <DashboardClient />
}
