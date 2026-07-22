import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { ClientRedirect } from './ClientRedirect'

// Landing per role. Role tak terpetakan jatuh ke fallback (Ringkasan HR).
const ROLE_HOME: Record<string, string> = {
  OWNER: '/dashboard/owner',
  MITRA: '/dashboard/mitra',
  ADMIN_HR: '/dashboard/hr',
  ADMIN: '/dashboard/system-health',
  AREA_MANAGER: '/dashboard/area-manager',
  KORLAP: '/dashboard/area-manager',
  LEADER: '/dashboard/leader',
}

export default async function DashboardHome() {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  const role = staff?.role?.toUpperCase() ?? ''
  
  if (ROLE_HOME[role]) {
    redirect(ROLE_HOME[role])
  }
  
  return <ClientRedirect />
}
