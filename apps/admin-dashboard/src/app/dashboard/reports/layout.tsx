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
  { href: '/dashboard/reports/pos', label: 'Shift POS', roles: ['ADMIN'] },
  { href: '/dashboard/reports/voids', label: 'Batal & Kecurangan', roles: ['OWNER', 'ADMIN'] },
  { href: '/dashboard/reports/shrinkage', label: 'Selisih Stok', roles: ['OWNER', 'ADMIN'] },
  { href: '/dashboard/reports/target-harian', label: 'Target Harian', roles: ['OWNER', 'ADMIN'] },
  { href: '/dashboard/reports/crew-bonus', label: 'Bonus Crew', roles: ['OWNER', 'ADMIN'] },
  { href: '/dashboard/reports/pembelian', label: 'Pembelian', roles: ['ADMIN'] },
]

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { role } = useRole()

  const accessibleTabs = REPORT_TABS.filter((tab) => tab.roles.includes(role))

  return (
    <div className="flex flex-col min-h-screen w-full">
      <div className="bg-white border border-gray-100/80 px-4 sm:px-8 pt-6 sm:pt-8 mx-2 sm:mx-4 lg:mx-0 mt-2 sm:mt-4 lg:mt-0 rounded-2xl sm:rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 mb-4 sm:mb-6">Pusat Laporan</h1>
        <div className="flex space-x-6 sm:space-x-8 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {accessibleTabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`pb-3 sm:pb-4 font-bold text-sm sm:text-[15px] border-b-[3px] whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
      <div className="flex-1 w-full px-2 sm:px-4 lg:px-0 mt-6 sm:mt-8">
        {children}
      </div>
    </div>
  )
}
