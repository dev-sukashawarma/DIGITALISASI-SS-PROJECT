'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, Users, Store, Activity, 
  CalendarClock, CalendarHeart, Banknote, Briefcase, Award,
  PieChart, DollarSign
} from 'lucide-react'
import { useRole } from './RoleContext'

type NavItem = { href: string; label: string; icon: any; roles: string[] }
type NavGroup = { title: string; items: NavItem[]; roles: string[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'HR Dashboard',
    roles: ['ADMIN_HR', 'ADMIN', 'OWNER'],
    items: [
      { href: '/dashboard/hr', label: 'Ringkasan HR', icon: LayoutDashboard, roles: ['ADMIN_HR', 'ADMIN', 'OWNER'] },
      { href: '/dashboard/hr/staff', label: 'Database Karyawan', icon: Users, roles: ['ADMIN_HR', 'ADMIN', 'OWNER'] },
      { href: '/dashboard/hr/attendance', label: 'Absensi & Shift', icon: CalendarClock, roles: ['ADMIN_HR', 'ADMIN', 'OWNER'] },
      { href: '/dashboard/hr/leave', label: 'Cuti & Izin', icon: CalendarHeart, roles: ['ADMIN_HR', 'ADMIN', 'OWNER'] },
      { href: '/dashboard/hr/payroll', label: 'Payroll & Kasbon', icon: Banknote, roles: ['ADMIN_HR', 'ADMIN', 'OWNER'] },
      { href: '/dashboard/hr/recruitment', label: 'Rekrutmen', icon: Briefcase, roles: ['ADMIN_HR', 'ADMIN', 'OWNER'] },
      { href: '/dashboard/hr/kpi', label: 'KPI & SP', icon: Award, roles: ['ADMIN_HR', 'ADMIN', 'OWNER'] },
    ]
  },
  {
    title: 'Owner Dashboard',
    roles: ['OWNER', 'ADMIN'],
    items: [
      { href: '/dashboard/owner', label: 'Ringkasan Bisnis', icon: PieChart, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/profit', label: 'Profitabilitas', icon: DollarSign, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/expenses', label: 'Pengeluaran', icon: Activity, roles: ['OWNER', 'ADMIN'] },
    ]
  },
  {
    title: 'System & Admin',
    roles: ['ADMIN', 'OWNER'],
    items: [
      { href: '/dashboard/outlets', label: 'Manajemen Outlet', icon: Store, roles: ['ADMIN', 'OWNER'] },
      { href: '/dashboard/system-health', label: 'System Health', icon: Activity, roles: ['ADMIN', 'OWNER'] },
    ]
  }
]

export const Sidebar = () => {
  const pathname = usePathname()
  const { role } = useRole()

  return (
    <aside className="hidden w-64 shrink-0 border-r border-suka-gray-200 bg-white md:flex md:flex-col">
      <div className="p-5 border-b border-suka-gray-100">
        <div className="text-xl font-extrabold text-suka-brown tracking-tight">Admin<span className="text-suka-orange">Hub</span></div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 text-sm">
        {NAV_GROUPS.map((group) => {
          if (!group.roles.includes(role)) return null;

          return (
            <div key={group.title}>
              <h3 className="px-3 mb-2 text-xs font-semibold text-suka-gray-500 uppercase tracking-wider">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map(({ href, label, icon: Icon, roles }) => {
                  if (!roles.includes(role)) return null;
                  
                  // Highlight parent route as active if we are on a sub-route, unless it's exactly the parent
                  const active = pathname === href || (pathname.startsWith(href) && href !== '/dashboard/hr' && href !== '/dashboard/owner' && href !== '/dashboard');
                  // For the main dashboard /dashboard/hr or /dashboard/owner, exact match only
                  const isExactMatch = pathname === href;
                  const isActive = (href === '/dashboard/hr' || href === '/dashboard/owner') ? isExactMatch : active;

                  return (
                    <Link 
                      key={href} 
                      href={href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 font-medium transition-colors ${
                        isActive 
                          ? 'bg-suka-orange/10 text-suka-orange' 
                          : 'text-gray-600 hover:bg-suka-gray-50 hover:text-suka-ink'
                      }`}
                    >
                      <Icon size={18} className={isActive ? 'text-suka-orange' : 'text-gray-400'} /> 
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
