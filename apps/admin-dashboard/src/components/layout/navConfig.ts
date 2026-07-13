import {
  LayoutDashboard, Users, Store, Activity,
  CalendarClock, CalendarHeart, Banknote,
  PieChart, DollarSign, Target, BellRing, Tags, Wallet, BookOpen,
  Package, FileText, Settings, ShoppingCart, Truck, TrendingDown, type LucideIcon,
} from 'lucide-react'


export type Role = 'ADMIN_HR' | 'OWNER' | 'ADMIN' | 'MITRA'

export type NavItem = { href: string; label: string; shortLabel?: string; icon: LucideIcon; roles: Role[] }
/** Sebuah "pintu" navigasi — kelompok besar berlabel bahasa awam. */
export type NavGroup = { title: string; icon: LucideIcon; items: NavItem[]; roles: Role[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Bisnis',
    icon: Wallet,
    roles: ['OWNER', 'ADMIN', 'MITRA'],
    items: [
      { href: '/dashboard/owner', label: 'Ringkasan Bisnis', shortLabel: 'Ringkasan', icon: PieChart, roles: ['OWNER', 'ADMIN', 'MITRA'] },
      { href: '/dashboard/owner/profit', label: 'Untung Rugi', shortLabel: 'Untung Rugi', icon: DollarSign, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/expenses', label: 'Pengeluaran', shortLabel: 'Biaya', icon: TrendingDown, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/targets', label: 'Target & Pesan', shortLabel: 'Target', icon: Target, roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    title: 'Karyawan',
    icon: Users,
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
    title: 'Pengadaan',
    icon: ShoppingCart,
    roles: ['ADMIN'],
    items: [
      { href: '/dashboard/pembelian', label: 'Purchase Order', shortLabel: 'PO', icon: ShoppingCart, roles: ['ADMIN'] },
      { href: '/dashboard/pembelian/supplier', label: 'Master Supplier', shortLabel: 'Supplier', icon: Truck, roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Produk & Stok',
    icon: Package,
    roles: ['ADMIN'],
    items: [
      { href: '/dashboard/bahan-baku', label: 'Master Bahan Baku', shortLabel: 'Bahan Baku', icon: Tags, roles: ['ADMIN'] },
      { href: '/dashboard/resep', label: 'Manajemen Resep', shortLabel: 'Resep', icon: BookOpen, roles: ['ADMIN'] },
      { href: '/dashboard/outlets', label: 'Manajemen Outlet', shortLabel: 'Outlet', icon: Store, roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Laporan',
    icon: FileText,
    roles: ['OWNER', 'ADMIN'],
    items: [
      { href: '/dashboard/reports', label: 'Pusat Laporan', shortLabel: 'Laporan', icon: FileText, roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    title: 'Sistem',
    icon: Settings,
    roles: ['OWNER', 'ADMIN'],
    items: [
      { href: '/dashboard/panduan', label: 'Panduan Sistem', shortLabel: 'Panduan', icon: BookOpen, roles: ['ADMIN', 'OWNER'] },
      { href: '/dashboard/push-center', label: 'Pusat Notifikasi', shortLabel: 'Notifikasi', icon: BellRing, roles: ['ADMIN'] },
      { href: '/dashboard/system-health', label: 'Kesehatan Sistem', shortLabel: 'Sistem', icon: Activity, roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Manajemen POS',
    icon: Store,
    roles: ['ADMIN'],
    items: [
      { href: '/dashboard/pos-admin', label: 'Ringkasan POS', shortLabel: 'Ringkasan', icon: LayoutDashboard, roles: ['ADMIN'] },
      { href: '/dashboard/pos-admin/menu', label: 'Daftar Menu POS', shortLabel: 'Menu', icon: Package, roles: ['ADMIN'] },
      { href: '/dashboard/pos-admin/categories', label: 'Kategori Menu POS', shortLabel: 'Kategori', icon: Tags, roles: ['ADMIN'] },
      { href: '/dashboard/pos-admin/promo', label: 'Manajemen Promo POS', shortLabel: 'Promo', icon: Banknote, roles: ['ADMIN'] },
      { href: '/dashboard/pos-admin/users', label: 'Pengguna POS', shortLabel: 'Pengguna', icon: Users, roles: ['ADMIN'] },
      { href: '/dashboard/pos-admin/settings', label: 'Pengaturan POS', shortLabel: 'Pengaturan', icon: Settings, roles: ['ADMIN'] },
    ],
  },
]

/** Flattened list of nav items the given role can access. */
export function accessibleItems(role: Role): NavItem[] {
  return NAV_GROUPS.filter((g) => g.roles.includes(role)).flatMap((g) =>
    g.items.filter((i) => i.roles.includes(role))
  )
}

/** Pintu (group) yang bisa diakses role, beserta item yang sudah difilter. */
export function accessibleGroups(role: Role): NavGroup[] {
  return NAV_GROUPS.filter((g) => g.roles.includes(role))
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0)
}

/** Active-route resolution shared by sidebar & bottom nav. */
export function isItemActive(href: string, pathname: string): boolean {
  // Dashboard landing routes must match exactly (they have sub-routes).
  if (
    href === '/dashboard/hr' ||
    href === '/dashboard/owner' ||
    href === '/dashboard' ||
    href === '/dashboard/owner/expenses' ||
    href === '/dashboard/pos-admin' ||
    href === '/dashboard/pembelian'
  ) {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(href + '/')
}

/** Judul halaman (bahasa awam) untuk header, berdasarkan path aktif. */
export function labelForPath(pathname: string): string {
  let best: { href: string; label: string } | null = null
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (isItemActive(it.href, pathname) && (!best || it.href.length > best.href.length)) {
        best = { href: it.href, label: it.label }
      }
    }
  }
  return best?.label ?? 'Dashboard'
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
