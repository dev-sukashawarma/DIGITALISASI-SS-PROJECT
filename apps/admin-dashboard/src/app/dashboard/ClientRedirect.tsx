'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/components/layout/RoleContext'

const ROLE_HOME: Record<string, string> = {
  OWNER: '/dashboard/owner',
  MITRA: '/dashboard/mitra',
  ADMIN_HR: '/dashboard/hr',
  ADMIN: '/dashboard/reports/pos',
  SUPERADMIN: '/dashboard/reports/pos',
  AREA_MANAGER: '/dashboard/area-manager',
  KORLAP: '/dashboard/area-manager',
  LEADER: '/dashboard/leader',
  PURCHASING: '/dashboard/pembelian',
}
const FALLBACK_HOME = '/dashboard/owner'

export function ClientRedirect() {
  const { role } = useRole()
  const router = useRouter()
  
  useEffect(() => {
    if (role) {
      router.replace(ROLE_HOME[role] ?? FALLBACK_HOME)
    }
  }, [role, router])
  
  return null
}
