import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import InventarisReportView from './InventarisReportView'

export const dynamic = 'force-dynamic'

export default async function InventarisReportsPage() {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  // Guard server-side: URL ini tidak dapat dibuka oleh AM, owner, atau role lain.
  if (staff?.role !== 'admin') redirect('/dashboard')
  return <InventarisReportView />
}
