import {
  LayoutDashboard, Users, Store, Activity,
  CalendarClock, CalendarHeart, Banknote,
  PieChart, DollarSign, MessageSquareHeart, Target, BellRing, Tags, BookOpen, type LucideIcon,
} from 'lucide-react'

export type Role = 'ADMIN_HR' | 'OWNER' | 'ADMIN' | 'MITRA'

export type NavItem = { href: string; label: string; shortLabel?: string; icon: LucideIcon; roles: Role[] }
export type NavGroup = { title: string; items: NavItem[]; roles: Role[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'HR Dashboard',
    roles: ['ADMIN_HR', 'ADMIN'],
    items: [
      { href: '/dashboard/hr', label: 'Ringkasan HR', shortLabel: 'HR', icon: LayoutDashboard, roles: ['ADMIN_HR', 'ADMIN'] },
      { href: '/dashboard/hr/staff', label: 'Database Karyawan', shortLabel: 'Karyawan', icon: Users, roles: ['ADMIN_HR', 'ADMIN'] },
      { href: '/dashboard/hr/attendance', label: 'Absensi & Shift', shortLabel: 'Absensi', icon: CalendarClock, roles: ['ADMIN_HR', 'ADMIN'] },
      { href: '/dashboard/hr/leave', label: 'Cuti & Izin', shortLabel: 'Cuti', icon: CalendarHeart, roles: ['ADMIN_HR', 'ADMIN'] },
      { href: '/dashboard/hr/payroll', label: 'Payroll & Kasbon', shortLabel: 'Payroll', icon: Banknote, roles: ['ADMIN_HR', 'ADMIN'] },
    ],
  },
  {
    title: 'Owner Dashboard',
    roles: ['OWNER', 'ADMIN'],
    items: [
      { href: '/dashboard/owner', label: 'Ringkasan Bisnis', shortLabel: 'Ringkasan', icon: PieChart, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/targets', label: 'Target Harian', shortLabel: 'Target', icon: Target, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/messages', label: 'Pesan ke Kasir', shortLabel: 'Pesan', icon: MessageSquareHeart, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/profit', label: 'Profitabilitas', shortLabel: 'Laba Rugi', icon: DollarSign, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/expenses', label: 'Pengeluaran', shortLabel: 'Biaya', icon: Activity, roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    title: 'Dashboard Mitra',
    roles: ['MITRA'],
    items: [
      { href: '/dashboard/owner', label: 'Ringkasan Bisnis', shortLabel: 'Ringkasan', icon: PieChart, roles: ['MITRA'] },
      { href: '/dashboard/owner/targets', label: 'Target Harian', shortLabel: 'Target', icon: Target, roles: ['MITRA'] },
      { href: '/dashboard/owner/profit', label: 'Profitabilitas', shortLabel: 'Laba Rugi', icon: DollarSign, roles: ['MITRA'] },
      { href: '/dashboard/owner/expenses', label: 'Pengeluaran', shortLabel: 'Biaya', icon: Activity, roles: ['MITRA'] },
    ],
  },
  {
    title: 'System & Admin',
    roles: ['ADMIN'],
    items: [
      { href: '/dashboard/bahan-baku', label: 'Master Bahan Baku', shortLabel: 'Bahan Baku', icon: Tags, roles: ['ADMIN'] },
      { href: '/dashboard/outlets', label: 'Manajemen Outlet', shortLabel: 'Outlet', icon: Store, roles: ['ADMIN'] },
      { href: '/dashboard/push-center', label: 'Pusat Notifikasi', shortLabel: 'Notifikasi', icon: BellRing, roles: ['ADMIN'] },
      { href: '/dashboard/system-health', label: 'System Health', shortLabel: 'System', icon: Activity, roles: ['ADMIN'] },
      { href: '/dashboard/panduan', label: 'Panduan Sistem', shortLabel: 'Panduan', icon: BookOpen, roles: ['ADMIN', 'OWNER'] },
    ],
  },
  {
    title: 'Laporan & Audit',
    roles: ['OWNER', 'ADMIN'],
    items: [
      { href: '/dashboard/reports/voids', label: 'Void & Fraud', shortLabel: 'Void', icon: Activity, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/reports/shrinkage', label: 'Shrinkage & Opname', shortLabel: 'Selisih', icon: Tags, roles: ['OWNER', 'ADMIN'] },
    ],
  },
]

/** Flattened list of nav items the given role can access. */
export function accessibleItems(role: Role): NavItem[] {
  return NAV_GROUPS.filter((g) => g.roles.includes(role)).flatMap((g) =>
    g.items.filter((i) => i.roles.includes(role))
  )
}

/** Active-route resolution shared by sidebar & bottom nav. */
export function isItemActive(href: string, pathname: string): boolean {
  // Dashboard landing routes must match exactly (they have sub-routes).
  if (href === '/dashboard/hr' || href === '/dashboard/owner' || href === '/dashboard') {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(href + '/')
}

/** Portal URL, localhost-aware for dev. */
export function resolvePortalUrl(): string {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3010'
  }
  return portalUrl
}

/** POS Kasir base URL, localhost-aware for dev (pos-kasir runs on :3004). */
export function resolvePosKasirUrl(): string {
  const posUrl = process.env.NEXT_PUBLIC_APP_URL_POS_KASIR || 'https://pos.sukashawarma.com'
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3004'
  }
  return posUrl
}

/** Deep-link ke sistem admin POS (menu, kategori, promo, laporan, user). */
export function resolvePosAdminUrl(): string {
  return `${resolvePosKasirUrl()}/admin`
}
