'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRole } from '@/components/layout/RoleContext'
import { type Role } from '@/components/layout/navConfig'

type ReportTab = {
  href: string
  label: string
  roles: Role[]
}

const REPORT_TABS: ReportTab[] = [
  { href: '/dashboard/reports/voids', label: 'Batal & Kecurangan', roles: ['OWNER', 'ADMIN'] },
  { href: '/dashboard/reports/shrinkage', label: 'Selisih Stok', roles: ['OWNER', 'ADMIN'] },
  { href: '/dashboard/reports/target-harian', label: 'Target Harian', roles: ['OWNER', 'ADMIN'] },
  { href: '/dashboard/reports/pembelian', label: 'Pembelian', roles: ['ADMIN'] },
  { href: '/dashboard/reports/pos', label: 'Shift POS', roles: ['ADMIN'] },
]

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { role } = useRole()

  const accessibleTabs = REPORT_TABS.filter((tab) => tab.roles.includes(role))

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-white border-b border-suka-gray-100 sticky top-0 z-10 px-6 pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-suka-brown mb-6">Pusat Laporan</h1>
        <div className="flex space-x-6 overflow-x-auto">
          {accessibleTabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`pb-3 font-semibold text-sm border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-suka-orange text-suka-orange'
                    : 'border-transparent text-gray-500 hover:text-suka-ink hover:border-suka-gray-300'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
      <div className="flex-1 w-full max-w-[100vw] overflow-x-hidden">
        {children}
      </div>
    </div>
  )
}
