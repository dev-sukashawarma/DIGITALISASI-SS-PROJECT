import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'

// Landing per role. Role tak terpetakan jatuh ke fallback (Ringkasan HR).
// Mapping identik dengan RoleContext.tsx: outletStaff.role.toUpperCase().
const ROLE_HOME: Record<string, string> = {
  OWNER: '/dashboard/owner',
  MITRA: '/dashboard/owner',
  ADMIN_HR: '/dashboard/hr',
  ADMIN: '/dashboard/system-health',
}
const FALLBACK_HOME = '/dashboard/hr'

export const dynamic = 'force-dynamic'

export default async function DashboardHome() {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  const role = staff?.role?.toUpperCase() ?? ''
  redirect(ROLE_HOME[role] ?? FALLBACK_HOME)
}
