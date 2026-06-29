'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/components/layout/RoleContext'

export const dynamic = 'force-dynamic'

export default function DashboardHome() {
  const router = useRouter()
  const { role } = useRole()

  useEffect(() => {
    if (role === 'OWNER') {
      router.replace('/dashboard/owner')
    } else if (role === 'MITRA') {
      router.replace('/dashboard/owner')
    } else if (role === 'ADMIN_HR') {
      router.replace('/dashboard/hr')
    } else if (role === 'ADMIN') {
      router.replace('/dashboard/system-health')
    }
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
