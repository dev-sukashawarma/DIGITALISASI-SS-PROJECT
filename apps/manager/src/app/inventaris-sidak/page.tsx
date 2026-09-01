import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { getSidakData } from '@/lib/inventaris-sidak-server'
import InventarisSidakClient from './InventarisSidakClient'

export default async function InventarisSidakPage() {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  if (!staff) return null
  const data = await getSidakData(staff)
  return <InventarisSidakClient initialData={data} staffId={staff.id} staffName={staff.name} role={staff.role} />
}
