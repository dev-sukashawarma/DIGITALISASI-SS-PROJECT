'use client'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { useStaff } from '@/hooks/useStaff'
import { useOutlets } from '@/hooks/useOutlets'

export const dynamic = 'force-dynamic'

export default function DashboardHome() {
  const { data: staff = [] } = useStaff()
  const { data: outlets = [] } = useOutlets()
  const activeCount = staff.filter((s) => s.status === 'active').length
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-suka-ink">Ringkasan</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4">
          <div className="text-3xl font-extrabold text-suka-brown">{staff.length}</div>
          <div className="text-sm text-gray-500">Total Staff</div>
        </div>
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4">
          <div className="text-3xl font-extrabold text-suka-green">{activeCount}</div>
          <div className="text-sm text-gray-500">Aktif</div>
        </div>
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4">
          <div className="text-3xl font-extrabold text-suka-brown">{outlets.length}</div>
          <div className="text-sm text-gray-500">Outlet</div>
        </div>
      </div>
      <Link href="/dashboard/staff" className="inline-flex items-center gap-2 rounded-xl bg-suka-orange px-4 py-2.5 font-semibold text-white">
        <Users size={18} /> Kelola Staff
      </Link>
    </div>
  )
}
