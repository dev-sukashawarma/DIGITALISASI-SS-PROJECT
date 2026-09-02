import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import InventarisReportView from '../InventarisReportView'

export const dynamic = 'force-dynamic'

export default async function InventarisOutletReportPage({ params }: { params: Promise<{ outletId: string }> }) {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  if (!staff || !['admin', 'regional_manager'].includes(staff.role)) redirect('/dashboard')
  const { outletId } = await params
  return <InventarisReportView outletId={outletId} />
}
