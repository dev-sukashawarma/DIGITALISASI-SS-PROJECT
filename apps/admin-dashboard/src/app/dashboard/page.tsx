'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/components/layout/RoleContext'

export const dynamic = 'force-dynamic'

// Landing per role. Role tak terpetakan jatuh ke fallback (Ringkasan HR).
const ROLE_HOME: Record<string, string> = {
  OWNER: '/dashboard/owner',
  MITRA: '/dashboard/owner',
  ADMIN_HR: '/dashboard/hr',
  ADMIN: '/dashboard/system-health',
}
const FALLBACK_HOME = '/dashboard/hr'

export default function DashboardHome() {
  const router = useRouter()
  const { role } = useRole()

  useEffect(() => {
    router.replace(ROLE_HOME[role] ?? FALLBACK_HOME)
  }, [role, router])

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-suka-gray-500 italic">Mengarahkan ke Dashboard...</p>
      </div>
    </div>
  )
}
