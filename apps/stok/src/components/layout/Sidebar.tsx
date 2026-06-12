'use client'

import { Sidebar as SharedSidebar } from '@suka/design-system'
import { usePathname } from 'next/navigation'

const MENU_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Opname Stok', href: '/stok/opname' },
  { label: 'Ledger', href: '/stok/ledger' },
  { label: 'Monitoring', href: '/stok/monitoring' },
  { label: 'Live Monitoring', href: '/stok/monitoring-live' },
]

export const Sidebar = () => {
  const pathname = usePathname()

  return <SharedSidebar menuItems={MENU_ITEMS} currentPathname={pathname} />
}
