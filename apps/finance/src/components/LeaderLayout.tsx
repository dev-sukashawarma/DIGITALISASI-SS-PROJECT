'use client'

import { LayoutDashboard, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { RoleLayout, type NavGroup } from './RoleLayout'

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'LEADER',
    items: [
      { href: '/leader', label: 'Overview', icon: LayoutDashboard },
      { href: '/leader/petty-cash', label: 'Petty Cash', icon: Wallet },
    ],
  },
]

export function LeaderLayout({ children }: { children: ReactNode }) {
  return (
    <RoleLayout
      brand="Suka"
      brandAccent="Leader"
      navGroups={NAV_GROUPS}
      homePath="/leader"
      defaultTitle="Dashboard Leader"
    >
      {children}
    </RoleLayout>
  )
}
