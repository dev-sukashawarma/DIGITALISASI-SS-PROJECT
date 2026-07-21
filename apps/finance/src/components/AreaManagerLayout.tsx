'use client'

import { LayoutDashboard, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { RoleLayout, type NavGroup } from './RoleLayout'

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'KORLAP',
    items: [
      { href: '/area-manager', label: 'Overview', icon: LayoutDashboard },
      { href: '/area-manager/petty-cash', label: 'Petty Cash', icon: Wallet },
    ],
  },
]

export function AreaManagerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleLayout
      brand="Suka"
      brandAccent="Area Manager"
      navGroups={NAV_GROUPS}
      homePath="/area-manager"
      defaultTitle="Dashboard Area Manager"
    >
      {children}
    </RoleLayout>
  )
}
