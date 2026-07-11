'use client'

import { LayoutDashboard, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { RoleLayout, type NavGroup } from './RoleLayout'

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'KORLAP',
    items: [
      { href: '/korlap', label: 'Overview', icon: LayoutDashboard },
      { href: '/korlap/petty-cash', label: 'Petty Cash', icon: Wallet },
    ],
  },
]

export function KorlapLayout({ children }: { children: ReactNode }) {
  return (
    <RoleLayout
      brand="Suka"
      brandAccent="Korlap"
      navGroups={NAV_GROUPS}
      homePath="/korlap"
      defaultTitle="Dashboard Korlap"
    >
      {children}
    </RoleLayout>
  )
}
