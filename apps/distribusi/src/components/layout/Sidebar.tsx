'use client'

import { Sidebar as SharedSidebar } from '@suka/design-system'
import { usePathname } from 'next/navigation'

const MENU_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Absensi', href: '/absensi' },
  { label: 'Surat Jalan', href: '/distribusi/surat-jalan' },
  { label: 'Penerimaan Barang', href: '/distribusi/terima' },
]

export const Sidebar = () => {
  const pathname = usePathname()

  return <SharedSidebar menuItems={MENU_ITEMS} currentPathname={pathname} />
}
