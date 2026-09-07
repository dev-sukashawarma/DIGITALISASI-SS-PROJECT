import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import InventarisReportView from './InventarisReportView'

export const dynamic = 'force-dynamic'

export default async function InventarisReportsPage() {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  // Laporan inventori dapat dilihat admin dan regional manager.
  if (!staff || !['admin', 'regional_manager'].includes(staff.role)) redirect('/dashboard')
  return <InventarisReportView />
}
