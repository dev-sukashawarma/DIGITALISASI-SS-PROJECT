import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import SidakReviewView from './SidakReviewView'

export const dynamic = 'force-dynamic'

export default async function AdminSidakReviewPage() {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  // Hasil sidak dapat dipantau admin dan regional manager.
  if (!staff || !['admin', 'regional_manager'].includes(staff.role)) redirect('/dashboard')
  return <SidakReviewView />
}
