import {
  LayoutDashboard,
  Users,
  CalendarClock,
  CalendarHeart,
  Banknote,
  FileText,
  Calendar,
  AlertTriangle,
  Award,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: LucideIcon
}

export type NavGroup = {
  title: string
  icon: LucideIcon
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Ringkasan',
    icon: LayoutDashboard,
    items: [
      { href: '/', label: 'Ringkasan HR', shortLabel: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Personalia',
    icon: Users,
    items: [
      { href: '/staff', label: 'Database Karyawan', shortLabel: 'Karyawan', icon: Users },
      { href: '/contracts', label: 'Monitoring Kontrak', shortLabel: 'Kontrak', icon: FileText },
    ],
  },
  {
    title: 'Kehadiran & Jadwal',
    icon: CalendarClock,
    items: [
      { href: '/attendance', label: 'Absensi & Log Foto', shortLabel: 'Absensi', icon: CalendarClock },
      { href: '/roster', label: 'Shift Roster', shortLabel: 'Roster', icon: Calendar },
      { href: '/leave', label: 'Cuti & Izin', shortLabel: 'Cuti', icon: CalendarHeart },
    ],
  },
  {
    title: 'Kompensasi',
    icon: Banknote,
    items: [
      { href: '/payroll', label: 'Payroll & Slip Gaji', shortLabel: 'Payroll', icon: Banknote },
      { href: '/crew-bonus', label: 'Bonus & Insentif Penjualan', shortLabel: 'Bonus Insentif', icon: Sparkles },
    ],
  },
  {
    title: 'Performa & Disiplin',
    icon: Award,
    items: [
      { href: '/discipline', label: 'Catatan SP & Disiplin', shortLabel: 'Disiplin', icon: AlertTriangle },
      { href: '/performance', label: 'Evaluasi KPI & Bonus', shortLabel: 'KPI & Bonus', icon: Award },
    ],
  },
]

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

export function isItemActive(href: string, pathname: string): boolean {
  if (href === '/') {
    return pathname === '/'
  }
  return pathname === href || pathname.startsWith(href + '/')
}

export function labelForPath(pathname: string): string {
  let best: { href: string; label: string } | null = null
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (isItemActive(it.href, pathname) && (!best || it.href.length > best.href.length)) {
        best = { href: it.href, label: it.label }
      }
    }
  }
  return best?.label ?? 'HR Dashboard'
}

export function resolvePortalUrl(): string {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3010'
  }
  return portalUrl
}
